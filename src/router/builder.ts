import { RouteNode } from "./router.js"
import { FileSystem, RealFileSystem } from "./utils.js"

function validateExcludes(node: RouteNode) {
  const excludedPages = [...node.staticChildren.values()]
    .filter(c => c.excludeFromPath && c.accept)

  if (excludedPages.length > 1) {
    throw new Error(
      `Ambiguous routes: multiple excluded children with pages under the same parent:\n` +
      excludedPages.map(c => ` - ${c.names}`).join("\n")
    )
  }

  for (const child of node.staticChildren.values()) {
    validateExcludes(child)
  }
}


function createNode(): RouteNode {
  return { staticChildren: new Map(), names: {}, stacks: {}, accept: false }
}

interface RouteSegment {
  raw: string
  type: "static" | "param" | "wildcard" | "exclude"
  name: string
  optional?: boolean
}

function parseSegment(name: string): RouteSegment {
  if (name.startsWith("[") && name.endsWith("]")) {
    const inner = name.slice(1, -1)
    if (inner.startsWith("...")) {
      return { raw: name, type: "wildcard", name: inner.slice(3), optional: false }
    }
    if (inner.startsWith("[...") && inner.endsWith("]")) {
      return { raw: name, type: "wildcard", name: inner.slice(4, -1), optional: true }
    }
    return { raw: name, type: "param", name: inner }
  }
  if (name.startsWith("(") && name.endsWith(")")) {
    return { raw: name, type: "exclude", name: name.slice(1, -1) }
  }
  return { raw: name, type: "static", name }
}

export interface RouteFileConfig {
  pattern: string
  property: string
  stacks: boolean
  accept?: boolean
}

function walkDirectory(
  fs: FileSystem,
  dir: string,
  node: RouteNode,
  config: RouteFileConfig[]
) {
  const entries = fs.readDirectory(dir)

  for (const entry of entries) {
    if (entry.isDirectory) {
      const seg = parseSegment(entry.name)

      let child: RouteNode
      if (seg.type === "param") {
        if (!node.paramChild) {
          node.paramChild = { ...createNode(), paramName: seg.name }
        }
        child = node.paramChild
      } else if (seg.type === "wildcard") {
        if (!node.wildcardChild) {
          node.wildcardChild = { ...createNode(), paramName: seg.name, optional: seg.optional || false }
        }
        child = node.wildcardChild
      } else {
        if (!node.staticChildren.has(seg.raw)) {
          child = createNode()
          if (seg.type === "exclude") {
            child.excludeFromPath = true
          }
          node.staticChildren.set(seg.raw, child)
        } else {
          child = node.staticChildren.get(seg.raw)!
        }
      }

      walkDirectory(fs, entry.path, child, config)
    } else if (entry.isFile) {
      // Check if this file matches any configured patterns
      for (const fileConfig of config) {
        if (entry.name === fileConfig.pattern) {
          if (fileConfig.stacks) {
            // Stacking files go into arrays
            node.stacks[fileConfig.property] = [...(node.stacks[fileConfig.property] || []), entry.path];
          } else {
            // Non-stacking files are single values
            node.names[fileConfig.property] = entry.path;
          }
          if (fileConfig.accept) {
            node.accept = true;
          }
          break // Only match the first config that matches the pattern
        }
      }
    }
  }
}

export function buildRouter(rootDir: string, config?: RouteFileConfig[]): RouteNode
export function buildRouter(rootDir: string, config: RouteFileConfig[], fs: FileSystem): RouteNode
/**
 * Builds a route tree from a directory structure.
 *
 * @param rootDir - The root directory to scan for routes
 * @param config - Configuration for which files to include and how to map them
 * @param fs - Optional filesystem abstraction for testing (defaults to real filesystem)
 * @returns The root RouteNode of the built route tree
 *
 * @example
 * ```typescript
 * import { buildRouter, MockFileSystem } from './builder.js'
 *
 * const mockFs = new MockFileSystem()
 * mockFs.addDirectory('/pages', [
 *   { name: 'page.tsx', isFile: true, isDirectory: false, path: '/pages/page.tsx' }
 * ])
 *
 * const router = buildRouter('/pages', [{ pattern: 'page.tsx', property: 'page', stacks: false, accept: true }], mockFs)
 * ```
 */
export function buildRouter(rootDir: string, config: RouteFileConfig[] = [], fs?: FileSystem): RouteNode {
  const fileSystem = fs || new RealFileSystem()
  const root = createNode()

  walkDirectory(fileSystem, rootDir, root, config)
  validateExcludes(root)
  return root
}
