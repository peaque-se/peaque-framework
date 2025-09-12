import { config } from 'dotenv';
import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { FrameworkConfig } from './api-router.js';
import { createPeaqueRequestFromFastify, writePeaqueRequestToFastify } from './fastify.js';
import { HeadManager } from './head-manager.js';
import { MiddlewareSystem } from './middleware-system.js';
import { RequestHandler } from './public-types.js';
import { Router } from './router.js';
import { TailwindUtils } from './tailwind.js';

// Load environment variables from .env files
config();

export class PeaqueFramework {
  private fastify: ReturnType<typeof Fastify>;
  private router: Router;
  private headManager: HeadManager;
  private config: Required<FrameworkConfig>;
  private isDev: boolean;
  private routeHandlers: Map<string, RequestHandler> = new Map();
  private middlewareSystem: MiddlewareSystem = new MiddlewareSystem();
  private t0: number;

  constructor(config: FrameworkConfig = {}) {
    this.t0 = Date.now();
    this.isDev = config.dev || false;

    this.config = {
      port: config.port || 3000,
      host: config.host || 'localhost',
      dev: this.isDev,
      pagesDir: config.pagesDir || './pages',
      apiDir: config.apiDir || './api',
      publicDir: config.publicDir || './public',
      buildDir: config.buildDir || './dist',
      logger: config.logger !== undefined ? config.logger : this.isDev,
      betaAccess: config.betaAccess || { enabled: false, secret: 'thisisthesecretcode', cookieName: 'beta-user' }
    };
    this.fastify = Fastify({
      logger: this.config.logger
    });

    // Register content type parsers
    this.fastify.register(import('@fastify/formbody'));
    this.fastify.register(import('@fastify/cookie'));

    this.router = new Router();
    this.headManager = new HeadManager();

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
      await this.setupHeadConfigurations();
      await this.copyHeadAssets(); // Copy icons to serve in dev mode
      await this.setupStaticFiles();
      await this.setupBetaAccess(); // Setup beta access middleware
      await this.setupSPA();

      await this.fastify.listen({
        port: this.config.port,
        host: this.config.host
      });

      console.log(`🚀 Peaque server running on http://${this.config.host}:${this.config.port} after ${(Date.now() - this.t0).toLocaleString('en-US')} ms`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async setupRoutes(): Promise<void> {
    // Discover and load middleware first
    const middlewareFiles = await this.router.discoverMiddleware(this.config.apiDir);
    await this.middlewareSystem.loadMiddleware(middlewareFiles, this.config.apiDir);

    // Discover and register API routes
    const apiRoutes = await this.router.discoverRoutes(this.config.apiDir);

    for (const route of apiRoutes) {
      // Apply middleware to the route handler
      const wrappedHandler = this.middlewareSystem.wrapHandler(route.path, route.handler);

      // Store the wrapped handler for potential reloading
      const routeKey = `${route.method}:${route.path}`;
      this.routeHandlers.set(routeKey, wrappedHandler);

      this.fastify.route({
        method: route.method,
        url: route.path,
        handler: async (fastifyReq: any, fastifyReply: any) => {
          const peaqueRequest = createPeaqueRequestFromFastify(fastifyReq);

          try {

            // Get the current handler (may have been updated via HMR)
            const currentHandler = this.routeHandlers.get(routeKey);
            if (currentHandler) {
              await currentHandler(peaqueRequest);
            } else {
              peaqueRequest.code(500).send({ error: 'Handler not found' });
            }
          } catch (error) {
            console.error(`❌ Error in ${route.method} ${route.path}:`, error);
            peaqueRequest.code(500).send({ error: 'Internal server error' });
          }

          writePeaqueRequestToFastify(peaqueRequest, fastifyReply);
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
      // Re-discover and reload middleware first
      const middlewareFiles = await this.router.discoverMiddleware(this.config.apiDir);
      this.middlewareSystem = new MiddlewareSystem(); // Reset middleware system
      await this.middlewareSystem.loadMiddleware(middlewareFiles, this.config.apiDir);

      // Re-discover API routes
      const apiRoutes = await this.router.discoverRoutes(this.config.apiDir);

      // Update handlers in the map with middleware applied
      for (const route of apiRoutes) {
        const wrappedHandler = this.middlewareSystem.wrapHandler(route.path, route.handler);
        const routeKey = `${route.method}:${route.path}`;
        this.routeHandlers.set(routeKey, wrappedHandler);
      }

    } catch (error) {
      console.error('❌ Failed to reload API routes:', error);
    }
  }

  public async setupHeadConfigurations(): Promise<void> {
    try {
      // Discover head configuration files
      const headFiles = await this.router.discoverHeadFiles(this.config.pagesDir);

      // Load and add head configurations
      for (const filePath of headFiles) {
        const headConfig = await this.router.loadHeadConfig(filePath);
        if (headConfig) {
          // Convert file path to route path for head config mapping
          const routePath = this.headFilePathToRoutePath(filePath, this.config.pagesDir);
          this.headManager.addHeadConfig(routePath, headConfig, filePath);
        }
      }

      // Discover and add icon files from pages directory
      const iconFiles = await this.router.discoverIconFiles(this.config.pagesDir);
      this.headManager.addIconFiles(iconFiles);

    } catch (error) {
      console.warn('⚠️  Warning: Could not setup head configurations:', error);
    }
  }

  private headFilePathToRoutePath(filePath: string, pagesDir: string): string {
    // Convert head file path to route path
    // e.g., /pages/blog/head.ts -> /blog
    // e.g., /pages/head.ts -> /
    const relativePath = path.relative(pagesDir, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Remove head.ts or head.js filename
    let routePath = normalizedPath.replace(/head\.(ts|js)$/, '');

    // Remove trailing slash if exists
    routePath = routePath.replace(/\/$/, '');

    // Convert dynamic segments
    routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');

    // Ensure it starts with /
    if (!routePath.startsWith('/')) {
      routePath = '/' + routePath;
    }

    // Handle empty string -> root path
    if (routePath === '/' || routePath === '') {
      return '/';
    }

    return routePath;
  }

  public async copyHeadAssets(): Promise<void> {
    try {
      // Discover icon files that need to be copied to build directory
      const iconFiles = await this.router.discoverIconFiles(this.config.pagesDir);

      // Copy to correct directory based on dev vs production mode
      const targetDir = this.isDev ? path.join(this.config.buildDir, 'dev') : this.config.buildDir;

      for (const [key, sourcePath] of Object.entries(iconFiles)) {
        const [iconRoutePath, rel, filename] = key.split('_', 3);

        // Preserve folder structure: root icons at root, route-specific icons in subfolders
        let destPath: string;
        if (iconRoutePath === '/') {
          destPath = path.join(targetDir, filename);
        } else {
          // Create subdirectory for route-specific icons (e.g., blog/icon.svg)
          const subDir = path.join(targetDir, iconRoutePath.substring(1)); // Remove leading /
          fs.mkdirSync(subDir, { recursive: true });
          destPath = path.join(subDir, filename);
        }

        try {
          fs.copyFileSync(sourcePath, destPath);
        } catch (error) {
          console.warn(`⚠️  Warning: Could not copy icon file ${filename}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️  Warning: Could not copy head assets:', error);
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

    // In development mode, serve source files for source maps
    if (this.isDev) {
      const projectRoot = path.resolve(this.config.pagesDir, '..');
      const srcDir = path.join(projectRoot, 'src');
      if (fs.existsSync(srcDir)) {
        this.fastify.register(import('@fastify/static'), {
          root: path.resolve(srcDir),
          prefix: '/src/',
          decorateReply: false,
          wildcard: false
        });
      }
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
        // In dev mode, serve the dev HTML with route-specific head configuration
        // Strip query parameters for route matching
        const routePath = request.url.split('?')[0];
        const html = this.generateDevHTML(routePath);
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

  private async setupBetaAccess(): Promise<void> {
    if (!this.config.betaAccess?.enabled) {
      return;
    }

    // Add preHandler hook to check beta access for all routes
    this.fastify.addHook('preHandler', async (request: any, reply: any) => {
      // Skip beta check for the beta verification endpoint
      if (request.url === '/api/beta-verify' && request.method === 'POST') {
        return;
      }

      // Check for beta cookie
      const cookies = request.headers.cookie || '';
      const hasBetaCookie = cookies.split(';').some((cookie: string) => {
        const [name] = cookie.trim().split('=');
        return name === this.config.betaAccess!.cookieName;
      });

      if (!hasBetaCookie) {
        // Serve beta access page
        const betaHtml = this.generateBetaAccessHTML();
        reply.type('text/html').send(betaHtml);
        return;
      }
    });

    // Add beta verification route
    this.fastify.post('/api/beta-verify', async (request: any, reply: any) => {
      const { code } = request.body || {};

      if (code === this.config.betaAccess!.secret) {
        // Set the beta cookie and redirect
        reply
          .setCookie(this.config.betaAccess!.cookieName!, 'true', {
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 30 // 30 days
          })
          .redirect('/');
      } else {
        // Invalid code, redirect back to beta page
        reply.redirect('/');
      }
    });
  }

  private generateDevHTML(routePath: string = '/'): string {
    const publicEnvVars = this.getPublicEnvVars();
    const envScript = this.generateEnvScript(publicEnvVars);

    // Get head configuration for this route
    const headConfig = this.headManager.resolveHeadConfig(routePath);
    const headHTML = this.headManager.generateHeadHTML(headConfig);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
${headHTML}
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

      // Validate TypeScript types
      console.log('🔍 Validating TypeScript types...');
      const typeValidation = await this.validateTypes(mainEntryPath);

      if (!typeValidation.success) {
        console.error('❌ Type validation failed');
        return { success: false, errors: typeValidation.errors };
      }

      console.log('✅ Type validation passed');

      // Setup head configurations for build
      await this.setupHeadConfigurations();

      // Build the frontend
      const buildResult = await this.buildFrontend(mainEntryPath);

      if (!buildResult.success) {
        return { success: false, errors: buildResult.errors };
      }

      // Copy head assets (icons, etc.)
      await this.copyHeadAssets();

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
        sourcemap: true,
        sourcesContent: true,
        sourceRoot: this.isDev ? '/' : undefined,
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
      });

      // Process CSS with Tailwind
      await this.processCSS();

      return { success: true };
    } catch (error: any) {
      return { success: false, errors: [error.message] };
    }
  }

  private generateProdHTML(routePath: string = '/'): string {
    const publicEnvVars = this.getPublicEnvVars();
    const envScript = this.generateEnvScript(publicEnvVars);

    // Get head configuration for this route
    const headConfig = this.headManager.resolveHeadConfig(routePath);
    const headHTML = this.headManager.generateHeadHTML(headConfig);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
${headHTML}
  <link rel="stylesheet" href="/peaque.css">
</head>
<body>
  <div id="peaque"></div>
  ${envScript}
  <script type="module" src="/peaque.js"></script>
</body>
</html>`;
  }

  private generateBetaAccessHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beta Access Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    h1 {
      color: #333;
      margin-bottom: 1rem;
    }
    p {
      color: #666;
      margin-bottom: 2rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    input {
      padding: 0.75rem;
      border: 2px solid #e1e5e9;
      border-radius: 5px;
      font-size: 1rem;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      padding: 0.75rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.3s;
    }
    button:hover {
      background: #5a6fd8;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Beta Access Required</h1>
    <p>Please enter the beta access code to continue.</p>
    <form method="POST" action="/api/beta-verify">
      <input type="text" name="code" placeholder="Enter beta code" required>
      <button type="submit">Access Beta</button>
    </form>
  </div>
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
    const content = `import React from 'react';
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
      <App />
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

  private async validateTypes(mainEntryPath: string): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // Import TypeScript compiler API
      const ts = await import('typescript');

      const projectRoot = path.resolve(this.config.pagesDir, '..');

      // Generate or find tsconfig.json
      const tsconfigPath = await this.generateTsconfigForTypeChecking(projectRoot, mainEntryPath);

      if (tsconfigPath === '') {
        // No tsconfig found or generated, skip type checking
        return { success: true };
      }

      // Read and parse tsconfig.json
      const configFileResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (configFileResult.error) {
        return {
          success: false,
          errors: [`Failed to read TypeScript config: ${configFileResult.error.messageText}`]
        };
      }

      const parsedConfig = ts.parseJsonConfigFileContent(
        configFileResult.config,
        ts.sys,
        path.dirname(tsconfigPath)
      );

      if (parsedConfig.errors.length > 0) {
        const errors = parsedConfig.errors.map(diagnostic =>
          this.formatTypeScriptDiagnostic(diagnostic)
        );
        return { success: false, errors };
      }

      // Create TypeScript program for type checking
      const program = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: parsedConfig.options
      });

      // Get diagnostics (type errors)
      const allDiagnostics = [
        ...program.getConfigFileParsingDiagnostics(),
        ...program.getSyntacticDiagnostics(),
        ...program.getSemanticDiagnostics()
      ].filter(diagnostic => {
        // Filter out certain diagnostics that are not relevant in our build context
        // Skip lib.d.ts related errors and other non-user-code diagnostics
        if (!diagnostic.file) return false;

        const fileName = diagnostic.file.fileName;
        // Skip node_modules and built-in TypeScript library diagnostics
        if (fileName.includes('node_modules') || fileName.includes('lib.') || fileName.includes('typescript/lib')) {
          return false;
        }

        return true;
      });

      if (allDiagnostics.length > 0) {
        const errors = allDiagnostics.map(diagnostic =>
          this.formatTypeScriptDiagnostic(diagnostic)
        );
        return { success: false, errors };
      }

      return { success: true };

    } catch (error: any) {
      return {
        success: false,
        errors: [`TypeScript validation error: ${error.message}`]
      };
    }
  }

  private async generateTsconfigForTypeChecking(projectRoot: string, mainEntryPath: string): Promise<string> {
    const userTsconfigPath = path.join(projectRoot, '..', 'tsconfig.json');

    // If user has their own tsconfig.json, use it
    if (fs.existsSync(userTsconfigPath)) {
      return userTsconfigPath;
    } else {
      console.log('⚠️  No tsconfig.json found, skipping type checking');
      return Promise.resolve('');
    }
  }

  private formatTypeScriptDiagnostic(diagnostic: any): string {
    if (!diagnostic.file) {
      return `TypeScript Error: ${diagnostic.messageText}`;
    }

    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const fileName = path.relative(process.cwd(), diagnostic.file.fileName);
    const messageText = typeof diagnostic.messageText === 'string'
      ? diagnostic.messageText
      : diagnostic.messageText.messageText;

    return `${fileName}(${line + 1},${character + 1}): error TS${diagnostic.code}: ${messageText}`;
  }
}
