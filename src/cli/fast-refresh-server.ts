import chokidar from "chokidar"
import { config } from "dotenv"
import fs from "fs"
import path from "path"
import colors from "yoctocolors"
import { generateBackendProgram } from "../compiler/backend-generator.js"
import { bundleModuleFromNodeModules, setBaseDependencies } from "../compiler/bundle.js"
import { fastRefreshify } from "../compiler/fast-refreshify.js"
import { buildPageRouter, FlatRoute, generatePageRouterJS } from "../compiler/frontend-generator.js"
import { makeImportsRelative, setupImportAliases } from "../compiler/imports.js"
import { bundleCssFile } from "../compiler/tailwind-bundler.js"
import { hmrConnectHandler, notifyConnectedClients } from "../hmr/hmr-handler.js"
import { ModuleLoader } from "../hmr/module-loader.js"
import { executeMiddlewareChain, Router } from "../http/http-router.js"
import { HttpServer } from "../http/http-server.js"
import { HttpMethod, PeaqueRequest, RequestHandler, RequestMiddleware } from "../http/http-types.js"
import { HeadDefinition } from "../index.js"
import { mergeHead, renderHead } from "../client/head.js"
import { addAssetRoutesForFolder } from "../http/index.js"
import { JobsRunner } from "../jobs/jobs-runner.js"

