import WebSocket, { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import { build } from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PeaqueFramework } from './framework.js';
import { TailwindUtils } from './tailwind.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DevServer {
  private wss: any = null;
  private framework: PeaqueFramework;
  private watcher: chokidar.FSWatcher | null = null;

  constructor(framework: PeaqueFramework) {
    this.framework = framework;
  }

  async start(): Promise<void> {
    await this.setupWebSocket();
    await this.setupFileWatcher();
    await this.setupDevBuild();
  }

  private async setupWebSocket(): Promise<void> {
    this.wss = new WebSocketServer({ port: 24678 });

    this.wss.on('connection', (ws: any) => {
  
      ws.on('message', (message: any) => {
        });

      ws.on('close', () => {
      });
    });

  }

  private async setupFileWatcher(): Promise<void> {
    const config = this.framework.getConfig();

    this.watcher = chokidar.watch([
      path.join(config.pagesDir, '**/*.{ts,tsx,js,jsx}'),
      path.join(config.apiDir, '**/*.{ts,js}'),
      path.join(config.pagesDir, '..', 'styles.css'),
      path.join(config.pagesDir, '..', 'tailwind.config.js')
    ], {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    this.watcher.on('change', async (filePath) => {

      // Determine the type of file that changed
      const isPageFile = filePath.includes(path.sep + 'pages' + path.sep) && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx') || filePath.endsWith('.ts') || filePath.endsWith('.js'));
      const isAPIFile = filePath.includes(path.sep + 'api' + path.sep) && (filePath.endsWith('.ts') || filePath.endsWith('.js'));
      const isCSSFile = filePath.endsWith('.css');
      const isTailwindConfig = filePath.endsWith('tailwind.config.js');

      if (isCSSFile || isTailwindConfig) {
        // Reprocess CSS for CSS/Tailwind changes
        await this.processDevCSS();
        this.notifyClients('css-update', { filePath });
      } else if (isPageFile) {
        // Rebuild the application for page changes
        await this.rebuildApplication();
        this.notifyClients('page-update', { filePath });
      } else if (isAPIFile) {
        // API changes require server-side reload of routes
        await this.reloadAPIRoutes();
        this.notifyClients('api-update', { filePath });
      } else {
        // For other files, do a full reload
        this.notifyClients('reload');
      }
    });

    this.watcher.on('add', (filePath) => {
      this.notifyClients('reload');
    });

    this.watcher.on('unlink', (filePath) => {
      this.notifyClients('reload');
    });
  }

  private async buildHMRClient(): Promise<void> {
    const config = this.framework.getConfig();
    const hmrClientPath = path.join(__dirname, 'client', 'hmr-client.js');
    const outputDir = path.join(config.buildDir, 'dev');
    const outputPath = path.join(outputDir, 'hmr-client.js');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Copy the already built HMR client
    if (fs.existsSync(hmrClientPath)) {
      fs.copyFileSync(hmrClientPath, outputPath);
    } else {
      console.warn('⚠️  HMR client not found at:', hmrClientPath);
    }
  }

  private async setupDevBuild(): Promise<void> {
    const config = this.framework.getConfig();

    // Setup Tailwind CSS for the project (silently)
    const projectRoot = path.resolve(config.pagesDir, '..');
    TailwindUtils.setupTailwindForProject(projectRoot);

    // Generate main entry file
    const mainEntryContent = await this.framework.generateMainEntry();
    const root = config.pagesDir.includes('src') ? path.dirname(projectRoot) : projectRoot;
    const mainEntryPath = path.join(root, '.peaque', '_generated_main.tsx');
    fs.writeFileSync(mainEntryPath, mainEntryContent);

    // Build HMR client
    await this.buildHMRClient();

    // Initial build
    await build({
      entryPoints: [
        mainEntryPath
      ],
      bundle: true,
      outfile: path.join(config.buildDir, 'dev', 'peaque.js'),
      format: 'esm',
      target: 'es2020',
      sourcemap: true,
      sourcesContent: true,
      sourceRoot: '/',
      define: {
        'process.env.NODE_ENV': '"development"'
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
      }
    });

    // Process CSS with Tailwind
    await this.processDevCSS();

  }

  private async rebuildApplication(): Promise<void> {
    const config = this.framework.getConfig();
    const projectRoot = path.resolve(config.pagesDir, '..');
    const root = config.pagesDir.includes('src') ? path.dirname(projectRoot) : projectRoot;
    const mainEntryPath = path.join(root, '.peaque', '_generated_main.tsx');

    // Regenerate main entry file in case routes changed
    const mainEntryContent = await this.framework.generateMainEntry();
    fs.writeFileSync(mainEntryPath, mainEntryContent);

    // Rebuild the application
    await build({
      entryPoints: [
        mainEntryPath
      ],
      bundle: true,
      outfile: path.join(config.buildDir, 'dev', 'peaque.js'),
      format: 'esm',
      target: 'es2020',
      sourcemap: true,
      sourcesContent: true,
      sourceRoot: '/',
      define: {
        'process.env.NODE_ENV': '"development"'
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
      }
    });

  }

  private findMainEntry(): string {
    const config = this.framework.getConfig();
    const possibleEntries = [
      path.join(config.pagesDir, '_app.tsx'),
      path.join(config.pagesDir, '_app.ts'),
      path.join(config.pagesDir, 'index.tsx'),
      path.join(config.pagesDir, 'index.ts'),
      path.join(config.pagesDir, 'main.tsx'),
      path.join(config.pagesDir, 'main.ts')
    ];

    for (const entry of possibleEntries) {
      if (fs.existsSync(entry)) {
        return entry;
      }
    }

    // Default to the first page if no main entry found
    return path.join(config.pagesDir, 'page.tsx');
  }

  private notifyClients(type: string, data?: any): void {
    if (!this.wss) return;

    const message = JSON.stringify({ type, data });

    this.wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private async reloadAPIRoutes(): Promise<void> {
    try {
      await this.framework.reloadAPIRoutes();
    } catch (error) {
      console.error('❌ Failed to reload API routes:', error);
    }
  }

  private async processDevCSS(): Promise<void> {
    const config = this.framework.getConfig();
    const projectRoot = path.resolve(config.pagesDir, '..');
    const cssPath = path.join(projectRoot, 'styles.css');
    const outputPath = path.join(config.buildDir, 'dev', 'peaque.css');

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
      console.error('❌ Dev CSS processing failed:', error.message);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }

    if (this.wss) {
      this.wss.close();
    }
  }
}
