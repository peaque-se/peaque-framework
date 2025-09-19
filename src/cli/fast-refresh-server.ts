import { config } from "dotenv"
import chokidar from "chokidar"
import { generateBackendProgram } from "../compiler/backend-generator.js"
import { bundleModuleFromNodeModules, setBaseDependencies } from "../compiler/bundle.js"
import { fastRefreshify } from "../compiler/fast-refreshify.js"
import { buildPageRouter, generatePageRouterJS } from "../compiler/frontend-generator.js"
import { makeImportsRelative } from "../compiler/imports.js"
import { bundleCssFile } from "../compiler/tailwind-bundler.js"
import { ModuleLoader } from "../hmr/module-loader.js"
import { executeMiddlewareChain, Router } from "../http/http-router.js"
import { HttpServer } from "../http/http-server.js"
import { HttpMethod, PeaqueRequest, RequestHandler, RequestMiddleware } from "../http/http-types.js"
import fs from "fs"
import path from "path"
import { getHmrClientJs, hmrConnectHandler, notifyConnectedClients } from "../hmr/hmr-handler.js"

export async function runFastRefreshServer(basePath: string): Promise<void> {
    config({ path: path.join(basePath, ".env"), override: true }) // re-load .env variables on each rebuild
    config({ path: path.join(basePath, ".env.local"), override: true }) // re-load .env variables on each rebuild


  setBaseDependencies(basePath);

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
</head>
<body>
<div id="peaque"></div>
<script type="module" src="/peaque-dev.js"></script>
<script type="module" src="/peaque.js"></script>
</body>
</html>`

  const pageRouter = await buildPageRouter(basePath)
  const mainFile = await generatePageRouterJS(pageRouter, true, "./src")

  const router = new Router()
  pageRouter.routes.forEach((route) => {
    router.addRoute("GET", route.path, async (req) => {
      req.type("text/html").send(indexHtml)
    })
  })

  router.addRoute("GET", "/peaque-dev.js", async (req) => {
    req.type("application/javascript").send(`import * as runtime from "/@deps/react-refresh/runtime"
      runtime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = (file) => (code, id) => {
        //console.log("RFR POC: $RefreshReg$ called with id", id, "for file", file)
        runtime.register(code, file + "-" + id)
      }
      window.$RefreshSig$ = runtime.createSignatureFunctionForTransform
      window.performReactRefresh = runtime.performReactRefresh

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
    const ws = new WebSocket('ws://localhost:3000/hmr');
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      replaceStylesheet("/style.css")
      const updatedFile = message.data.path
      import("/@src/" + updatedFile + "?t=" + Date.now()).then((mod) => {
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
        let middlewares: Array<RequestMiddleware> = []

        route.methods.forEach((method) => {
          router.addRoute(method, route.path, async (req) => {
            if (apiRoute === null) {
              // Load API route module with fresh import
              apiRoute = await moduleLoader.loadModule(route.filePath)

              // Load middlewares lazily with proper concurrency control
              middlewares = []
              for (const mwPath of route.middleware) {
                const middleware = await moduleLoader.loadExport<RequestMiddleware>(mwPath, 'middleware')
                middlewares.push(middleware)
              }
            }
            req.type("application/json")
            await executeMiddlewareChain(req, middlewares, apiRoute![method])
          })
        })
      })


  router.addRoute("GET", "/peaque.js", async (req) => {
    const fastifyContent = fastRefreshify(mainFile, '_page_router.tsx');
    const processedContents = makeImportsRelative(fastifyContent);
    // set the content type to application/javascript
    req.type("application/javascript").send(processedContents)
  })

  const depsHandler: RequestHandler = async (req) => {
    const moduleName = req.path().substring(7) // remove /@deps/
    const moduleContent = await bundleModuleFromNodeModules(moduleName, basePath)
    req.code(200).type("application/javascript").send(moduleContent)
  }

  const srcHandler: RequestHandler = async (req) => {
    let srcPath = req.path().substring(6) // remove /@src/
    // expand @/ to /src/
    if (srcPath.startsWith("@/")) {
      srcPath = "src/" + srcPath.substring(2)
    }
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]
    const fullPath = extensions.map(ext => path.join(basePath, srcPath + ext)).find(p => fs.existsSync(p) && fs.statSync(p).isFile())
    if (!fullPath) {
      console.error(`File not found: ${srcPath} (tried with extensions: ${extensions.join(", ")})`)
      req.code(404).send("File not found")
      return
    }
    try {
      const srcContent = fs.readFileSync(fullPath, "utf-8")
      const fastifyContent = fastRefreshify(srcContent, srcPath);
      const processedContents = makeImportsRelative(fastifyContent, fullPath.substring(basePath.length + 1));
      req.type("application/javascript").send(processedContents)
    } catch (err) {
      const errorContents = `console.error("Error loading module ${srcPath}:", ${JSON.stringify(err instanceof Error ? err.message : String(err))})\n
      throw new Error(${JSON.stringify(err instanceof Error ? err.message : String(err))})\n
      export default function() {}
      `
      req.type("application/javascript").send(errorContents)
    }
  }

  router.addRoute("GET", "/@deps/:a", depsHandler)
  router.addRoute("GET", "/@deps/:a/:b", depsHandler)
  router.addRoute("GET", "/@deps/:a/:b/:c", depsHandler)
  router.addRoute("GET", "/@deps/:a/:b/:c/:d", depsHandler)
  router.addRoute("GET", "/@deps/:a/:b/:c/:d/:e", depsHandler)
  router.addRoute("GET", "/@deps/:a/:b/:c/:d/:e/:f", depsHandler)

  router.addRoute("GET", "/@src/:a", srcHandler)
  router.addRoute("GET", "/@src/:a/:b", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f/:g", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f/:g/:h", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f/:g/:h/:i", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j/:k", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j/:k/:l", srcHandler)
  router.addRoute("GET", "/@src/:a/:b/:c/:d/:e/:f/:g/:h/:i/:j/:k/:l/:m", srcHandler)

  router.addRoute("GET", "/hmr", hmrConnectHandler)

  const requestHandler = router.getRequestHandler()

  const outermostHandler: RequestHandler = async (req: PeaqueRequest) => {
    return await requestHandler(req)
  }

  const server = new HttpServer(outermostHandler)
  await server.startServer(3000)
  console.log(`🚀  Fast Refresh server running at http://localhost:3000 for project at ${basePath}`)


  const watcher = chokidar.watch(basePath, {
    cwd: basePath,
    ignored: ["dist/**", "build/**", "node_modules/**", ".peaque/**", ".git/**", ".*/**"],
    ignoreInitial: true,
  })

  watcher.on("all", (event, path) => {
    console.log("updated file:", event, path)
    if (path.endsWith(".tsx")) {
      notifyConnectedClients({ event, path: path.replace(/\\/g, "/").replace(".tsx", "") })
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
