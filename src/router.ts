import { glob } from 'glob';
import path from 'path';
import { RouteDefinition, RouteHandler, HttpMethod } from './types.js';

export class Router {
  private routes: RouteDefinition[] = [];

  async discoverRoutes(apiDir: string): Promise<RouteDefinition[]> {
    const routeFiles = await glob('**/route.{ts,js}', {
      cwd: apiDir,
      absolute: true
    });

    const routes: RouteDefinition[] = [];

    for (const filePath of routeFiles) {
      const routePath = this.filePathToRoutePath(filePath, apiDir);
      const handlers = await this.loadRouteHandlers(filePath);

      for (const [method, handler] of Object.entries(handlers)) {
        routes.push({
          method: method as HttpMethod,
          path: '/api' + routePath, // Add /api prefix to all API routes
          handler,
          filePath
        });
      }
    }

    this.routes = routes;
    return routes;
  }

  async discoverPages(pagesDir: string): Promise<string[]> {
    const pageFiles = await glob('**/page.{tsx,jsx,ts,js}', {
      cwd: pagesDir,
      absolute: true
    });

    return pageFiles;
  }

  async discoverLayouts(pagesDir: string): Promise<string[]> {
    const layoutFiles = await glob('**/layout.{tsx,jsx,ts,js}', {
      cwd: pagesDir,
      absolute: true
    });

    return layoutFiles;
  }

  async discoverGuards(pagesDir: string): Promise<string[]> {
    const guardFiles = await glob('**/guard.{ts,js}', {
      cwd: pagesDir,
      absolute: true
    });

    return guardFiles;
  }

  private filePathToRoutePath(filePath: string, baseDir: string): string {
    // Convert file path to API route path
    // e.g., /api/users/route.ts -> /api/users
    // e.g., /api/users/[id]/route.ts -> /api/users/:id
    const relativePath = path.relative(baseDir, filePath);
    // Normalize path separators and remove route file extension
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const routePath = '/' + normalizedPath.replace(/\/route\.(ts|js)$/, '').replace(/\[([^\]]+)\]/g, ':$1');

    return routePath || '/';
  }

  private async loadRouteHandlers(filePath: string): Promise<Record<string, RouteHandler>> {
    try {
      // Convert file path to file:// URL for ES modules
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;

      // Clear the module cache for this file in development
      if (process.env.NODE_ENV === 'development') {
        // For ES modules, we need to delete from the import cache
        // This is a bit tricky with ES modules, but we can try to delete it
        try {
          delete require.cache[filePath];
          // Also try to delete the URL version
          if (typeof globalThis !== 'undefined' && (globalThis as any).import) {
            // This is a workaround for clearing ES module cache
            // In practice, this might not work perfectly with all bundlers
          }
        } catch (cacheError) {
          // Cache clearing might fail, but that's okay
        }
      }

      const module = await import(fileUrl + '?t=' + Date.now()); // Add timestamp to force reload
      const handlers: Record<string, RouteHandler> = {};

      // Look for HTTP method exports
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

      for (const method of methods) {
        if (typeof module[method] === 'function') {
          handlers[method] = module[method];
        }
      }

      return handlers;
    } catch (error) {
      console.error(`❌ Error loading route handlers from ${filePath}:`, error);
      return {};
    }
  }

  getRoutes(): RouteDefinition[] {
    return this.routes;
  }

  findRoute(method: HttpMethod, path: string): RouteDefinition | undefined {
    return this.routes.find(route =>
      route.method === method && this.matchPath(route.path, path)
    );
  }

  private matchPath(routePath: string, requestPath: string): boolean {
    // Simple path matching - could be enhanced with more sophisticated routing
    const routeParts = routePath.split('/').filter(Boolean);
    const requestParts = requestPath.split('/').filter(Boolean);

    if (routeParts.length !== requestParts.length) {
      return false;
    }

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const requestPart = requestParts[i];

      if (routePart.startsWith(':')) {
        // Parameter - always matches
        continue;
      }

      if (routePart !== requestPart) {
        return false;
      }
    }

    return true;
  }
}
