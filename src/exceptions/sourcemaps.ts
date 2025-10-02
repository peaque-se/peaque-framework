/**
 * Source map utilities for enhanced error stack traces.
 *
 * This module provides functionality to register and use source maps for
 * better debugging experience with transpiled code.
 */
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping"
import path from "path"
import url from "url"
import colors from "yoctocolors"

/**
 * Registry of source maps keyed by filename
 */
const maps = new Map<string, any>();

/**
 * Register a source map for a specific file.
 *
 * This allows the error stack trace to map back to original source locations
 * rather than showing transpiled code locations.
 *
 * @param filename - The filename this source map applies to
 * @param map - The source map object
 *
 * @example
 * ```typescript
 * registerSourceMap('/path/to/bundle.js', {
 *   version: 3,
 *   sources: ['original.ts'],
 *   mappings: '...',
 * });
 * ```
 */
export function registerSourceMap(filename: string, map: any): void {
  if (!filename || typeof filename !== 'string') {
    throw new Error('filename must be a non-empty string');
  }
  if (!map || typeof map !== 'object') {
    throw new Error('map must be a valid source map object');
  }
  maps.set(filename, map);
}

/**
 * Clear a registered source map
 *
 * @param filename - The filename to clear the source map for
 * @returns true if a source map was removed, false otherwise
 */
export function unregisterSourceMap(filename: string): boolean {
  return maps.delete(filename);
}

/**
 * Clear all registered source maps
 */
export function clearSourceMaps(): void {
  maps.clear();
}

/**
 * Map a stack frame to its original source location using registered source maps.
 *
 * @param frame - The call site from a stack trace
 * @returns A formatted string with the mapped location
 */
function mapFrame(frame: NodeJS.CallSite): string {
  const file = frame.getFileName();
  const line = frame.getLineNumber();
  const column = frame.getColumnNumber();

  if (frame.isNative()) return "<native>";
  if (frame.isEval()) return "<eval>";
  if (!file) return "<unknown>";

  const map = maps.get(file);

  if (map && line != null && column != null) {
    try {
      const consumer = new TraceMap(map);
      const orig = originalPositionFor(consumer, { line, column });
      if (orig.source) {
        // orig.source is a url relative to cwd, make it an absolute path now
        const cwdUrl = url.pathToFileURL(process.cwd() + path.sep);
        const sourceUrl = new url.URL(orig.source, cwdUrl).toString();
        // convert back to a path
        const absolutePath = url.fileURLToPath(sourceUrl);
        // make it relative to cwd
        const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');

        return `./${relativePath}:${orig.line}:${orig.column}`;
      }
    } catch (error) {
      // If source map parsing fails, fall through to default behavior
      console.error(`Failed to parse source map for ${file}:`, error);
    }
  }
  return `${file}:${line}:${column}`;
}

/**
 * Check if a stack trace line should be excluded from the output.
 *
 * @param line - The stack trace line to check
 * @returns true if the line should be excluded
 */
function shouldExclude(line: string): boolean {
  return line.includes("/peaque-framework/") || line.includes("@peaque/framework");
}

/**
 * Set up enhanced stack traces with source map support.
 *
 * This function overrides Error.prepareStackTrace to provide better error
 * messages with source-mapped locations and colored output. It also filters
 * out framework internals to focus on user code.
 *
 * Should be called once during application initialization.
 *
 * @example
 * ```typescript
 * setupSourceMaps();
 * // Now all errors will have enhanced stack traces
 * ```
 */
export function setupSourceMaps(): void {
  Error.prepareStackTrace = (err: Error, structuredStackTrace: NodeJS.CallSite[]): string => {
    const stackTrace: string[] = [];

    for (const frame of structuredStackTrace) {
      const functionName = frame.getFunctionName() || "<anonymous>";
      const needle = mapFrame(frame);
      if (shouldExclude(needle)) {
        stackTrace.push(`    at ${colors.gray("<@peaque/framework>")}`);
        continue;
      }
      stackTrace.push(`    at ${colors.bold(functionName)} (${colors.gray(needle)})`);
    }

    // from the back of the stack, remove all lines that are from node:
    while (stackTrace.length > 0 && (stackTrace[stackTrace.length - 1].includes("node:") || shouldExclude(stackTrace[stackTrace.length - 1]))) {
      stackTrace.pop();
    }

    stackTrace.push(`    at ${colors.gray("<@peaque/framework>")}`);

    // fold all duplicate lines into one
    const uniqueStack: string[] = [];
    for (let i = 0; i < stackTrace.length; i++) {
      if (i === 0 || stackTrace[i] !== stackTrace[i - 1]) {
        uniqueStack.push(stackTrace[i]);
      }
    }

    return `${colors.red(err.name)}: ${colors.yellow(err.message)}\n${uniqueStack.join("\n")}`;
  };
}
