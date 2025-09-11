///
/// Module to generate a _generated_main.tsx file for a Peaque project
/// - support for page.tsx files with folder-based routing
/// - layouts via layout.tsx files in folders
/// - guards via guard.ts files in folders
///

import fs from "fs"
import { glob } from "glob"
import * as path from "path"

/**
 * Converts a file path to a route path
 */
function filePathToRoutePath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/")
  let routePath = normalizedPath.replace(/\/page\.(tsx|jsx|ts|js)$/, "").replace(/\[([^\]]+)\]/g, ":$1")

  // Handle root page.tsx case
  if (routePath === "page.tsx") {
    routePath = ""
  }

  // Ensure the route path starts with /
  const finalPath = routePath ? (routePath.startsWith("/") ? routePath : "/" + routePath) : "/"
  return finalPath
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
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/^_+|_+$/g, "")

  // Determine the component type and add appropriate suffix
  if (normalizedPath.match(/\/page\.(tsx|jsx|ts|js)$/)) {
    componentName = componentName ? componentName + "_Page" : "Index_Page"
  } else if (normalizedPath.match(/\/layout\.(tsx|jsx|ts|js)$/)) {
    componentName = componentName ? componentName + "_Layout" : "Root_Layout"
  } else if (normalizedPath.match(/\/guard\.(ts|js)$/)) {
    componentName = componentName ? componentName + "_Guard" : "Root_Guard"
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

/**
 * Gets the directory for a layout file
 */
function getLayoutDir(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/")
  const dir = normalizedPath.replace(/\/layout\.(tsx|jsx|ts|js)$/, "").replace(/^layout\.(tsx|jsx|ts|js)$/, "") || "/"
  return dir.startsWith("/") ? dir : "/" + dir
}

/**
 * Gets the directory for a guard file
 */
function getGuardDir(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/")
  const dir = normalizedPath.replace(/\/guard\.(ts|js)$/, "") || "/"
  return dir.startsWith("/") ? dir : "/" + dir
}

/**
 * Builds a hierarchical route tree with layouts and guards
 */
function buildRouteTree(routes: string[], layoutMap: Map<string, string>, guardMap: Map<string, string>): any[] {
  const routeTree: any[] = []
  const rootLayout = layoutMap.get("/")

  // Parse routes into objects
  const parsedRoutes: any[] = []
  for (const route of routes) {
    const routeMatch = route.match(/path: '([^']+)', component: ([^,]+)}/)
    if (routeMatch) {
      const routePath = routeMatch[1]
      const componentName = routeMatch[2].trim()
      parsedRoutes.push({
        path: routePath,
        component: componentName,
        pageDir: getPageDirFromRoute(routePath),
      })
    }
  }

  if (rootLayout) {
    // All routes should be under the root layout
    const rootLayoutRoute = {
      layout: rootLayout,
      children: [] as any[],
    }

    // Build the nested structure for all routes under root layout
    for (const route of parsedRoutes) {
      addRouteToNestedTree(rootLayoutRoute.children, route.path, route, layoutMap, guardMap)
    }

    routeTree.push(rootLayoutRoute)
  } else {
    // No root layout - build flat structure
    for (const route of parsedRoutes) {
      addRouteToNestedTree(routeTree, route.path, route, layoutMap, guardMap)
    }
  }

  return routeTree
}

/**
 * Gets the page directory from a route path
 */
