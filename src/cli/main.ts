#!/usr/bin/env node

import { runDevelopmentServer } from "./dev-server.js"

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
    console.log("Build command is not yet implemented.")
    process.exit(1)
  } else if (command === "start") {
    console.log("Start command is not yet implemented.")
    process.exit(1)
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
