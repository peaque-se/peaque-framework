import chokidar from "chokidar"
import { config } from "dotenv"
import { accessSync, existsSync, promises as fs, readFileSync, statSync } from "fs"
import path, { basename, extname } from "path"
import colors from "yoctocolors"
import { contentTypeRegistry } from "../assets/asset-handler.js"
import { bundleModuleFromNodeModules, setBaseDependencies } from "../compiler/bundle.js"
import { fastRefreshify } from "../compiler/fast-refreshify.js"
import { makeImportsRelative, setupImportAliases } from "../compiler/imports.js"
import { bundleCssFile } from "../compiler/tailwind-bundler.js"
import { setupSourceMaps } from "../exceptions/sourcemaps.js"
import { hmrConnectHandler, notifyConnectedClients } from "../hmr/hmr-handler.js"
import { ModuleLoader } from "../hmr/module-loader.js"
import { executeMiddlewareChain } from "../http/http-router.js"
import { HttpServer } from "../http/http-server.js"
import { PeaqueRequest, RequestHandler } from "../http/http-types.js"
import { JobsRunner } from "../jobs/jobs-runner.js"
import { buildRouter, RouteFileConfig } from "../router/builder.js"
import { match, RouteNode } from "../router/router.js"
import { serializeRouterToJs } from "../router/serializer.js"
import { FileCache } from "./file-cache.js"
import { platformVersion } from "./version.js"

const pageRouterConfig: RouteFileConfig[] = [
  { pattern: "page.tsx", property: "page", stacks: false, accept: true },
  { pattern: "layout.tsx", property: "layout", stacks: true },
  { pattern: "guard.ts", property: "guards", stacks: true },
  { pattern: "head.ts", property: "heads", stacks: true },
  { pattern: "middleware.ts", property: "middleware", stacks: false },
]

const apiRouterConfig: RouteFileConfig[] = [
  { pattern: "route.ts", property: "handler", stacks: false, accept: true },
  { pattern: "middleware.ts", property: "middleware", stacks: true },
]

function componentify(router: RouteNode, baseDir: string): Set<string> {
  const imports = new Set<string>()

  function getComponentName(filePath: string): string {
    const relativePath = path.relative(baseDir, filePath)
    const componentName = relativePath
      .replace(/[^a-zA-Z0-9]/g, " ") // Replace non-alphanumeric characters with space
      .split(" ") // Split by space
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
      .join("") // Join back without spaces
    return componentName
  }

  function traverse(node: RouteNode) {
    // Convert names to component names
    if (node.names) {
      for (const key in node.names) {
        const name = node.names[key]
        const componentName = getComponentName(name)
        node.names[key] = componentName
        const filename = path.relative(baseDir, name)
        imports.add(`import ${componentName} from "./src/pages/${filename.replace(/\\/g, "/")}";`)
      }
    }
    // Convert stacks to component names
    if (node.stacks) {
      for (const key in node.stacks) {
        node.stacks[key] = node.stacks[key].map((name: string) => {
          const componentName = getComponentName(name)
          const filename = path.relative(baseDir, name)
          imports.add(`import ${componentName} from "./src/pages/${filename.replace(/\\/g, "/")}";`)
          return componentName
        })
      }
    }
    for (const child of node.staticChildren.values()) {
      traverse(child)
    }
    if (node.paramChild) {
      traverse(node.paramChild)
    }
    if (node.wildcardChild) {
      traverse(node.wildcardChild)
    }
  }

  traverse(router)
  return imports
}

/// fifteenth attempt at a dev server that reloads even better, but is still fast
export class DevServer {
  private basePath: string
  private port: number
  private noStrict: boolean
  private server: HttpServer
  private frontend: RouteNode
  private frontendImports: Set<string>
  private backend: RouteNode
  private moduleCache: FileCache<any> = new FileCache()
  private moduleLoader: ModuleLoader
  private jobsRunner: JobsRunner
  private watcher: chokidar.FSWatcher | undefined
  private handler: RequestHandler = this.requestHandler.bind(this)

