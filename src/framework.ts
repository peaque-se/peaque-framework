import Fastify from 'fastify';
import { Router } from './router.js';
import { FrameworkConfig, PeaqueRequest, PeaqueReply, createPeaqueRequest, createPeaqueReply, RouteHandler } from './types.js';
import { TailwindUtils } from './tailwind.js';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env files
config();

export class PeaqueFramework {
  private fastify: ReturnType<typeof Fastify>;
  private router: Router;
  private config: Required<FrameworkConfig>;
  private isDev: boolean;
  private routeHandlers: Map<string, RouteHandler> = new Map();

  constructor(config: FrameworkConfig = {}) {
    this.isDev = config.dev || false;

    this.config = {
      port: config.port || 3000,
      host: config.host || 'localhost',
      dev: this.isDev,
      pagesDir: config.pagesDir || './pages',
      apiDir: config.apiDir || './api',
      publicDir: config.publicDir || './public',
      buildDir: config.buildDir || './dist',
      logger: config.logger !== undefined ? config.logger : this.isDev
    };
    this.fastify = Fastify({
      logger: this.config.logger
    });

    this.router = new Router();

    // Ensure .peaque directory exists
    const peaqueDir = path.dirname(this.config.buildDir);
    fs.mkdirSync(peaqueDir, { recursive: true });

    // Setup Tailwind CSS automatically (silently)
    const projectRoot = path.resolve(this.config.pagesDir, '..');
    TailwindUtils.setupTailwindForProject(projectRoot);
  }

