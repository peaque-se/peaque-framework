#!/usr/bin/env node

import { spawn } from "child_process"
import { runDevelopmentServer } from "./dev-server.js"
import { buildForProduction } from "./prod-builder.js"
import path from "path"
import fs from "fs"

const command = process.argv[2]
const args = process.argv.slice(3)
const verbose = args.includes("--verbose") || args.includes("-v")

function showHelp() {
  console.log("Usage: peaque <command> [options]")
  console.log("")
  console.log("Commands:")
  console.log("  dev     Start development server")
  console.log("  build   Build the application for production")
  console.log("  start   Start the production server")
  console.log("")
  console.log("Options:")
  console.log("  -p, --path      Specify the project base path (default: current directory)")
  console.log("  -v, --verbose   Enable verbose logging")
  console.log("  -h, --help      Show this help message")
}

async function main() {
  let basePath = process.cwd()
  const basePathIndex = args.findIndex(arg => arg === "--path" || arg === "-p")
  if (basePathIndex !== -1 && args.length > basePathIndex + 1) {
    basePath = args[basePathIndex + 1]
  }
  if (command === "dev") {
    await runDevelopmentServer(basePath)
  } else if (command === "build") {
    await buildForProduction(basePath)
    process.exit(0)
  } else if (command === "start") {
    console.log(`🚀  Starting @peaque/framework production server for ${basePath}`)

    // determine if main.js exists here or under dist/

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
