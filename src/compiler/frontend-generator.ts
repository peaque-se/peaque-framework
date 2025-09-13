///
/// Module to generate a _generated_main.tsx file for a Peaque project
/// - support for page.tsx files with folder-based routing
/// - layouts via layout.tsx files in folders
/// - guards via guard.ts files in folders
/// - head components via head.ts files in folders
///

import * as fs from "fs"
import { glob } from "glob"
import * as path from "path"

interface FlatRoute {
  path: string
  page: ComponentImport
  guardStack: ComponentImport[]
  layoutStack: ComponentImport[]
  headStack: ComponentImport[]
}

interface ComponentImport {
  componentName: string
  relativePath: string
  routePath: string
}

interface RouterNode {
  pathPart: string
  page?: ComponentImport
  layout?: ComponentImport
  guard?: ComponentImport
  head?: ComponentImport
  children?: RouterNode[]
}

interface PageRouter {
  root: RouterNode
  routes: FlatRoute[]
}

export async function buildPageRouter(basePath: string): Promise<PageRouter> {
  const root = await buildRouterTree(basePath)
  const routes = flattenRoutes(root)
  return { root, routes }
}

function flattenRoutes(node: RouterNode, parentPath: string = "", parentLayouts: ComponentImport[] = [], parentGuards: ComponentImport[] = [], parentHeads: ComponentImport[] = []): FlatRoute[] {
  const flatRoutes: FlatRoute[] = []
  if (node.page) {
    const path = parentPath + node.pathPart
    flatRoutes.push({
      path: path === "" ? "/" : path,
      page: node.page,
      guardStack: [...parentGuards, node.guard].filter(Boolean) as ComponentImport[],
      layoutStack: [...parentLayouts, node.layout].filter(Boolean) as ComponentImport[],
      headStack: [...parentHeads, node.head].filter(Boolean) as ComponentImport[],
    })
  }
  for (const child of node.children || []) {
    flatRoutes.push(...flattenRoutes(child, parentPath + node.pathPart + "/", [...parentLayouts, node.layout].filter(Boolean) as ComponentImport[], [...parentGuards, node.guard].filter(Boolean) as ComponentImport[], [...parentHeads, node.head].filter(Boolean) as ComponentImport[]))
  }
  return flatRoutes
}

export async function buildRouterTree(basePath: string): Promise<RouterNode> {
  const pagesDir = path.join(basePath, "src", "pages")
  if (!fs.existsSync(pagesDir)) {
    throw new Error(`Pages directory does not exist at path: ${pagesDir}`)
  }
  const globOptions = {
    cwd: pagesDir,
    absolute: true,
  }
  const pageImports = (await glob("**/page.{tsx,jsx,ts,js}", globOptions)).map((f) => makeComponentImport(f, pagesDir)).sort(compareByPath)
  const layoutImports = (await glob("**/layout.{tsx,jsx,ts,js}", globOptions)).map((f) => makeComponentImport(f, pagesDir))
  const guardImports = (await glob("**/guard.{ts,js}", globOptions)).map((f) => makeComponentImport(f, pagesDir))
  const headImports = (await glob("**/head.{ts,js}", globOptions)).map((f) => makeComponentImport(f, pagesDir))

  const layoutMap = new Map(layoutImports.map((f) => [f.routePath, f]))
  const guardMap = new Map(guardImports.map((f) => [f.routePath, f]))
  const headMap = new Map(headImports.map((f) => [f.routePath, f]))

  const nodeMap = new Map<string, RouterNode>()
  function ensureParent(fullPath: string): RouterNode {
    if (nodeMap.has(fullPath)) {
      return nodeMap.get(fullPath)!
    }

    const newNode: RouterNode = {
      pathPart: path.basename(fullPath),
      layout: layoutMap.get(fullPath),
      guard: guardMap.get(fullPath),
      head: headMap.get(fullPath),
      children: [],
    }
    nodeMap.set(fullPath, newNode)

    if (fullPath !== "") {
      const parentNode = ensureParent(path.dirname(fullPath))
      parentNode.children = parentNode.children || []
      parentNode.children.push(newNode)
    }
    return newNode
  }

  for (const page of pageImports) {
    const fileName = path.basename(page.routePath)
    const parentPath = fileName === "" ? "" : path.dirname(page.routePath)
    const parentNode = ensureParent(parentPath)
    parentNode.children = parentNode.children || []
    const newNode = {
      pathPart: fileName,
      page: page,
      layout: layoutMap.get(page.routePath),
      guard: guardMap.get(page.routePath),
      head: headMap.get(page.routePath),
    }
    parentNode.children.push(newNode)
    nodeMap.set(page.routePath, newNode)
  }
  return nodeMap.get("/")!
}

