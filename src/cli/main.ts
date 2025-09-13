#!/usr/bin/env node

import { runDevelopmentServer } from "./dev-server"

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
  console.log("  -v, --verbose   Enable verbose logging")
  console.log("  -h, --help      Show this help message")
}

async function main() {
  if (command === "dev") {
    await runDevelopmentServer()
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
