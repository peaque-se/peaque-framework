import { glob } from 'glob';
import path from 'path';
import { build } from 'esbuild';
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
      // Use esbuild to transform the module and resolve aliases
      const result = await build({
        entryPoints: [filePath],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
        target: 'node18',
        sourcemap: false,
        minify: false,
        external: ['@peaque/framework'], // Don't bundle the framework itself
        banner: {
          js: '// Built by Peaque Framework'
        },
        logLevel: 'silent' // Suppress esbuild output
      });

      // Check for build errors
      if (result.errors.length > 0) {
        const error = result.errors[0];
        console.error(`❌ Build error in ${filePath}: ${error.text}`);
        if (error.location) {
          console.error(`   at ${error.location.file}:${error.location.line}:${error.location.column}`);
        }
        return {};
      }

      const code = result.outputFiles[0].text;

      // Create a data URL for the transformed code
      const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

      const module = await import(dataUrl);
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
      // Extract meaningful error information without full code dump
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error loading route handlers from ${filePath}: ${errorMessage}`);
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
