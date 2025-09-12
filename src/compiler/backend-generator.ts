///
/// Module to generate a _generated_server.ts file for a Peaque project
/// - support for route.ts files with folder-based routing
/// - support for dynamic route segments like [id]
/// - support for HTTP methods like GET, POST, PUT, DELETE
/// - support for middleware.ts files
///

import * as fs from 'fs';
import { glob } from 'glob';
import * as path from 'path';
import { HttpMethod } from '../http/http-types';

// baseDir is the root of the Peaque project, default to process.cwd()
// route files are expected in baseDir/src/api
export async function generateBackendProgram(options: {
  baseDir?: string // default to process.cwd()
  importPrefix?: string // default to "../src/"
}): Promise<string> {
  const baseDir = options.baseDir || process.cwd()
  const importPrefix = options.importPrefix || "../src/"

  const apiDir = path.join(baseDir, 'src', 'api')

  // Check if api directory exists
  if (!fs.existsSync(apiDir)) {
    throw new Error(`API directory does not exist: ${apiDir}`)
  }

  // Find all route.ts files
  const routeFiles = await glob('**/route.{ts,js}', {
    cwd: apiDir,
    absolute: true
  })

  // Process each route file to extract handlers
  const routeImports: string[] = []
  const routerCalls: string[] = []

  for (const filePath of routeFiles) {
    const relativePath = path.relative(apiDir, filePath)
    const routePath = filePathToRoutePath(relativePath)
    const handlers = await loadRouteHandlers(filePath)

    if (Object.keys(handlers).length === 0) {
      continue // Skip files with no handlers
    }

    // Generate unique alias for this route file
    const alias = generateRouteAlias(relativePath)

    // Collect methods for this file
    const methods = Object.keys(handlers) as HttpMethod[]

    // Generate import statement
    const importPath = importPrefix + path.join('api', relativePath).replace(/\\/g, '/')
    const methodImports = methods.map(method => `${method} as ${alias}${method}`).join(', ')
    routeImports.push(`import { ${methodImports} } from "${importPath}"`)

    // Generate router.addRoute calls
    for (const method of methods) {
      const fullRoutePath = '/api' + routePath
      routerCalls.push(`  router.addRoute("${method}", "${fullRoutePath}", ${alias}${method})`)
    }
  }

  // Generate the complete output
  const imports = [
    `import { Router, HttpServer } from "@peaque/framework/server"`,
    ...routeImports
  ].join('\n')

  const routerFunction = [
    '',
    'export function makeBackendRouter() {',
    '  const router = new Router()',
    ...routerCalls,
    '  return router',
    '}'
  ].join('\n')

  const startupFunction = [
    'const router = makeBackendRouter()',
    'const server = new HttpServer(router)',
    'server.startServer(3000)'
  ].join('\n')

  return imports + routerFunction + '\n\n' + startupFunction
}

function filePathToRoutePath(relativePath: string): string {
  // Convert file path to API route path
  // e.g., users/route.ts -> /users
  // e.g., users/[id]/route.ts -> /users/:id
  // e.g., users/[id]/posts/route.ts -> /users/:id/posts

  const normalizedPath = relativePath.replace(/\\/g, '/')
  let routePath = normalizedPath.replace(/\/route\.(ts|js)$/, '')

  // Convert dynamic segments [param] to :param
  routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1')

  // Ensure it starts with /
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath
  }

  return routePath || '/'
}

function generateRouteAlias(relativePath: string): string {
  // Generate a unique alias from the relative path
  // e.g., users/route.ts -> Users
  // e.g., users/[id]/route.ts -> UsersId
  // e.g., activity-feed/[id]/route.ts -> ActivityFeedId

  const normalizedPath = relativePath.replace(/\\/g, '/')
  const pathWithoutRoute = normalizedPath.replace(/\/route\.(ts|js)$/, '')

  // Split by slashes and process each segment
  const segments = pathWithoutRoute.split('/').filter(Boolean)
  const processedSegments = segments.map(segment => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      // Dynamic segment [id] -> Id
      const param = segment.slice(1, -1)
      return param.charAt(0).toUpperCase() + param.slice(1)
    } else {
      // Regular segment -> PascalCase
      return segment.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join('')
    }
  })

  return processedSegments.join('') || 'Root'
}

async function loadRouteHandlers(filePath: string): Promise<Record<string, any>> {
  try {
    // Read file contents directly instead of using esbuild
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    const handlers: Record<string, any> = {}

    // Look for HTTP method exports using regex - much faster than esbuild!
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']

    for (const method of methods) {
      // Match various export patterns:
      // export function GET(
      // export const GET =
      // export async function GET(
      // export let GET =
      const exportRegex = new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|var)\\s+${method}\\b`, 'm')

      if (exportRegex.test(fileContent)) {
        // Create a dummy function - we just need to know it exists for code generation
        handlers[method] = true
      }
    }

    return handlers
  } catch (error) {
    console.warn(`⚠️  Warning: Could not read route handlers from ${filePath}:`, error)
    return {}
  }
}