export async function generatePageRouterJS(pageRouter: PageRouter, devMode: boolean = false, importPrefix: string = "../src"): Promise<string> {
  const imports = new Set<string>()
  imports.add("import { createRoot } from 'react-dom/client';")
  imports.add("import { Router } from '@peaque/framework'")
  if (devMode) {
    imports.add("import { StrictMode } from 'react';")
  }

  const routerConfig: string[] = []
  function printRoutes(node: RouterNode, indent: number = 2) {
    const ind = " ".repeat(indent)
    routerConfig.push(ind + "{\n")
    if (node.pathPart && node.pathPart !== "") {
      if (node.pathPart.startsWith(":")) {
        routerConfig.push(`${ind}  param: ${JSON.stringify(node.pathPart.slice(1))},\n`)
      } else {
        routerConfig.push(`${ind}  path: ${JSON.stringify(node.pathPart)},\n`)
      }
    }
    if (node.page) {
      routerConfig.push(`${ind}  page: ${node.page.componentName},\n`)
      imports.add(`import ${node.page.componentName} from '${importPrefix}/pages/${node.page.relativePath}'`)
    }
    if (node.layout) {
      routerConfig.push(`${ind}  layout: ${node.layout.componentName},\n`)
      imports.add(`import ${node.layout.componentName} from '${importPrefix}/pages/${node.layout.relativePath}'`)
    }
    if (node.guard) {
      routerConfig.push(`${ind}  guard: ${node.guard.componentName},\n`)
      imports.add(`import ${node.guard.componentName} from '${importPrefix}/pages/${node.guard.relativePath}'`)
    }
    if (node.head) {
      routerConfig.push(`${ind}  head: ${node.head.componentName},\n`)
      imports.add(`import ${node.head.componentName} from '${importPrefix}/pages/${node.head.relativePath}'`)
    }
    if (node.children && node.children.length > 0) {
      routerConfig.push(`${ind}  children: [\n`)
      node.children.forEach((child) => {
        printRoutes(child, indent + 2)
      })
      routerConfig.push(`${ind}  ],\n`)
    }
    routerConfig.push(`${ind}},\n`)
  }
  printRoutes(pageRouter.root)

  // Generate the main component
  const app = devMode ? "<StrictMode><Router root={root} /></StrictMode>" : "<Router root={root} />"

  const result = `${Array.from(imports).join("\n")}
  const root = ${routerConfig.join("").slice(0, -2)}
  createRoot(document.getElementById('peaque')!).render(${app})`
  return result
}

// Compare two file paths by their directory structure, shortest paths first
function compareByPath(a: ComponentImport, b: ComponentImport): number {
  // if the paths are identical, return 0
  if (a.relativePath === b.relativePath) return 0

  // if one directory is shorter then it comes first
  if (a.routePath.length < b.routePath.length) return -1
  if (a.routePath.length > b.routePath.length) return 1

  // if they are the same length, sort lexicographically
  if (a.relativePath < b.relativePath) return -1
  if (a.relativePath > b.relativePath) return 1
  return 0
}

function makeComponentImport(filePath: string, baseDir: string): ComponentImport {
  const relativePath = path.relative(baseDir, filePath).replace(/\\/g, "/")
  const directory = path.dirname(relativePath)
  const routePath = directory === "." ? "/" : "/" + directory.replace(/\\/g, "/").replace(/\[([^\]]+)\]/g, ":$1")
  const componentName = pathToComponentName(relativePath)
  return { componentName, relativePath, routePath }
}

/**
 * Converts a file path to a component name
 */
function pathToComponentName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/")
  let componentName = normalizedPath
    .replace(/\/page\.(tsx|jsx|ts|js)$/, "")
    .replace(/\/layout\.(tsx|jsx|ts|js)$/, "Layout")
    .replace(/\/guard\.(ts|js)$/, "Guard")
    .replace(/\/head\.(ts|js)$/, "Head")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/^_+|_+$/g, "")

  // Determine the component type and add appropriate suffix
  if (normalizedPath.match(/\/page\.(tsx|jsx|ts|js)$/)) {
    componentName = componentName ? componentName + "_Page" : "Index_Page"
  } else if (normalizedPath.match(/\/layout\.(tsx|jsx|ts|js)$/)) {
    componentName = componentName ? componentName + "_Layout" : "Root_Layout"
  } else if (normalizedPath.match(/\/guard\.(ts|js)$/)) {
    componentName = componentName ? componentName + "_Guard" : "Root_Guard"
  } else if (normalizedPath.match(/\/head\.(ts|js)$/)) {
    componentName = componentName ? componentName + "_Head" : "Root_Head"
  }

  if (!componentName) {
    return "Index"
  }

  // Convert to PascalCase
  return componentName
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("")
}
