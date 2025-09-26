/**
 * Abstraction for Peaque applications, representing the structure
 * of pages, API routes, public files, and other components
 * that can be read from a project base path.
 */

/**
 * Represents a page in the Peaque application.
 * Pages are defined by file-based routing in src/pages/.
 */
export interface PeaquePage {
  /** The route path for the page (e.g., '/', '/about', '/blog/[slug]') */
  path: string;
  /** Absolute path to the page component file (page.tsx) */
  componentPath: string;
  /** Absolute path to the layout file, if present (layout.tsx) */
  layoutPath?: string;
  /** Absolute path to the guard file, if present (guard.ts) */
  guardPath?: string;
  /** Whether this is a dynamic route (contains [param] segments) */
  isDynamic: boolean;
  /** Parameters extracted from dynamic segments */
  params: string[];
}

/**
 * Represents an API route in the Peaque application.
 * API routes are defined in src/api/ with route.ts files.
 */
export interface PeaqueApiRoute {
  /** The API route path (e.g., '/api/users', '/api/posts/[id]') */
  path: string;
  /** HTTP methods supported by this route (e.g., ['GET', 'POST']) */
  methods: string[];
  /** Absolute path to the route handler file (route.ts) */
  handlerPath: string;
  /** Whether this is a dynamic route (contains [param] segments) */
  isDynamic: boolean;
  /** Parameters extracted from dynamic segments */
  params: string[];
}

/**
 * Represents a public file in the Peaque application.
 * Public files are static assets served from src/public/.
 */
export interface PeaquePublicFile {
  /** The public URL path for the file (e.g., '/favicon.ico') */
  path: string;
  /** Absolute path to the actual file on disk */
  filePath: string;
  /** MIME type of the file */
  mimeType: string;
}

/**
 * Represents a job in the Peaque application.
 * Jobs are defined in src/jobs/ for scheduled tasks.
 */
export interface PeaqueJob {
  /** Name of the job */
  name: string;
  /** Absolute path to the job file */
  jobPath: string;
  /** Cron schedule for the job */
  schedule?: string;
}

/**
 * Represents an asset in the Peaque application.
 * Assets are processed files like styles, images, etc.
 */
export interface PeaqueAsset {
  /** Name or identifier of the asset */
  name: string;
  /** Absolute path to the asset file */
  assetPath: string;
  /** Type of asset (e.g., 'style', 'image', 'font') */
  type: string;
}

/**
 * Main abstraction for a Peaque application.
 * This represents the complete structure of an application
 * as discovered from scanning the project base path.
 */
export interface PeaqueApplication {
  /** Base path of the project (where src/ is located) */
  basePath: string;
  /** All discovered pages */
  pages: PeaquePage[];
  /** All discovered API routes */
  apiRoutes: PeaqueApiRoute[];
  /** All discovered public files */
  publicFiles: PeaquePublicFile[];
  /** All discovered jobs */
  jobs: PeaqueJob[];
  /** All discovered assets */
  assets: PeaqueAsset[];
  /** Path to global styles file, if present */
  stylesPath?: string;
  /** Path to environment file, if present */
  envPath?: string;
  /** Path to Tailwind config, if present */
  tailwindConfigPath?: string;
}

