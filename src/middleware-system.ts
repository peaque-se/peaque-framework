import { RouteHandler } from './public-types.js';
import path from 'path';
import { importWithTsPaths } from './route-import.js';

export interface MiddlewareFunction {
  (request: any): Promise<void> | void;
}

export interface MiddlewareModule {
  middleware?: MiddlewareFunction;
  default?: MiddlewareFunction;
}

export class MiddlewareSystem {
  private middlewareMap = new Map<string, MiddlewareFunction>();

  async loadMiddleware(middlewareFiles: string[], apiDir: string): Promise<void> {
    for (const filePath of middlewareFiles) {
      try {
        const relativePath = path.relative(apiDir, filePath);
        const middlewareDir = path.dirname(relativePath).replace(/\\/g, '/');
        
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
        const module = await importWithTsPaths(fileUrl + '?t=' + Date.now(), {
          absWorkingDir: process.cwd(),
        }) as MiddlewareModule;
        
        const middlewareFunction = module.middleware || module.default;
        
        if (middlewareFunction && typeof middlewareFunction === 'function') {
          this.middlewareMap.set(middlewareDir, middlewareFunction);
          console.log(`📡 Loaded middleware for path: /${middlewareDir}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load middleware from ${filePath}:`, error);
      }
    }
  }

  // Get all applicable middleware for a route path, ordered from outermost to innermost
  getMiddlewareForRoute(routePath: string): MiddlewareFunction[] {
    const middlewares: MiddlewareFunction[] = [];
    
    // Remove /api prefix and leading slash for consistent path handling
    const cleanPath = routePath.replace(/^\/api\/?/, '');
    const pathParts = cleanPath ? cleanPath.split('/') : [];

    // Check root middleware first (outermost)
    if (this.middlewareMap.has('') || this.middlewareMap.has('.')) {
      const rootMiddleware = this.middlewareMap.get('') || this.middlewareMap.get('.');
      if (rootMiddleware) middlewares.push(rootMiddleware);
    }

    // Check each parent directory for middleware (outermost to innermost)
    for (let i = 1; i <= pathParts.length; i++) {
      const pathSegment = pathParts.slice(0, i).join('/');
      if (this.middlewareMap.has(pathSegment)) {
        middlewares.push(this.middlewareMap.get(pathSegment)!);
      }
    }

    return middlewares;
  }

  // Apply middleware chain to a handler (outermost first)
  applyMiddleware(handler: RouteHandler, middlewares: MiddlewareFunction[]): RouteHandler {
    return async (request: any) => {
      // Run middleware functions in order (outermost to innermost)
      for (const middleware of middlewares) {
        await middleware(request);
        
        // If middleware sent a response, stop the chain
        if ((request as any).sendData !== null) {
          return;
        }
      }
      
      // Run the actual handler
      return handler(request);
    };
  }

  // Convenience method to get middleware-wrapped handler for a route
  wrapHandler(routePath: string, handler: RouteHandler): RouteHandler {
    const middlewares = this.getMiddlewareForRoute(routePath);
    return this.applyMiddleware(handler, middlewares);
  }
}