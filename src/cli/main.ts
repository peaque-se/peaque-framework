#!/usr/bin/env node

import { spawn } from "child_process"
import { Command } from "commander"
import fs from "fs"
import path from "path"
import { buildForProduction } from "../compiler/prod-builder.js"
import { DevServer } from "../server/dev-server.js"
import { platformVersion } from "../server/version.js"

const program = new Command()
program.name("peaque").description("Peaque Framework CLI").version(platformVersion)

program
  .command("dev")
  .description("Start development server")
  .option("-p, --port <port>", "change the port for the development server", "3000")
  .option("-b, --base <path>", "load project from other base path (default: current directory)")
  .option("-n, --no-strict", "disable react strict mode", true)
  .option("--full-stack-traces", "enable full stack traces")
  .action(function () {
    const path = this.opts().base || process.cwd()
    const options = {
      basePath: path,
      port: parseInt(this.opts().port || "3000", 10),
      noStrict: this.opts().noStrict,
      fullStackTrace: this.opts().fullStackTraces || false
    }
    const devServer = new DevServer(options)
    devServer.start()
    process.on("SIGINT", () => {
      devServer.stop("SIGINT")
      process.exit()
    })
  })

program
  .command("build")
  .description("Build the application for production")
  .option("-o, --output <output>", "specify the output directory (default: ./dist)")
  .option("-b, --base <path>", "load project from other base path (default: current directory)")
  .action(function () {
    const basePath = this.opts().base || process.cwd()
    buildForProduction(basePath, this.opts().output || path.join(basePath, "dist"))
      .then(() => {
        process.exit(0)
      })
      .catch((err) => {
        console.log("Build error:", err)
        process.exit(1)
      })
  })

program
  .command("start")
  .description("Start the production server")
  .option("-b, --base <path>", "load project from other base path (default: current directory)")
  .option("-p, --port <port>", "change the port for the production server", "3000")
  .action(function () {
    const basePath = this.opts().base || process.cwd()
    const inDist = fs.existsSync(path.join(basePath, "dist", "main.cjs"))
    const inSrc = fs.existsSync(path.join(basePath, "main.cjs"))
    const cwd = inDist ? path.join(basePath, "dist") : basePath
    if (!inDist && !inSrc) {
      console.error(`No main.cjs found in ${basePath} or ${path.join(basePath, "dist")}. Please run "peaque build" first.`)
      process.exit(1)
    }
    const child = spawn("node", ["./main.cjs", "--port", this.opts().port], { cwd })
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    child.on("close", (code) => {
      process.exit(code)
    })
    process.on("SIGINT", () => {
      child.kill("SIGINT")
      process.exit(0)
    })
  })

program.parse(process.argv)
