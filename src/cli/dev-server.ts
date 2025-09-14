import chokidar from "chokidar"
import { config } from "dotenv"
import * as fs from "fs"
import path from "path"
import { addAssetRoutesForFolder } from "../assets/asset-handler.js"
import { generateBackendProgram } from "../compiler/backend-generator.js"
import { FrontendBundler } from "../compiler/frontend-bundler.js"
import { buildPageRouter, generatePageRouterJS } from "../compiler/frontend-generator.js"
import { bundleCssFile } from "../compiler/tailwind-bundler.js"
import { HttpServer, Router } from "../http/index.js"
import { HttpMethod, RequestHandler, RequestMiddleware } from "../http/http-types.js"
import { importWithTsPaths } from "../hmr/import-file.js"
import { getHmrClientJs, hmrConnectHandler, notifyConnectedClients } from "../hmr/hmr-handler.js"
import { executeMiddlewareChain } from "../http/http-router.js"

export const runDevelopmentServer = async () => {
  const basePath = process.cwd()

  // make sure there is a @peaque/framework dependency in package.json
  const pkgPath = path.join(basePath, "package.json")
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`No package.json found in the current directory: ${basePath}`)
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
  if (!((pkg.dependencies && pkg.dependencies["@peaque/framework"]) || (pkg.devDependencies && pkg.devDependencies["@peaque/framework"]))) {
    throw new Error(`No @peaque/framework dependency found in package.json. Please run "npm install @peaque/framework" or "yarn add @peaque/framework" in your project directory.`)
  }

  // Create a reusable bundler instance for efficient rebuilds
  const bundler = new FrontendBundler({
    entryContent: "", // Will be set dynamically
    baseDir: basePath,
    writeToFile: false,
    isDevelopment: true,
    sourcemap: true,
    minify: false,
  })
  const peaquePath = path.join(basePath, ".peaque/")
  const devPath = path.join(peaquePath, "dev/")
  const devAssets = path.join(devPath, "assets/")
  // create all folders if they don't exist
  fs.mkdirSync(devAssets, { recursive: true })

  let currentHandler: RequestHandler | null = null
  const outermostHandler: RequestHandler = async (req) => {
    return currentHandler?.(req)
  }

  // prepare some js
  const hmrClientContent = getHmrClientJs(3000)
  const peaqueDevJsRoute: RequestHandler = async (req) => {
    const devcontent = 'window.process = { env: { NODE_ENV: "development" } };' + "\n" + hmrClientContent + "\n"
    req.type("application/javascript").send(devcontent)
  }
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Peaque Dev Server</title>
  <link rel="stylesheet" href="/peaque.css">
</head>
<body>
  <div id="peaque"></div>
  <script type="module" src="/peaque-dev.js"></script>
  <script type="module" src="/peaque.js"></script>