  constructor(basePath: string, port: number, noStrict: boolean) {
    this.basePath = basePath
    this.port = port
    this.noStrict = noStrict
    this.server = new HttpServer((r) => this.handler(r))
    this.moduleLoader = new ModuleLoader({ absWorkingDir: basePath })
    setupSourceMaps()
    this.jobsRunner = new JobsRunner(basePath)

    this.frontend = buildRouter(this.basePath + "/src/pages", pageRouterConfig)
    this.frontendImports = componentify(this.frontend, this.basePath + "/src/pages")
    this.backend = buildRouter(this.basePath + "/src/api", apiRouterConfig)

    const tsconfigPath = path.join(basePath, "tsconfig.json")
    if (existsSync(tsconfigPath)) {
      const tsconfigContent = readFileSync(tsconfigPath, "utf-8")
      const tsconfigJson = JSON.parse(tsconfigContent)
      setupImportAliases(tsconfigJson)
    }

    setBaseDependencies(basePath)

    if (existsSync(path.join(basePath, "src/middleware.ts"))) {
      this.moduleLoader
        .loadExport(path.relative(basePath, path.join(basePath, "src/middleware.ts")).replace(/\\/g, "/"), "middleware")
        .then((mw) => {
          console.log(`     ${colors.green("✓")} Loaded global middleware from src/middleware.ts`)
          this.handler = (req) => executeMiddlewareChain(req, [mw], this.requestHandler.bind(this))
        })
        .catch((err) => {
          console.error("Error loading global middleware:", err)
        })
    }

    config({ path: path.join(basePath, ".env"), override: true }) // re-load .env variables on each rebuild
    config({ path: path.join(basePath, ".env.local"), override: true }) // re-load .env variables on each rebuild
  }

