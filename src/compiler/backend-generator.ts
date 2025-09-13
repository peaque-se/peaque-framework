///
/// Module to generate a _generated_server.ts file for a Peaque project
/// - support for route.ts files with folder-based routing
/// - support for dynamic route segments like [id]
/// - support for HTTP methods like GET, POST, PUT, DELETE
/// - support for middleware.ts files with hierarchical middleware application
///

import * as fs from 'fs';
import { glob } from 'glob';
import * as path from 'path';
import { HttpMethod } from '../http/http-types';

/**
 * Directory structure for organizing routes and middleware
 */
interface DirectoryNode {
  path: string;
  middleware?: string; // relative path to middleware file
  routes: Array<{
    filePath: string;
    relativePath: string;
    routePath: string;
    handlers: Record<string, any>;
  }>;
  children: Map<string, DirectoryNode>;
}

/**
 * Organize route and middleware files by directory structure
 */
async function organizeByDirectory(apiDir: string, routeFiles: string[], middlewareFiles: string[], apiDirPath: string): Promise<DirectoryNode> {
  const root: DirectoryNode = {
    path: '',
    routes: [],
    children: new Map()
  };

  // Process middleware files
  const middlewareMap = new Map<string, string>();
  for (const filePath of middlewareFiles) {
    const relativePath = path.relative(apiDir, filePath);
    const dirPath = path.dirname(relativePath);
    const fullRelativePath = path.join(apiDirPath, relativePath);
    middlewareMap.set(dirPath || '', fullRelativePath);
  }

  // Process route files
  for (const filePath of routeFiles) {
    const relativePath = path.relative(apiDir, filePath);
    const dirPath = path.dirname(relativePath);
    const routePath = filePathToRoutePath(relativePath);
    const handlers = await loadRouteHandlers(filePath);

    if (Object.keys(handlers).length === 0) {
      continue;
    }

    // Find or create directory node
    const dirNode = getOrCreateDirectoryNode(root, dirPath);
    dirNode.routes.push({
      filePath,
      relativePath,
      routePath,
      handlers
    });
  }

  // Add middleware to directory nodes
  for (const [dirPath, middlewarePath] of Array.from(middlewareMap.entries())) {
    const dirNode = getOrCreateDirectoryNode(root, dirPath);
    dirNode.middleware = middlewarePath;
  }

  return root;
}

/**
 * Get or create directory node for the given path
 */
function getOrCreateDirectoryNode(root: DirectoryNode, dirPath: string): DirectoryNode {
  if (!dirPath || dirPath === '.') {
    return root;
  }

  const parts = dirPath.split(path.sep);
  let current = root;

  for (const part of parts) {
    if (!current.children.has(part)) {
      current.children.set(part, {
        path: path.join(current.path, part),
        routes: [],
        children: new Map()
      });
    }
    current = current.children.get(part)!;
  }

  return current;
}

/**
 * Generate a unique alias for middleware import
 */
function generateMiddlewareAlias(dirPath: string): string {
  if (!dirPath || dirPath === '.') {
    return 'RootMiddleware';
  }

  const segments = dirPath.split(path.sep).filter(Boolean);
  const processedSegments = segments.map(segment => {
    return segment.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
  });

  return processedSegments.join('') + 'Middleware';
}
async function generateHierarchicalRouterCode(
  root: DirectoryNode,
  importPrefix: string,
  apiDir: string,
  apiDirPath: string
): Promise<{
  imports: string[];
  routerCalls: string[];
  routes: Array<{ path: string; methods: HttpMethod[]; filePath: string; middleware: string[] }>;
}> {
  const imports: string[] = [`import { Router, HttpServer } from "@peaque/framework/server"`];
  const routerCalls: string[] = [];
  const routes: Array<{ path: string; methods: HttpMethod[]; filePath: string; middleware: string[] }> = [];

  // Generate code for the root router
  await generateRouterForDirectory(root, 'router', imports, routerCalls, routes, importPrefix, apiDir, apiDirPath, 0, []);

  return { imports, routerCalls, routes };
}