  async start(): Promise<void> {
    try {
      await this.setupRoutes();
      await this.setupStaticFiles();
      await this.setupSPA();

      await this.fastify.listen({
        port: this.config.port,
        host: this.config.host
      });

      console.log(`🚀 Peaque server running on http://${this.config.host}:${this.config.port}`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async setupRoutes(): Promise<void> {
    // Discover and register API routes
    const apiRoutes = await this.router.discoverRoutes(this.config.apiDir);

    for (const route of apiRoutes) {

      // Store the handler for potential reloading
      const routeKey = `${route.method}:${route.path}`;
      this.routeHandlers.set(routeKey, route.handler);

      this.fastify.route({
        method: route.method,
        url: route.path,
        handler: async (fastifyReq: any, fastifyReply: any) => {
          const peaqueReq = createPeaqueRequest(fastifyReq);
          const peaqueReply = createPeaqueReply(fastifyReply);

          try {

            // Get the current handler (may have been updated via HMR)
            const currentHandler = this.routeHandlers.get(routeKey);
            if (currentHandler) {
              await currentHandler(peaqueReq, peaqueReply);

              // Process any cookies set during the request
              const responseCookies = peaqueReq.cookies.getResponseCookies();
              for (const [name, { value, options }] of responseCookies) {
                if (value === '') {
                  // Clear cookie
                  peaqueReply.clearCookie(name, options);
                } else {
                  // Set cookie
                  peaqueReply.setCookie(name, value, options);
                }
              }

              // Clear the response cookies after processing
              peaqueReq.cookies.clearResponseCookies();
            } else {
              peaqueReply.code(500).send({ error: 'Handler not found' });
            }
          } catch (error) {
            console.error(`❌ Error in ${route.method} ${route.path}:`, error);
            peaqueReply.code(500).send({ error: 'Internal server error' });
          }
        }
      });
    }

  }

  async reloadAPIRoutes(): Promise<void> {
    if (!this.isDev) {
      console.warn('⚠️  API route reloading is only available in development mode');
      return;
    }

    try {

      // Re-discover API routes
      const apiRoutes = await this.router.discoverRoutes(this.config.apiDir);

      // Update handlers in the map
      for (const route of apiRoutes) {
        const routeKey = `${route.method}:${route.path}`;
        this.routeHandlers.set(routeKey, route.handler);
      }

    } catch (error) {
      console.error('❌ Failed to reload API routes:', error);
    }
  }

  private async setupStaticFiles(): Promise<void> {
    // Serve built assets first (higher priority in dev mode)
    const assetsDir = this.isDev ? path.join(this.config.buildDir, 'dev') : this.config.buildDir;
    if (fs.existsSync(assetsDir)) {
      this.fastify.register(import('@fastify/static'), {
        root: path.resolve(assetsDir),
        prefix: '/',
        decorateReply: false,
        wildcard: false
      });
    }

    // Serve static files from public directory
    if (fs.existsSync(this.config.publicDir)) {
      this.fastify.register(import('@fastify/static'), {
        root: path.resolve(this.config.publicDir),
        prefix: '/',
        decorateReply: false,
        wildcard: false
      });
    }
  }

  private async setupSPA(): Promise<void> {
    // SPA fallback - serve index.html for page routes only
    this.fastify.setNotFoundHandler(async (request: any, reply: any) => {
      // Don't serve HTML for API routes, static files, or assets
      if (request.url.startsWith('/api/') ||
          request.url.includes('.') || // static files have extensions
          request.url.startsWith('/assets/')) {
        return reply.code(404).send('Not found');
      }

      if (this.isDev) {
        // In dev mode, serve the dev HTML
        const html = this.generateDevHTML();
        reply.type('text/html').send(html);
      } else {
        // In production, serve the built index.html
        const indexPath = path.join(this.config.buildDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          reply.type('text/html').send(fs.readFileSync(indexPath));
        } else {
          reply.code(404).send('Not found');
        }
      }
    });
  }

  private generateDevHTML(): string {
    const publicEnvVars = this.getPublicEnvVars();
    const envScript = this.generateEnvScript(publicEnvVars);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Peaque App</title>
  <link rel="stylesheet" href="/peaque.css">
</head>
<body>
  <div id="peaque"></div>
  ${envScript}
  <script type="module" src="/peaque.js"></script>
  <script type="module" src="/hmr-client.js"></script>
</body>
</html>`;
  }

  async build(): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // Generate main entry file
      const mainEntryContent = await this.generateMainEntry();
      const projectRoot = path.resolve(this.config.pagesDir, '..');
      const root = this.config.pagesDir.includes('src') ? path.dirname(projectRoot) : projectRoot;
      const mainEntryPath = path.join(root, '.peaque', '_generated_main.tsx');
      fs.writeFileSync(mainEntryPath, mainEntryContent);

      // Build the frontend
      const buildResult = await this.buildFrontend(mainEntryPath);

      if (!buildResult.success) {
        return { success: false, errors: buildResult.errors };
      }

      // Generate production HTML
      const html = this.generateProdHTML();
      const indexPath = path.join(this.config.buildDir, 'index.html');
      fs.mkdirSync(this.config.buildDir, { recursive: true });
      fs.writeFileSync(indexPath, html);

      return { success: true };
    } catch (error: any) {
      return { success: false, errors: [error.message] };
    }
  }

  private async buildFrontend(mainEntryPath: string): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const { build } = await import('esbuild');

      // Build the JavaScript/TypeScript
      await build({
        entryPoints: [mainEntryPath],
        bundle: true,
        outfile: path.join(this.config.buildDir, 'peaque.js'),
        format: 'esm',
        target: 'es2020',
        minify: !this.isDev,
        sourcemap: this.isDev,
        define: {
          'process.env.NODE_ENV': this.isDev ? '"development"' : '"production"'
        },
        loader: {
          '.tsx': 'tsx',
          '.ts': 'ts',
          '.jsx': 'jsx',
          '.js': 'js'
        },
        jsx: 'automatic',
        jsxImportSource: 'react',
        alias: {
          // Ensure consistent React resolution
          'react': 'react',
          'react-dom': 'react-dom'
        },
        // Deduplicate React to prevent multiple instances
        conditions: ['react-server']
      });

      // Process CSS with Tailwind
      await this.processCSS();

      return { success: true };
    } catch (error: any) {
      return { success: false, errors: [error.message] };
    }
  }

  private generateProdHTML(): string {
    const publicEnvVars = this.getPublicEnvVars();
    const envScript = this.generateEnvScript(publicEnvVars);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Peaque App</title>
  <link rel="stylesheet" href="/peaque.css">
</head>
<body>
  <div id="peaque"></div>
  ${envScript}
  <script type="module" src="/peaque.js"></script>
</body>
</html>`;
  }

  async generateMainEntry(): Promise<string> {
    const router = this.router;
    
    // Discover all page files, layouts, and guards
    const pageFiles = await router.discoverPages(this.config.pagesDir);
    const layoutFiles = await router.discoverLayouts(this.config.pagesDir);
    const guardFiles = await router.discoverGuards(this.config.pagesDir);
    
    // Generate imports
    const staticImports: string[] = [];
    const layoutComponents: Map<string, string> = new Map();
    const guardFunctions: Map<string, string> = new Map();
    
    // Process layout files
    for (const layoutFile of layoutFiles) {
      const relativePath = path.relative(this.config.pagesDir, layoutFile);
      const layoutName = this.layoutFileToComponentName(relativePath);
      const pagesPrefix = this.config.pagesDir.includes('src') ? '../src/pages/' : '../pages/';
      const importPath = pagesPrefix + relativePath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
      
      staticImports.push(`import ${layoutName} from '${importPath}';`);
      
      // Map directory path to layout component name
      const layoutDir = path.dirname(relativePath).replace(/\\/g, '/');
      layoutComponents.set(layoutDir === '.' ? '' : layoutDir, layoutName);
    }
    
    // Process guard files
    for (const guardFile of guardFiles) {
      const relativePath = path.relative(this.config.pagesDir, guardFile);
      const guardName = this.guardFileToFunctionName(relativePath);
      const pagesPrefix = this.config.pagesDir.includes('src') ? '../src/pages/' : '../pages/';
      const importPath = pagesPrefix + relativePath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
      
      // Import the GUARD function from the guard.ts file
      staticImports.push(`import { GUARD as ${guardName} } from '${importPath}';`);
      
      // Map directory path to guard function name
      const guardDir = path.dirname(relativePath).replace(/\\/g, '/');
      guardFunctions.set(guardDir === '.' ? '' : guardDir, guardName);
    }
    
    // Process page files and build route structure
    const pageRoutes: Map<string, any> = new Map();
    for (const pageFile of pageFiles) {
      const relativePath = path.relative(this.config.pagesDir, pageFile);
      const routePath = this.pageFileToRoutePath(relativePath);
      const componentName = this.pageFileToComponentName(relativePath);
      
      // Generate static import for page
      const pagesPrefix = this.config.pagesDir.includes('src') ? '../src/pages/' : '../pages/';
      const importPath = pagesPrefix + relativePath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
      staticImports.push(`import ${componentName} from '${importPath}';`);
      
      pageRoutes.set(routePath, {
        path: routePath,
        component: componentName,
        pageDir: path.dirname(relativePath).replace(/\\/g, '/')
      });
    }
    
    // Build hierarchical route structure with layouts and guards
    const routeTree = this.buildRouteTree(pageRoutes, layoutComponents, guardFunctions);
    
    // Generate the complete main entry content
    const frameworkPath = '@peaque/framework';
    const content = `import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { Router as ClientRouter } from '${frameworkPath}';

${staticImports.join('\n')}

function App() {

  const routeConfig = ${this.generateRouteConfigCode(routeTree)};

  return (
    <ClientRouter 
      routes={routeConfig} 
      fallback={<div>Loading...</div>} 
    />
  );
}

const root = ReactDOM.createRoot(document.getElementById('peaque')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;
    
    return content;
  }

  private pageFileToRoutePath(relativePath: string): string {
    // Convert page file path to route path
    // e.g., page.tsx -> /
    // e.g., about/page.tsx -> /about
    // e.g., blog/[post]/page.tsx -> /blog/:post
    const routePath = '/' + relativePath
      .replace(/page\.(tsx|jsx|ts|js)$/, '') // Remove page.tsx
      .replace(/^\.$/, '') // Handle root page
      .replace(/\\/g, '/') // Normalize separators
      .replace(/\[([^\]]+)\]/g, ':$1') // Convert [param] to :param
      .replace(/\/$/, ''); // Remove trailing slash
    
    return routePath || '/';
  }

  private pageFileToComponentName(relativePath: string): string {
    // Convert page file path to component name
    // e.g., page.tsx -> HomePage
    // e.g., about/page.tsx -> AboutPage
    // e.g., about/team/page.tsx -> AboutTeamPage
    // e.g., blog/[post]/page.tsx -> BlogPostPage
    // e.g., my-folder/page.tsx -> MyFolderPage
    const parts = relativePath
      .replace(/page\.(tsx|jsx|ts|js)$/, '') // Remove page.tsx
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .map(part => {
        // Handle dynamic routes [param] and convert dashes to camelCase
        const cleanPart = part.replace(/\[([^\]]+)\]/g, '$1');
        // Split by dashes and capitalize each segment
        return cleanPart
          .split('-')
          .map(segment => segment.replace(/^\w/, c => c.toUpperCase()))
          .join('');
      });
    
    if (parts.length === 0) {
      return 'HomePage';
    }
    
    return parts.join('') + 'Page';
  }

  private layoutFileToComponentName(relativePath: string): string {
    // Convert layout file path to component name
    // e.g., layout.tsx -> RootLayout
    // e.g., blog/layout.tsx -> BlogLayout
    // e.g., blog/posts/layout.tsx -> BlogPostsLayout
    // e.g., my-folder/layout.tsx -> MyFolderLayout
    const parts = relativePath
      .replace(/layout\.(tsx|jsx|ts|js)$/, '') // Remove layout.tsx
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .map(part => {
        // Handle dynamic routes [param] and convert dashes to camelCase
        const cleanPart = part.replace(/\[([^\]]+)\]/g, '$1');
        // Split by dashes and capitalize each segment
        return cleanPart
          .split('-')
          .map(segment => segment.replace(/^\w/, c => c.toUpperCase()))
          .join('');
      });
    
    if (parts.length === 0) {
      return 'RootLayout';
    }
    
    return parts.join('') + 'Layout';
  }

  private guardFileToFunctionName(relativePath: string): string {
    // Convert guard file path to function name
    // e.g., guard.ts -> RootGuard
    // e.g., blog/guard.ts -> BlogGuard
    // e.g., blog/posts/guard.ts -> BlogPostsGuard
    // e.g., my-folder/guard.ts -> MyFolderGuard
    const parts = relativePath
      .replace(/guard\.(ts|js)$/, '') // Remove guard.ts
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .map(part => {
        // Handle dynamic routes [param] and convert dashes to camelCase
        const cleanPart = part.replace(/\[([^\]]+)\]/g, '$1');
        // Split by dashes and capitalize each segment
        return cleanPart
          .split('-')
          .map(segment => segment.replace(/^\w/, c => c.toUpperCase()))
          .join('');
      });
    
    if (parts.length === 0) {
      return 'RootGuard';
    }
    
    return parts.join('') + 'Guard';
  }

  private buildRouteTree(pageRoutes: Map<string, any>, layoutComponents: Map<string, string>, guardFunctions: Map<string, string>): any[] {
    const routeTree: any[] = [];
    const rootLayout = layoutComponents.get('');
    
    if (rootLayout) {
      // All routes should be under the root layout
      const rootLayoutRoute = {
        layout: rootLayout,
        children: [] as any[]
      };
      
      // Build the nested structure for all routes under root layout
      for (const [routePath, route] of pageRoutes) {
        this.addRouteToNestedTree(rootLayoutRoute.children, routePath, route, layoutComponents, guardFunctions);
      }
      
      routeTree.push(rootLayoutRoute);
    } else {
      // No root layout - build flat structure
      for (const [routePath, route] of pageRoutes) {
        this.addRouteToNestedTree(routeTree, routePath, route, layoutComponents, guardFunctions);
      }
    }
    
    return routeTree;
  }
  
  private addRouteToNestedTree(tree: any[], routePath: string, route: any, layoutComponents: Map<string, string>, guardFunctions: Map<string, string>): void {
    const pageDir = route.pageDir;
    
    // Find the closest layout for this page by checking parent directories
    let closestLayout = null;
    let closestLayoutPath = '';
    
    // Check the page's directory and all parent directories for layouts
    const pathParts = pageDir === '.' ? [] : pageDir.split('/');
    for (let i = pathParts.length; i >= 0; i--) {
      const checkPath = i === 0 ? '' : pathParts.slice(0, i).join('/');
      if (layoutComponents.has(checkPath) && checkPath !== '') {
        closestLayout = layoutComponents.get(checkPath);
        closestLayoutPath = checkPath;
        break;
      }
    }
    
    // Find the guard for this page by checking the page's directory
    let pageGuard = null;
    if (guardFunctions.has(pageDir)) {
      pageGuard = guardFunctions.get(pageDir);
    }
    
    const pageRoute: any = {
      path: routePath,
      component: route.component
    };
    
    // Add guard to the route if found
    if (pageGuard) {
      pageRoute.guard = pageGuard;
    }
    
    if (closestLayout) {
      // This page belongs under a specific layout
      // Find or create the layout route in the tree
      let layoutRoute = tree.find(r => r.layout === closestLayout);
      
      if (!layoutRoute) {
        layoutRoute = {
          layout: closestLayout,
          children: []
        };
        tree.push(layoutRoute);
      }
      
      // Add the page under this layout
      layoutRoute.children.push(pageRoute);
    } else {
      // Page has no specific layout (or only root layout), add it directly
      tree.push(pageRoute);
    }
  }

  private generateRouteConfigCode(routeTree: any[]): string {
    const formatRoute = (route: any, indent = 4): string => {
      const spaces = ' '.repeat(indent);
      let result = '{\n';
      
      if (route.path) {
        result += `${spaces}  path: '${route.path}',\n`;
      }
      
      if (route.component) {
        result += `${spaces}  component: ${route.component},\n`;
      }
      
      if (route.layout) {
        result += `${spaces}  layout: ${route.layout},\n`;
      }
      
      if (route.guard) {
        result += `${spaces}  guard: ${route.guard},\n`;
      }
      
      if (route.children && route.children.length > 0) {
        result += `${spaces}  children: [\n`;
        result += route.children.map((child: any) => formatRoute(child, indent + 4)).join(',\n');
        result += `\n${spaces}  ]\n`;
      }
      
      result += `${spaces}}`;
      return result;
    };
    
    return '[\n' + routeTree.map(route => formatRoute(route, 4)).join(',\n') + '\n  ]';
  }

  getRouter(): Router {
    return this.router;
  }

  getConfig(): Required<FrameworkConfig> {
    return this.config;
  }

  private async processCSS(): Promise<void> {
    const projectRoot = path.resolve(this.config.pagesDir, '..');
    const cssPath = path.join(projectRoot, 'styles.css');
    const outputPath = path.join(this.config.buildDir, 'peaque.css');

    // Check if styles.css exists
    if (!fs.existsSync(cssPath)) {
      console.log('⚠️  No styles.css found, skipping CSS processing');
      return;
    }

    try {
      // Import PostCSS and plugins dynamically
      const postcss = (await import('postcss')).default;
      const tailwind = (await import('@tailwindcss/postcss')).default;
      const autoprefixer = (await import('autoprefixer')).default;

      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // Check if user has custom tailwind config
      const userConfigPath = path.join(projectRoot, 'tailwind.config.js');
      if (fs.existsSync(userConfigPath)) {
        console.log('🎨 Found custom tailwind.config.js');
      }

      // Process CSS with Tailwind CSS 4 and Autoprefixer
      const result = await postcss([
        tailwind(),
        autoprefixer
      ]).process(cssContent, {
        from: cssPath,
        to: outputPath
      });

      // Write processed CSS
      fs.writeFileSync(outputPath, result.css);

      if (result.warnings && result.warnings().length > 0) {
        result.warnings().forEach((warning: any) => {
          console.warn(`⚠️  CSS Warning: ${warning.text}`);
        });
      }

    } catch (error: any) {
      console.error('❌ CSS processing failed:', error.message);
      throw error;
    }
  }

  private getPublicEnvVars(): Record<string, string> {
    const publicEnvVars: Record<string, string> = {};
    
    // Collect all environment variables that start with PEAQUE_PUBLIC_
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('PEAQUE_PUBLIC_') && typeof value === 'string') {
        publicEnvVars[key] = value;
      }
    }
    
    return publicEnvVars;
  }

  private generateEnvScript(publicEnvVars: Record<string, string>): string {
    const envJson = JSON.stringify(publicEnvVars);
    return `<script>
window.process = window.process || {};
window.process.env = window.process.env || {};
Object.assign(window.process.env, ${envJson});
</script>`;
  }
}
