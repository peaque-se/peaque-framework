import { glob } from 'glob';
import path from 'path';
import { RouteDefinition } from './api-router.js';
import { HeadConfig, HttpMethod, RequestHandler } from './public-types.js';
import { importWithTsPaths } from './route-import.js';

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

  async discoverMiddleware(apiDir: string): Promise<string[]> {
    const middlewareFiles = await glob('**/middleware.{ts,js}', {
      cwd: apiDir,
      absolute: true
    });

    return middlewareFiles;
  }

  async discoverHeadFiles(pagesDir: string): Promise<string[]> {
    const headFiles = await glob('**/head.{ts,js}', {
      cwd: pagesDir,
      absolute: true
    });

    return headFiles;
  }

  async discoverIconFiles(pagesDir: string): Promise<{ [key: string]: string }> {
    const iconPatterns = [
      '**/favicon.ico',
      '**/icon.{ico,png,jpg,jpeg,svg}',
      '**/apple-touch-icon.{png,jpg,jpeg}',
      '**/apple-icon.{png,jpg,jpeg}'
    ];

    const iconFiles: { [key: string]: string } = {};

    for (const pattern of iconPatterns) {
      const files = await glob(pattern, {
        cwd: pagesDir,
        absolute: true
      });

      for (const filePath of files) {
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();
        const basename = path.basename(filename, ext);

        // Determine icon type based on filename
        let rel: string;
        if (filename === 'favicon.ico') {
          rel = 'icon';
        } else if (basename.startsWith('apple-touch-icon') || basename.startsWith('apple-icon')) {
          rel = 'apple-touch-icon';
        } else if (basename.startsWith('icon')) {
          rel = 'icon';
        } else {
          rel = 'icon';
        }

        // Convert file path to route path for icon mapping
        const routePath = this.iconFilePathToRoutePath(filePath, pagesDir);
        const iconKey = routePath + '_' + rel + '_' + filename;
        iconFiles[iconKey] = filePath;
      }
    }

    return iconFiles;
  }

  private iconFilePathToRoutePath(filePath: string, pagesDir: string): string {
    // Convert icon file path to route path
    // e.g., /pages/blog/icon.svg -> /blog
    // e.g., /pages/favicon.ico -> /
    const relativePath = path.relative(pagesDir, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Remove icon filename - handle root level files specially
    let routePath = normalizedPath.replace(/(favicon\.ico|icon\.[^\/]+|apple-touch-icon\.[^\/]+|apple-icon\.[^\/]+)$/, '');

    // Remove trailing slash if not root
    routePath = routePath.replace(/\/$/, '');

    // Convert dynamic segments
    routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');

    // Handle empty string or root level -> root path
    if (routePath === '' || routePath === '/') {
      return '/';
    }

    // Ensure it starts with /
    if (!routePath.startsWith('/')) {
      routePath = '/' + routePath;
    }

    return routePath;
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

  async loadHeadConfig(filePath: string): Promise<HeadConfig | null> {
    try {
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
      const module = await importWithTsPaths(fileUrl + '?t=' + Date.now(), {
        absWorkingDir: process.cwd(),
      });

      // Look for default export or named exports
      if (module.default && typeof module.default === 'object') {
        return module.default as HeadConfig;
      }

      // Try to construct HeadConfig from named exports
      const config: HeadConfig = {};
      if (module.title) config.title = module.title;
      if (module.description) config.description = module.description;
      if (module.keywords) config.keywords = module.keywords;
      if (module.author) config.author = module.author;
      if (module.viewport) config.viewport = module.viewport;
      if (module.charset) config.charset = module.charset;
      if (module.icons) config.icons = module.icons;
      if (module.meta) config.meta = module.meta;
      if (module.links) config.links = module.links;
      if (module.scripts) config.scripts = module.scripts;

      return Object.keys(config).length > 0 ? config : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Warning: Could not load head config from ${filePath}: ${errorMessage}`);
      return null;
    }
  }

  private async loadRouteHandlers(filePath: string): Promise<Record<string, RequestHandler>> {
    try {
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
      const module = await importWithTsPaths(fileUrl + '?t=' + Date.now(), {
        absWorkingDir: process.cwd(),
      });
      const handlers: Record<string, RequestHandler> = {};

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
      //error instanceof Error && error.stack && console.error(error.stack);
      throw error;
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
