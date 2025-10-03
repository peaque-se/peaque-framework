import fs from "fs"
import path from "path"
import { buildForProduction } from "../compiler/prod-builder.js"
import { DevServer } from "../server/dev-server.js"

export interface DevCommandOptions {
  basePath: string
  port: number
  strict: boolean
  fullStackTrace: boolean
}

export interface BuildCommandOptions {
  basePath: string
  output: string
  minify: boolean
}

export interface StartCommandOptions {
  basePath: string
  port: number
}

export interface RuntimeDependencies {
  spawn: typeof import("child_process").spawn
  exit: (code?: number) => never
  onSigint: (handler: () => void) => void
}

export async function devCommand(
  options: DevCommandOptions,
  deps?: Partial<RuntimeDependencies>
): Promise<DevServer> {
  const devServer = new DevServer({
    basePath: options.basePath,
    port: options.port,
    noStrict: !options.strict,
    fullStackTrace: options.fullStackTrace
  })

  await devServer.start()

  const exit = deps?.exit || ((code?: number) => process.exit(code))
  const onSigint = deps?.onSigint || ((handler: () => void) => process.on("SIGINT", handler))

  onSigint(() => {
    devServer.stop("SIGINT")
    exit()
  })

  return devServer
}

export async function buildCommand(
  options: BuildCommandOptions,
  deps?: Partial<RuntimeDependencies>
): Promise<void> {
  const exit = deps?.exit || ((code?: number) => process.exit(code))

  try {
    await buildForProduction(options.basePath, options.output, options.minify)
    exit(0)
  } catch (err) {
    console.log("Build error:", err)
    exit(1)
  }
}

export async function startCommand(
  options: StartCommandOptions,
  deps?: Partial<RuntimeDependencies>
): Promise<void> {
  const { spawn: spawnFn = (await import("child_process")).spawn } = deps || {}
  const exit = deps?.exit || ((code?: number) => process.exit(code))
  const onSigint = deps?.onSigint || ((handler: () => void) => process.on("SIGINT", handler))

  const inDist = fs.existsSync(path.join(options.basePath, "dist", "main.cjs"))
  const inSrc = fs.existsSync(path.join(options.basePath, "main.cjs"))
  const cwd = inDist ? path.join(options.basePath, "dist") : options.basePath

  if (!inDist && !inSrc) {
    console.error(
      `No main.cjs found in ${options.basePath} or ${path.join(options.basePath, "dist")}. Please run "peaque build" first.`
    )
    exit(1)
    return
  }

  const child = spawnFn("node", ["./main.cjs", "--port", options.port.toString()], { cwd })

  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)

  child.on("close", (code) => {
    exit(code || 0)
  })

  onSigint(() => {
    child.kill("SIGINT")
    exit(0)
  })
}
