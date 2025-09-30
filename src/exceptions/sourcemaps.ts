import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping"
import path from "path"
import url from "url"
import colors from "yoctocolors"

const maps = new Map<string, any>()

export function registerSourceMap(filename: string, map: any) {
  maps.set(filename, map)
}

function mapFrame(frame: NodeJS.CallSite): string {
  const file = frame.getFileName()
  const line = frame.getLineNumber()
  const column = frame.getColumnNumber()

  // no file -> no mapping, go
  if (!file) return "<unknown>"

  const map = maps.get(file)

  if (map && line != null && column != null) {
    const consumer = new TraceMap(map)
    const orig = originalPositionFor(consumer, { line, column })
    if (orig.source) {
      // orig.source is a url relative to cwd, make it an absolute path now
      const cwdUrl = url.pathToFileURL(process.cwd() + path.sep)
      const sourceUrl = new url.URL(orig.source, cwdUrl).toString()
      // convert back to a path
      const absolutePath = url.fileURLToPath(sourceUrl)
      // make it relative to cwd
      const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/')

      return `./${relativePath}:${orig.line}:${orig.column}`
    }
  }
  return `${file}:${line}:${column}`
}

export function setupSourceMaps() {
  Error.prepareStackTrace = (err, structuredStackTrace) => {
    const stackTrace: string[] = []

    for (const frame of structuredStackTrace) {
      const functionName = frame.getFunctionName() || "<anonymous>"
      const needle = mapFrame(frame)
      if (needle.includes("/peaque-framework/")) {
        stackTrace.push(`    at ${colors.gray("<@peaque-framework>")}`)
        continue
      }
      stackTrace.push(`    at ${colors.bold(functionName)} (${colors.gray(needle)})`)
    }

    // from the back of the stack, remove all lines that are from node:
    while (stackTrace.length > 0 && (stackTrace[stackTrace.length - 1].includes("node:") || stackTrace[stackTrace.length - 1].includes("/peaque-framework/"))) {
      stackTrace.pop()
    }

    stackTrace.push(`    at ${colors.gray("<@peaque-framework>")}`)

    // fold all duplicate lines into one
    const uniqueStack: string[] = []
    for (let i = 0; i < stackTrace.length; i++) {
      if (i === 0 || stackTrace[i] !== stackTrace[i - 1]) {
        uniqueStack.push(stackTrace[i])
      }
    }

    return `${colors.red(err.name)}: ${colors.yellow(err.message)}\n${uniqueStack.join("\n")}`
  }
}