export async function runFastRefreshServer(basePath: string, port: number, noStrict: boolean): Promise<void> {
  config({ path: path.join(basePath, ".env"), override: true }) // re-load .env variables on each rebuild
  config({ path: path.join(basePath, ".env.local"), override: true }) // re-load .env variables on each rebuild

  // Setup import aliases from tsconfig.json if it exists
  const tsconfigPath = path.join(basePath, "tsconfig.json")
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigContent = fs.readFileSync(tsconfigPath, "utf-8")
    const tsconfigJson = JSON.parse(tsconfigContent)
    setupImportAliases(tsconfigJson)
  }

  setBaseDependencies(basePath)

  const defaultHead: HeadDefinition = {
    title: "Peaque Dev Server",
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "A Peaque Framework Application" },
    ],
  }

  function makeIndexRoute(route: FlatRoute): RequestHandler {
    const headLoader = new ModuleLoader({ absWorkingDir: basePath })
    let head: string | null = null

    return async (req) => {
      if (!head) {
        let headDefinition = defaultHead
        for (const headImport of route.headStack) {
          try {
            const headModule = await headLoader.loadModule(path.join("src/pages/", headImport.relativePath))
            headDefinition = mergeHead(headDefinition, headModule.default)
          } catch (err) {
            console.warn(`⚠️  Failed to load head component at ${headImport.relativePath}:`, err)
          }
        }
        head = renderHead(headDefinition)
      }
      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
${head}
</head>
<body>
<div id="peaque"></div>
<script type="module" src="/peaque-dev.js"></script>
</body>
</html>`
      req.type("text/html").send(indexHtml)
    }
  }

  const pageRouter = await buildPageRouter(basePath)

  const router = new Router()
  router.fallback((req) => req.redirect("/"))
  pageRouter.routes.forEach((route) => {
    router.addRoute("GET", route.path, makeIndexRoute(route))
  })

  await addAssetRoutesForFolder(router, basePath + "/src/public", "/")

  router.addRoute("GET", "/peaque-dev.js", async (req) => {
    req.type("application/javascript").send(`
      import * as runtime from "/@deps/react-refresh/runtime"
      runtime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = (file) => (code, id) => {
        runtime.register(code, file + "-" + id)
      }
      window.$RefreshSig$ = runtime.createSignatureFunctionForTransform
      window.performReactRefresh = runtime.performReactRefresh

      import("/peaque-loader.js?t=" + Date.now())

      const sheet = new CSSStyleSheet()
      document.adoptedStyleSheets = [sheet]
      async function replaceStylesheet(url) {
        const css = await (await fetch(url)).text()
        await sheet.replace(css)
      }
      replaceStylesheet("/style.css")
      window.replaceStylesheet = replaceStylesheet
if (typeof window !== 'undefined') {
  let reconnectAttempts = 0;
  const maxAttempts = 5;

  function connect() {
    const ws = new WebSocket('ws://localhost:${port}/hmr');
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      replaceStylesheet("/style.css")
      const updatedFile = message.data.path
      let updatePath = "/@src/" + updatedFile + "?t=" + Date.now()
      if (updatedFile === "/peaque.js") {
        updatePath = "/peaque.js?t=" + Date.now()
      }
      import(updatePath).then((mod) => {
        //console.log("HMR: Successfully re-imported updated module:", updatedFile, mod);
        window.performReactRefresh();
      }).catch((err) => {
        console.error("HMR: Error re-importing updated module:", updatedFile, err);
      });
      console.log("HMR message:", message.data.path);

    };
    ws.onclose = () => {
      if (reconnectAttempts++ < maxAttempts) setTimeout(connect, 1000);
    };
  }
  connect();
}`)
  })

  // write the generated page router to file for inspection
  //fs.writeFileSync("_generated_main_fast_refresh.txt", mainFile, "utf-8")

  router.addRoute("GET", "/style.css", async (req) => {
    const stylePath = path.join(basePath, "src/styles.css")
    const cssContent = fs.readFileSync(stylePath, "utf-8")
    const newCssContent = await bundleCssFile(cssContent, basePath)

    req.type("text/css").send(newCssContent)
  })

  const backend = await generateBackendProgram({
    baseDir: basePath,
    importPrefix: "../src/",
  })

  // Create module loader for lazy loading with concurrency control
  // Each new instance automatically ensures fresh modules are loaded
  const moduleLoader = new ModuleLoader({
    absWorkingDir: basePath,
  })

  backend.routes.forEach((route) => {
    let apiRoute: Record<HttpMethod, RequestHandler> | null = null
    let createTime = 0
    let middlewares: Array<RequestMiddleware> = []

    route.methods.forEach((method) => {
      router.addRoute(method, route.path, async (req) => {
        const fstat = fs.statSync(path.join(basePath, route.filePath)).mtimeMs
        if (apiRoute === null || createTime !== fstat) {
          // Load API route module with fresh import
          apiRoute = await moduleLoader.loadModule(route.filePath)
          createTime = fstat

          // Load middlewares lazily with proper concurrency control
          middlewares = []
          for (const mwPath of route.middleware) {
            const middleware = await moduleLoader.loadExport<RequestMiddleware>(mwPath, "middleware")
            middlewares.push(middleware)
          }
        }
        req.type("application/json")
        await executeMiddlewareChain(req, middlewares, apiRoute![method])
      })
    })
  })

  router.addRoute("GET", "/peaque.js", async (req) => {
    const mainFile = await generatePageRouterJS({ pageRouter, devMode: !noStrict, importPrefix: "./src", createReact: false })
    const fastifyContent = fastRefreshify(mainFile, "_page_router.tsx")
    const processedContents = makeImportsRelative(fastifyContent)
    // set the content type to application/javascript
    req.type("application/javascript").send(processedContents)
  })

  router.addRoute("GET", "/peaque-loader.js", async (req) => {
    const loaderContent = `
      import { createRoot } from 'react-dom/client';
      import MainApplication from './peaque.js';
      createRoot(document.getElementById('peaque')!).render(<MainApplication />);`
    const fastifyContent = fastRefreshify(loaderContent, "peaque-loader.js")
    const processedContents = makeImportsRelative(fastifyContent).replace("/@src/peaque", "/peaque.js")
    // set the content type to application/javascript
    req.type("application/javascript").send(processedContents)
  })

  router.addRoute("GET", "/@deps/*moduleName", async (req) => {
    const moduleName = req.param("moduleName")!

    // // for development, we always bundle a fresh copy of the framework
    // if (moduleName.includes("@peaque/framework")) {
    //   console.log("Bundling @peaque/framework for", moduleName, "from", process.cwd())
    //   const moduleContent = await bundleESMModule(moduleName, "@peaque/framework", {}, process.cwd())
    //   req.code(200).type("application/javascript").send(moduleContent)
    //   return
    // }

    const moduleContent = await bundleModuleFromNodeModules(moduleName, basePath)
    req.code(200).type("application/javascript").send(moduleContent)
  })

  router.addRoute("GET", "/@src/*fileName", async (req) => {
    let srcPath = req.param("fileName")!
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]
    const fullPath = extensions.map((ext) => path.join(basePath, srcPath + ext)).find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
    if (!fullPath) {
      console.error(`File not found: ${srcPath} (tried with extensions: ${extensions.join(", ")})`)
      req.code(404).send("File not found")
      return
    }
    try {
      const srcContent = fs.readFileSync(fullPath, "utf-8")
      const fastifyContent = fastRefreshify(srcContent, srcPath)
      const processedContents = makeImportsRelative(fastifyContent, fullPath.substring(basePath.length + 1))
      req.type("application/javascript").send(processedContents)
    } catch (err) {
      const errorContents = `console.error("Error loading module ${srcPath}:", ${JSON.stringify(err instanceof Error ? err.message : String(err))})\n
      throw new Error(${JSON.stringify(err instanceof Error ? err.message : String(err))})\n
      export default function() {}
      `
      req.type("application/javascript").send(errorContents)
    }
  })

  // EXPERIMENTAL: if basePath/src/middleware.ts exists, load it and use it as global middleware
  const globalMiddlewarePath = path.join(basePath, "src", "middleware.ts")
  let globalMiddleware: RequestMiddleware | null = null
  if (fs.existsSync(globalMiddlewarePath)) {
    globalMiddleware = await moduleLoader.loadExport<RequestMiddleware>("src/middleware.ts", "middleware")
  }

  router.addRoute("GET", "/hmr", hmrConnectHandler)

  const requestHandler = router.getRequestHandler()

  const outermostHandler: RequestHandler = async (req: PeaqueRequest) => {
    if (globalMiddleware) {
      await executeMiddlewareChain(req, [globalMiddleware], requestHandler)
    } else {
      return await requestHandler(req)
    }
  }

  const server = new HttpServer(outermostHandler)
  try {
    await server.startServer(port)
    console.log(`🌍  ${colors.bold(colors.yellow("Peaque Framework"))} server running`)
    console.log(`     ${colors.green("✓")} Local ${colors.underline(`http://localhost:${port}`)}`)
    console.log(`     ${colors.green("✓")} Base path ${colors.gray(`${basePath}`)}`)
    if (noStrict) {
      console.log(`     ${colors.green("✓")} React Strict Mode is ${colors.bold("disabled")}`)
    }
    console.log(`     ${colors.green("✓")} Have fun coding!`)
  } catch (error: any) {
    if (error.code === "EADDRINUSE") {
      console.error(`❌ Port ${port} is already in use. Please choose a different port or stop the process using it.`)
    } else {
      console.error(`❌ Failed to start server:`, error.message)
    }
    process.exit(1)
  }

  const jobsRunner = new JobsRunner(basePath)
  await jobsRunner.startOrUpdateJobs()

  const watcher = chokidar.watch(basePath, {
    cwd: basePath,
    ignored: ["dist/**", "build/**", "node_modules/**", ".peaque/**", ".git/**", ".*/**"],
    ignoreInitial: true,
  })

  watcher.on("all", (event, path) => {
    path = path.replace(/\\/g, "/") // normalize Windows paths
    if (path.endsWith(".tsx")) {
      notifyConnectedClients({ event, path: path.replace(".tsx", "") }, path)
    }
    if (event === "add" || event === "unlink") {
      notifyConnectedClients({ event, path: "/peaque.js" }, "main router")
    }
    if (path.startsWith("src/jobs/") && path.endsWith("job.ts")) {
      jobsRunner.startOrUpdateJobs().catch((err) => {
        console.error("Error updating jobs:", err)
      })
    }
  })

  // Cleanup function to dispose of resources
  async function cleanup() {
    server.stop()
    console.log("🧹 Cleaning up resources...")
    process.exit(0)
  }

  // Handle process termination signals
  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)
  process.on("SIGUSR2", cleanup) // For nodemon restarts
}
