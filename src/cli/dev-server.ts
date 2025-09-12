//const basePath = process.cwd()

import path from "path"
import * as fs from "fs"
import { bundleContentDevToString } from "../compiler/frontend-bundler"
import { generateMainFile } from "../compiler/frontend-generator"
import { HttpServer, Router } from "../http"
import { PeaqueWebSocket, RequestHandler } from "../public-types"
import { bundleCssFile } from "../compiler/tailwind-bundler"
import { addAssetRoutesForFolder } from "../assets/asset-handler"
import chokidar from "chokidar"
import { cwd } from "process"

// temporarily override to a test project
const basePath = "c:/projects/peaque-claude-experiments/peaque-manager-coach"
const peaquePath = path.join(basePath, ".peaque/")
const devPath = path.join(peaquePath, "dev/")
const devAssets = path.join(devPath, "assets/")
// create all folders if they don't exist
fs.mkdirSync(devAssets, { recursive: true })

let currentHandler: RequestHandler = async (req) => {
  req.code(400).send("Application not ready")
}

const outermostHandler: RequestHandler = async (req) => {
  currentHandler(req)
}

const connectedClients = new Set<PeaqueWebSocket>()

async function rebuildEverything() {
  const startTime = Date.now()
  // Create the client side router bundle
  // prepend a definition of process.env.NODE_ENV
  const jsPrefix = 'window.process = { env: { NODE_ENV: "development" } };'
  const generatedPeaqueJs = await generateMainFile(basePath, true, "./src/")

  const jsBundleResult = await bundleContentDevToString(generatedPeaqueJs, basePath)
  fs.writeFileSync(path.join(devAssets, "peaque.js"), jsPrefix + jsBundleResult.bundleContent!, "utf-8")

  // Create the css bundle
  const stylePath = path.join(basePath, "src/styles.css")
  const cssContent = fs.readFileSync(stylePath, "utf-8")
  const result = await bundleCssFile(cssContent, basePath)
  fs.writeFileSync(path.join(devAssets, "peaque.css"), result, "utf-8")

  // Write the hmr-client.js
  const hmrClientPath = path.join(cwd(), "src/client/hmr-client2.js")
  const hmrClientContent = fs.readFileSync(hmrClientPath, "utf-8")
  fs.writeFileSync(path.join(devAssets, "hmr_client.js"), hmrClientContent, "utf-8")

  // create a basic index.html that loads the peaque.js and peaque.css
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
    <script type="module" src="/hmr_client.js"></script>
    <script type="module" src="/peaque.js"></script>
  </body>
  </html>
  `

  const router = new Router()
  await addAssetRoutesForFolder(router, devAssets, "/")
  router.addRoute("GET", "/", async (req) => {
    req.type("text/html").send(indexHtml)
  })
  router.addRoute("GET", "/hmr", async (req) => {
    // This is a WebSocket upgrade request for HMR
    if (req.isUpgradeRequest()) {
      const ws = await req.upgradeToWebSocket({
        onMessage: (message, ws) => {
        },
        onClose: (code, reason, ws) => {
        },
        onError: (error, ws) => {
        },
      });
      connectedClients.add(ws);
    }
  })
  currentHandler = router.getRequestHandler()
  
  // Notify all connected clients about the update
  connectedClients.forEach((ws) => {
    if (ws.isOpen()) {
      ws.send(JSON.stringify({ type: "reload", data: {} }))
    } else {
      connectedClients.delete(ws)
    }
  })
  const endTime = Date.now()
  console.log(`✅ Rebuild complete in ${endTime - startTime}ms`)
}

await rebuildEverything()

const watcher = chokidar.watch(basePath, {
  cwd: basePath,
  ignored: ["dist/**", "build/**", "node_modules/**", ".peaque/**", ".git/**", ".*/**"],
  ignoreInitial: true,
})

let rebuildTimer: NodeJS.Timeout

watcher.on("all", (event, path) => {
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(async () => {
    console.log("🔄 Rebuild triggered (because of changes in src/)", path)
    await rebuildEverything()
  }, 300) // debounce delay
})

const server = new HttpServer(outermostHandler)
await server.startServer(3000)