/**
 * Recursively generate router code for a directory and its subdirectories
 */
async function generateRouterForDirectory(
  node: DirectoryNode,
  routerVar: string,
  imports: string[],
  routerCalls: string[],
  routes: Array<{ path: string; methods: HttpMethod[]; filePath: string; middleware: string[] }>,
  importPrefix: string,
  apiDir: string,
  apiDirPath: string,
  depth = 0,
  currentMiddleware: string[] = []
): Promise<string> {
  let currentRouterVar = routerVar;

  // Apply middleware if present
  if (node.middleware) {
    const middlewareAlias = generateMiddlewareAlias(node.path);
    const importPath = importPrefix + node.middleware.replace(/\\/g, '/');
    imports.push(`import { default as ${middlewareAlias} } from "${importPath}"`);

    const newRouterVar = `${routerVar}WithMiddleware${depth}`;
    routerCalls.push(`  const ${newRouterVar} = ${currentRouterVar}.use(${middlewareAlias})`);
    currentRouterVar = newRouterVar;

    // Add middleware to the current stack
    currentMiddleware = [...currentMiddleware, node.middleware];
  }

  // Add routes in this directory
  for (const route of node.routes) {
    const alias = generateRouteAlias(route.relativePath);
    const methods = Object.keys(route.handlers) as HttpMethod[];

    // Generate import statement
    const importPath = importPrefix + path.join(apiDirPath, route.relativePath).replace(/\\/g, '/');
    const methodImports = methods.map(method => `${method} as ${alias}${method}`).join(', ');
    imports.push(`import { ${methodImports} } from "${importPath}"`);

    // Generate router.addRoute calls
    for (const method of methods) {
      const fullRoutePath = '/api' + route.routePath;
      routerCalls.push(`  ${currentRouterVar}.addRoute("${method}", "${fullRoutePath}", ${alias}${method})`);
    }

    // Collect route information
    routes.push({ path: '/api' + route.routePath, methods, filePath: path.join(apiDirPath, route.relativePath), middleware: [...currentMiddleware] });
  }

  // Process subdirectories
  for (const [dirName, childNode] of Array.from(node.children.entries())) {
    await generateRouterForDirectory(
      childNode,
      currentRouterVar,
      imports,
      routerCalls,
      routes,
      importPrefix,
      apiDir,
      apiDirPath,
      depth + 1,
      currentMiddleware
    );
  }

  return currentRouterVar;
}

/**
 * Interface for the generated backend program result
 */
interface GeneratedBackendProgram {
  content: string;
  routes: Array<{
    path: string;
    methods: HttpMethod[];
    filePath: string;
    middleware: string[]; // middleware files that apply to this route
  }>;
}

// baseDir is the root of the Peaque project, default to process.cwd()
// route files are expected in baseDir/src/api
export async function generateBackendProgram(options: {
  baseDir?: string // default to process.cwd()
  importPrefix?: string // default to "../src/"
}): Promise<GeneratedBackendProgram> {
  const baseDir = options.baseDir || process.cwd()
  const importPrefix = options.importPrefix || "../src/"
  const apiDirPath = 'src/api'

  const apiDir = path.join(baseDir, apiDirPath)

  // Check if api directory exists
  if (!fs.existsSync(apiDir)) {
    throw new Error(`API directory does not exist: ${apiDir}`)
  }

  // Find all route.ts files
  const routeFiles = await glob('**/route.{ts,js}', {
    cwd: apiDir,
    absolute: true
  })

  // Find all middleware.ts files
  const middlewareFiles = await glob('**/middleware.{ts,js}', {
    cwd: apiDir,
    absolute: true
  })

  // Organize files by directory structure
  const directoryStructure = await organizeByDirectory(apiDir, routeFiles, middlewareFiles, apiDirPath)

  // Generate router code with hierarchical middleware
  const { imports, routerCalls, routes } = await generateHierarchicalRouterCode(directoryStructure, importPrefix, apiDir, apiDirPath)

  // Generate the complete output
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

  const content = imports + routerFunction + '\n\n' + startupFunction

  return { content, routes }
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