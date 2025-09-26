#!/usr/bin/env node

import { spawn } from "child_process"
import { buildForProduction } from "./prod-builder.js"
import path from "path"
import fs from "fs"
import { runFastRefreshServer } from "./fast-refresh-server.js"

const command = process.argv[2]
const args = process.argv.slice(3)
const noStrict = args.includes("--no-strict") || args.includes("-ns")
const portIndex = args.findIndex(arg => arg === "-p" || arg === "--port")
const port = portIndex !== -1 && args.length > portIndex + 1 ? parseInt(args[portIndex + 1], 10) : 3000
let basePath = process.cwd()
const basePathIndex = args.findIndex(arg => arg === "--base" || arg === "-b")
if (basePathIndex !== -1 && args.length > basePathIndex + 1) {
  basePath = args[basePathIndex + 1]
}

function showHelp() {
  console.log("Usage: peaque <command> [options]")
  console.log("")
  console.log("Commands:")
  console.log("  dev     Start development server")
  console.log("  hmr     Start development server with HMR (alias for dev)")
  console.log("  build   Build the application for production")
  console.log("  start   Start the production server")
  console.log("")
  console.log("Options:")
  console.log("  -h, --help            Show this help message")
  console.log("  -b, --base <path>     Specify the project base path (default: current directory)")
  console.log("  -p, --port <port>     Specify the port for the development server (default: 3000)")
  console.log("  -ns, --no-strict      Disable react strict mode")
}

async function main() {
  if (command === "dev" || command === "hmr") {
    await runFastRefreshServer(basePath, port, noStrict)
  } else if (command === "build") {
    await buildForProduction(basePath)
    process.exit(0)
  } else if (command === "start") {
    console.log(`🚀  Starting @peaque/framework production server for ${basePath}`)
    const inDist = fs.existsSync(path.join(basePath, "dist", "main.js"))
    const inSrc = fs.existsSync(path.join(basePath, "main.js"))
    const cwd = inDist ? path.join(basePath, "dist") : basePath
    if (!inDist && !inSrc) {
      console.error(`No main.js found in ${basePath} or ${path.join(basePath, "dist")}. Please run "peaque build" first.`)
      process.exit(1)
    }

    const child = spawn("node", ["./main.js"], { cwd })
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    child.on("close", (code) => {
      process.exit(code)
    })
  } else {
    console.error(`Unknown command: ${command}`)
    showHelp()
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Error running Peaque CLI:", err)
  process.exit(1)
})
