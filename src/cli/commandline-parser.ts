import { Command, Option } from "commander"
import path from "path"
import { platformVersion } from "../server/version.js"
import type { DevCommandOptions, BuildCommandOptions, StartCommandOptions } from "./commands.js"
import type { DevServer } from "../server/dev-server.js"

export function createCommandLineParser(
  devCommand: (options: DevCommandOptions) => Promise<DevServer>,
  buildCommand: (options: BuildCommandOptions) => Promise<void>,
  startCommand: (options: StartCommandOptions) => Promise<void>
) {
  const program = new Command()
  program.name("peaque").description("Peaque Framework CLI").version(platformVersion)
  
  program
    .command("dev")
    .description("Start development server")
    .option("-p, --port <port>", "change the port for the development server", "3000")
    .option("-b, --base <path>", "load project from other base path (default: current directory)")
    .option("-n, --no-strict", "disable react strict mode")
    .addOption(new Option("--full-stack-traces", "enable full stack traces").hideHelp())
    .action(async function () {
      const opts = this.opts()
      await devCommand({
        basePath: opts.base || process.cwd(),
        port: parseInt(opts.port, 10),
        strict: opts.strict !== false, // --no-strict sets strict to false
        fullStackTrace: opts.fullStackTraces || false
      })
    })
  
  program
    .command("build")
    .description("Build the application for production")
    .option("-o, --output <output>", "specify the output directory (default: ./dist)")
    .option("-b, --base <path>", "load project from other base path (default: current directory)")
    .addOption(new Option("--no-minify", "disable code minification").hideHelp())
    .action(async function () {
      const opts = this.opts()
      const basePath = opts.base || process.cwd()
      await buildCommand({
        basePath,
        output: opts.output || path.join(basePath, "dist"),
        minify: opts.minify !== false // --no-minify sets minify to false
      })
    })
  
  program
    .command("start")
    .description("Start the production server")
    .option("-b, --base <path>", "load project from other base path (default: current directory)")
    .option("-p, --port <port>", "change the port for the production server", "3000")
    .action(async function () {
      const opts = this.opts()
      await startCommand({
        basePath: opts.base || process.cwd(),
        port: parseInt(opts.port, 10)
      })
    })
  
  return program
}