  async start() {
    try {
      await this.runStartup()
      this.jobsRunner.startOrUpdateJobs()
      this.watchSourceFiles()
      await this.server.startServer(this.port)
      // change window title to Peaque Framework - port
      process.stdout.write(`\x1b]0;🌍 Peaque Framework ${platformVersion}\x07`)
      console.log(`🌍  ${colors.bold(colors.yellow("Peaque Framework " + platformVersion))} server running`)
      console.log(`     ${colors.green("✓")} Local ${colors.underline(`http://localhost:${this.port}`)}`)
      console.log(`     ${colors.green("✓")} Base path ${colors.gray(`${this.basePath}`)}`)
      if (this.noStrict) {
        console.log(`     ${colors.green("✓")} React Strict Mode is ${colors.bold("disabled")}`)
      }
      console.log(`     ${colors.green("✓")} Have fun coding!`)
    } catch (error: any) {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${this.port} is already in use. Please choose a different port or stop the process using it.`)
      } else {
        console.error(`❌ Failed to start server.`)
        console.error(error)
      }
      process.exit(1)
    }
  }
  private async runStartup() {
    const startupFile = path.join(this.basePath, "src", "startup.ts")
    if (existsSync(startupFile)) {
      await this.moduleLoader.loadModule(path.relative(this.basePath, startupFile).replace(/\\/g, "/"))
      console.log(`     ${colors.green("✓")} Executed startup script from src/startup.ts`)
    }
  }

  async stop(reason?: string) {
    this.server.stop()
    this.jobsRunner.stop()
    this.watcher?.close()
    console.log(`     ${colors.green("✓")} Peaque Framework ${platformVersion} server ${colors.red("stopped")} ${reason ? `(${colors.gray(reason)})` : ""}`)
    console.log(`     ${colors.green("✓")} Good bye! See you later!`)
  }

  private async requestHandler(req: PeaqueRequest) {
    const path = req.path()
    // console.log(`Request for ${path}`)

    // if path starts with /@deps/, serve from node_modules
    if (path.startsWith("/@deps/")) {
      return await this.serveBundledModule(req)
    }

    // if path starts with /@src/, serve from src directory with import aliasing
    if (path.startsWith("/@src/")) {
      return await this.serveBundledSrcFile(req)
    }

    // if path starts with /api/, handle API requests
    if (path.startsWith("/api/")) {
      return await this.handleBackendApiRequest(req)
    }

    // if the path is /peaque-dev.js, serve the Peaque main file
    if (path === "/peaque-dev.js") {
      return this.servePeaqueMain(req)
    }

    // if the path is /peaque-loader.js, serve the Peaque loader file
    if (path == "/peaque-loader.js") {
      return await this.servePeaqueApplicationMain(req)
    }

    // it the path is /peaque.js, serve the bundled Peaque application
    if (path === "/peaque.js") {
      return await this.sendMainRouter(req)
    }

    // if the path is /peaque.css, serve the Peaque CSS
    if (path === "/peaque.css") {
      return await this.servePeaqueCss(req)
    }

    if (path === "/hmr") {
      return hmrConnectHandler(req)
    }

    // if the file exists in the public directory, serve it
    if (this.fileExistsInPublicDir(path)) {
      return this.serveFileFromPublicDir(req)
    }

    // otherwise, serve the main application page
    return await this.serveMainPage(req)
  }

  private watchSourceFiles() {
    const srcDir = this.basePath + "/src"
    // watch the src directory recursively for changes to .ts, .tsx, .js, .jsx files with chokidar
    this.watcher = chokidar.watch(srcDir, {
      cwd: this.basePath,
      ignored: ["dist/**", "build/**", "node_modules/**", ".peaque/**", ".git/**", ".*/**"],
      ignoreInitial: true,
      persistent: true,
    })

    this.watcher.on("all", (event, path) => {
      if (path.endsWith(".tsx")) {
        notifyConnectedClients({ event, path: path.replace(".tsx", "") }, path)
      } else {
        if (path.startsWith("src/pages/")) {
          this.frontend = buildRouter(this.basePath + "/src/pages", pageRouterConfig)
          this.frontendImports = componentify(this.frontend, this.basePath + "/src/pages")
          notifyConnectedClients({ event, path: "/peaque.js" }, "<main router>")
        } else if (path.startsWith("src/api/")) {
          this.backend = buildRouter(this.basePath + "/src/api", apiRouterConfig)
        } else if (path.startsWith("src/jobs/")) {
          this.jobsRunner.startOrUpdateJobs()
        }
      }
    })
  }

  private async handleBackendApiRequest(req: PeaqueRequest) {
    const matchResult = match(req.path().substring(4), this.backend) // remove /api
    if (!matchResult) {
      req.code(404).send("Not Found")
      return
    }
    const moduleFile = matchResult.names.handler
    matchResult.params && Object.keys(matchResult.params).forEach((k) => req.setPathParam(k, matchResult.params[k]))

    const middlewares = await Promise.all(
      matchResult.stacks.middleware.map(
        async (middlewareFile) =>
          await this.moduleCache.cacheByHash(middlewareFile, async () => {
            const module = path.relative(this.basePath, middlewareFile).replace(/\\/g, "/")
            return await this.moduleLoader.loadExport(module, "middleware")
          })
      )
    )

    const api = await this.moduleCache.cacheByHash(moduleFile, async () => {
      const module = path.relative(this.basePath, moduleFile).replace(/\\/g, "/")
      return await this.moduleLoader.loadModule(module)
    })
    const handler = api[req.method().toUpperCase()]
    if (!handler || typeof handler !== "function") {
      req.code(500).send("No handler for this method")
      return
    }
    return await executeMiddlewareChain(req, middlewares, handler)
  }

  private async serveBundledSrcFile(req: PeaqueRequest) {
    const srcPath = req.path().substring(5) // remove /@src/
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]
    const fullPath = extensions.map((ext) => path.join(this.basePath, srcPath + ext)).find((p) => existsSync(p) && statSync(p).isFile())
    if (!fullPath) {
      console.error(`File not found: ${srcPath} (tried with extensions: ${extensions.join(", ")})`)
      req.code(404).send("File not found")
      return
    }
    try {
      const srcContent = readFileSync(fullPath, "utf-8")
      const fastifyContent = fastRefreshify(srcContent, srcPath)
      const processedContents = makeImportsRelative(fastifyContent, fullPath.substring(this.basePath.length + 1))
      req.type("application/javascript").send(processedContents)
    } catch (err) {
      const errorContents = `console.error("Error loading module ${srcPath}:", ${JSON.stringify(err instanceof Error ? err.message : String(err))})\n
          throw new Error(${JSON.stringify(err instanceof Error ? err.message : String(err))})\n
          export default function() {}
          `
      req.type("application/javascript").send(errorContents)
    }
  }

  private async sendMainRouter(req: PeaqueRequest) {
    const result: string[] = []
    result.push(`// Auto-generated by Peaque Dev Server`)
    result.push(`// Do not edit this file directly\n`)
    if (!this.noStrict) {
      result.push(`import { StrictMode } from "react"`)
    }
    result.push(`import { Router } from "@peaque/framework"`)
    result.push(...Array.from(this.frontendImports))
    result.push(serializeRouterToJs(this.frontend, true))
    result.push(`const conf = {`)
    result.push(`  root: router,`)
    result.push(`}`)
    result.push(`export default function() {`)
    if (this.noStrict) {
      result.push(`  return <Router {...conf} />`)
    } else {
      result.push(`  return <StrictMode><Router {...conf} /></StrictMode>`)
    }
    result.push(`}`)

    const js = result.join("\n")
    const fastifyContent = fastRefreshify(js, "peaque.tsx")
    const processedContents = makeImportsRelative(fastifyContent)

    req.type("application/javascript").send(processedContents)
  }

  private async servePeaqueApplicationMain(req: PeaqueRequest) {
    const loaderContent = `
          import { createRoot } from 'react-dom/client';
          import MainApplication from './peaque.js';
          createRoot(document.getElementById('peaque')!).render(<MainApplication />);`
    const fastifyContent = fastRefreshify(loaderContent, "peaque-loader.js")
    const processedContents = makeImportsRelative(fastifyContent).replace("/@src/peaque", "/peaque.js")
    // set the content type to application/javascript
    req.type("application/javascript").send(processedContents)
  }

  private async serveBundledModule(req: PeaqueRequest) {
    const path = req.path()
    const module = path.replace("/@deps/", "")
    const contents = await bundleModuleFromNodeModules(module, this.basePath)
    req.code(200).header("Content-Type", "application/javascript").send(contents)
  }

  private servePeaqueMain(req: PeaqueRequest) {
    const js = `
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
    const ws = new WebSocket('ws://localhost:${this.port}/hmr');
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
}`
    req.code(200).header("Content-Type", "application/javascript").send(js)
  }

  private serveFileFromPublicDir(req: PeaqueRequest) {
    const absFile = this.basePath + "/src/public" + req.path()
    const contents = readFileSync(absFile)
    const contentType = contentTypeRegistry[extname(basename(absFile))] || "application/octet-stream"
    req.code(200).header("Content-Type", contentType).send(contents)
  }

  private fileExistsInPublicDir(path: string): boolean {
    const absFile = this.basePath + "/src/public" + path
    try {
      const stats = statSync(absFile)
      if (!stats.isFile()) return false
      accessSync(absFile, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  private async servePeaqueCss(req: PeaqueRequest) {
    const css = readFileSync(this.basePath + "/src/styles.css", "utf-8")
    const bundle = await bundleCssFile(css, this.basePath)
    req.code(200).header("Content-Type", "text/css").send(bundle)
  }

  private async serveMainPage(req: PeaqueRequest) {
    req.code(200).header("Content-Type", "text/html").send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Peaque App</title>
        <link rel="stylesheet" href="/peaque.css" />
        <script type="module" src="/peaque-dev.js"></script>
      </head>
      <body>
        <div id="peaque"></div>
      </body>
      </html>
    `)
  }
}