function getPageDirFromRoute(routePath: string): string {
  // Remove leading slash and split by /
  const parts = routePath.replace(/^\//, "").split("/").filter(Boolean)

  if (parts.length <= 1) {
    return "." // Root level pages
  }

  // Remove the last part (the page name) to get the directory
  const dirParts = parts.slice(0, -1)

  // Handle dynamic routes by removing parameter parts
  const cleanDirParts = dirParts.filter((part) => !part.startsWith(":"))

  return cleanDirParts.length > 0 ? cleanDirParts.join("/") : "."
}

/**
 * Adds a route to the nested tree structure
 */
function addRouteToNestedTree(tree: any[], routePath: string, route: any, layoutMap: Map<string, string>, guardMap: Map<string, string>): void {
  const pageDir = route.pageDir

  // Find the closest layout for this page by checking parent directories
  let closestLayout = null
  let closestLayoutPath = ""

  // Check the page's directory and all parent directories for layouts
  const pathParts = pageDir === "." ? [] : pageDir.split("/")
  for (let i = pathParts.length; i >= 0; i--) {
    const checkPath = i === 0 ? "/" : "/" + pathParts.slice(0, i).join("/")
    if (layoutMap.has(checkPath)) {
      closestLayout = layoutMap.get(checkPath)
      closestLayoutPath = checkPath
      break
    }
  }

  // Find the guard for this page by checking the page's directory
  let pageGuard = null
  const guardDir = pageDir === "." ? "/" : "/" + pageDir
  if (guardMap.has(guardDir)) {
    pageGuard = guardMap.get(guardDir)
  }

  const pageRoute: any = {
    path: routePath,
    component: route.component,
  }

  // Add guard to the route if found
  if (pageGuard) {
    pageRoute.guard = pageGuard
  }

  if (closestLayout && closestLayoutPath !== "/") {
    // This page belongs under a specific layout (not root)
    // Find or create the layout route in the tree
    let layoutRoute = tree.find((r: any) => r.layout === closestLayout)

    if (!layoutRoute) {
      layoutRoute = {
        layout: closestLayout,
        children: [],
      }
      tree.push(layoutRoute)
    }

    // Add the page under this layout
    layoutRoute.children.push(pageRoute)
  } else {
    // Page has no specific layout, add it directly (will be under root layout if it exists)
    tree.push(pageRoute)
  }
}

/**
 * Generates route configuration code from the route tree
 */
function generateRouteConfigCode(routeTree: any[]): string {
  const formatRoute = (route: any, indent = 4): string => {
    const spaces = " ".repeat(indent)
    const innerSpaces = " ".repeat(indent + 2)
    let properties: string[] = []

    if (route.path) {
      properties.push(`${innerSpaces}path: '${route.path}'`)
    }

    if (route.component) {
      properties.push(`${innerSpaces}component: ${route.component}`)
    }

    if (route.layout) {
      properties.push(`${innerSpaces}layout: ${route.layout}`)
    }

    if (route.guard) {
      properties.push(`${innerSpaces}guard: ${route.guard}`)
    }

    if (route.children && route.children.length > 0) {
      const childrenCode = route.children.map((child: any) => formatRoute(child, indent + 4)).join(",\n")
      properties.push(`${innerSpaces}children: [\n${childrenCode}\n${innerSpaces}]`)
    }

    return `${spaces}{\n${properties.join(",\n")}\n${spaces}}`
  }

  if (routeTree.length === 0) {
    return "[]"
  }

  return `[\n${routeTree.map((route) => formatRoute(route, 4)).join(",\n")}\n]`
}

/**
 * Generates a _generated_main.tsx file for a Peaque project
 * @param basePath - The base path of the Peaque project
 * @param importPrefix - The prefix to use for import paths (default: "../src/")
 */
export async function generateMainFile(basePath: string, devMode: boolean, importPrefix: string = "../src/"): Promise<string> {
  const pagesDir = path.join(basePath, "src", "pages")

  // throw exception if a pages directory does not exist
  if (!fs.existsSync(pagesDir)) {
    throw new Error(`Pages directory does not exist at path: ${pagesDir}`)
  }

  // Find all page files
  const pageFiles = await glob("**/page.{tsx,jsx,ts,js}", {
    cwd: pagesDir,
    absolute: true,
  })

  // Find layout files
  const layoutFiles = await glob("**/layout.{tsx,jsx,ts,js}", {
    cwd: pagesDir,
    absolute: true,
  })

  // Find guard files
  const guardFiles = await glob("**/guard.{ts,js}", {
    cwd: pagesDir,
    absolute: true,
  })

  // Generate imports and route definitions
  const imports: string[] = []
  const routes: string[] = []

  // Import the Router
  imports.push("import { Router } from '@peaque/framework';")

  // Process page files
  for (const filePath of pageFiles) {
    const relativePath = path.relative(pagesDir, filePath)
    const routePath = filePathToRoutePath(relativePath)
    const componentName = pathToComponentName(relativePath)

    // Generate import statement
    const importPath = `${importPrefix}pages/${relativePath.replace(/\\/g, "/").replace(/\.(tsx|jsx|ts|js)$/, "")}`
    imports.push(`import ${componentName} from '${importPath}';`)

    // Generate route definition
    routes.push(`  { path: '${routePath}', component: ${componentName} },`)
  }

  // Process layout files
  const layoutMap = new Map<string, string>()
  for (const filePath of layoutFiles) {
    const relativePath = path.relative(pagesDir, filePath)
    const layoutName = pathToComponentName(relativePath)
    const importPath = `${importPrefix}pages/${relativePath.replace(/\\/g, "/").replace(/\.(tsx|jsx|ts|js)$/, "")}`

    imports.push(`import ${layoutName} from '${importPath}';`)
    layoutMap.set(getLayoutDir(relativePath), layoutName)
  }

  // Process guard files
  const guardMap = new Map<string, string>()
  for (const filePath of guardFiles) {
    const relativePath = path.relative(pagesDir, filePath)
    const guardName = pathToComponentName(relativePath)
    const importPath = `${importPrefix}pages/${relativePath.replace(/\\/g, "/").replace(/\.(ts|js)$/, "")}`

    imports.push(`import ${guardName} from '${importPath}';`)
    guardMap.set(getGuardDir(relativePath), guardName)
  }

  // Apply layouts and guards to routes - build hierarchical structure
  const routeTree = buildRouteTree(routes, layoutMap, guardMap)

  // Add StrictMode import if devMode
  if (devMode) {
    imports.splice(1, 0, "import { StrictMode } from 'react';")
  }

  // Generate the main component
  const app = devMode ? "<StrictMode><Router routes={routes} /></StrictMode>" : "<Router routes={routes} />"
  const mainContent = `import { createRoot } from 'react-dom/client';
${imports.join("\n")}

const routes = ${generateRouteConfigCode(routeTree)};

  createRoot(document.getElementById('peaque')!).render(${app});
`

  return mainContent
}