</body>
</html>`
  const indexRoute: RequestHandler = async (req) => {
    req.type("text/html").send(indexHtml)
  }

  // Track whether this is the first build to use build() vs rebuild()
  let isFirstBuild = true

  // Track rebuild state
  let isRebuilding = false
  let needsAnotherRun = false

  async function rebuildEverything() {
    config({ path: path.join(basePath, ".env"), override: true }) // re-load .env variables on each rebuild
    config({ path: path.join(basePath, ".env.local"), override: true }) // re-load .env variables on each rebuild

    // If already rebuilding, mark that another run is needed
    if (isRebuilding) {
      needsAnotherRun = true
      return
    }

    isRebuilding = true
    needsAnotherRun = false

    try {
      const startTime = Date.now()

      const pageRouter = await buildPageRouter(basePath)
      const mainFile = await generatePageRouterJS(pageRouter, true, "./src")

      // save mainFile for inspection
      //const mainFileView = await generatePageRouterJS(pageRouter, true, "../src")
      //fs.writeFileSync(path.join(basePath, ".peaque/_generated_main.tsx"), mainFileView, "utf-8")

      // Update bundler with new content and build/rebuild
      bundler.updateOptions({
        entryContent: mainFile,
        baseDir: basePath,
      })

      let jsBundleResult
      if (isFirstBuild) {
        console.log("🏗️  Performing initial build...")
        jsBundleResult = await bundler.build()
        isFirstBuild = false
      } else {
        console.log("🔄 Performing incremental rebuild...")
        jsBundleResult = await bundler.rebuild()
      }

      if (!jsBundleResult.success) {
        console.error("❌ Build failed:", jsBundleResult.errors)
        return
      }

      const newJsContent = jsBundleResult.bundleContent!

      // Create the css bundle
      const stylePath = path.join(basePath, "src/styles.css")
      const cssContent = fs.readFileSync(stylePath, "utf-8")
      const newCssContent = await bundleCssFile(cssContent, basePath)

      // Only write files and notify if content has changed
      fs.writeFileSync(path.join(devAssets, "peaque.js"), newJsContent, "utf-8")
      fs.writeFileSync(path.join(devAssets, "peaque.css"), newCssContent, "utf-8")

      const router = new Router()
      await addAssetRoutesForFolder(router, devAssets, "/")
      await addAssetRoutesForFolder(router, basePath + "/src/public", "/")

      pageRouter.routes.forEach((route) => {
        router.addRoute("GET", route.path, indexRoute)
      })
      router.addRoute("GET", "/peaque-dev.js", peaqueDevJsRoute)
      router.addRoute("GET", "/hmr", hmrConnectHandler)

      const backend = await generateBackendProgram({
        baseDir: basePath,
        importPrefix: "../src/",
      })
      backend.routes.forEach((route) => {
        let apiRoute: Record<HttpMethod, RequestHandler> | null = null
        let middlewares: Array<RequestMiddleware> = []

        route.methods.forEach((method) => {
          const middleware = route.middleware
          router.addRoute(method, route.path, async (req) => {
            if (apiRoute === null) {
              apiRoute = await importWithTsPaths("file:/" + path.join(basePath, route.filePath.replace(/\\/g, "/")) + "?t=" + Date.now(), {
                absWorkingDir: basePath,
              })

              // load all the middlewares
              middlewares = []
              for (const mwPath of middleware) {
                const mw = await importWithTsPaths("file:/" + path.join(basePath, mwPath.replace(/\\/g, "/")) + "?t=" + Date.now(), {
                  absWorkingDir: basePath,
                })
                middlewares.push(mw.middleware)
              }
            }
            req.type("application/json")
            await executeMiddlewareChain(req, middlewares, apiRoute![method])
          })
        })
      })

      currentHandler = router.getRequestHandler()

      notifyConnectedClients()
      const endTime = Date.now()
      console.log(`✅ Application refresh completed in ${endTime - startTime}ms`)
    } finally {
      isRebuilding = false

      // If another rebuild was requested while this one was running, start it now
      if (needsAnotherRun) {
        console.log("🔄 Another rebuild was requested, starting it now...")
        setImmediate(() => rebuildEverything())
      }
    }
  }

  await rebuildEverything()

  const watcher = chokidar.watch(basePath, {
    cwd: basePath,
    ignored: ["dist/**", "build/**", "node_modules/**", ".peaque/**", ".git/**", ".*/**"],
    ignoreInitial: true,
  })

  watcher.on("all", (event, path) => {
    //console.log("🔄 Rebuild triggered (because of changes in src/)", path)
    rebuildEverything()
  })

  const server = new HttpServer(outermostHandler)
  await server.startServer(3000)

  // Cleanup function to dispose of resources
  async function cleanup() {
    server.stop()
    console.log("🧹 Cleaning up resources...")
    await bundler.dispose()
    process.exit(0)
  }

  // Handle process termination signals
  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)
  process.on("SIGUSR2", cleanup) // For nodemon restarts
}
