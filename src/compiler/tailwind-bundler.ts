/**
 * Module to bundle a CSS file into a single "peaque.css" file using Tailwind 4
 *
 * This module provides functionality to compile and optimize Tailwind CSS files
 * with automatic content scanning and minification.
 */
import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from '@tailwindcss/oxide';
import { createRequire } from "module";
import * as path from "path";

/**
 * Interface for custom resolver functions
 */
interface TailwindResolver {
  (id: string, baseDir: string): string | false;
}

/**
 * Options for CSS bundling
 */
export interface BundleCssOptions {
  /** The CSS content to bundle */
  cssContent: string;
  /** Base path for resolving imports */
  basePath: string;
  /** Whether to minify the output (default: true) */
  minify?: boolean;
  /** Source file path for better error messages (default: basePath + "/src/styles.css") */
  sourceFile?: string;
  /** Custom glob pattern for scanning content (default: '** / *') */
  scanPattern?: string;
}

/**
 * Result of CSS bundling operation
 */
export interface BundleCssResult {
  /** The compiled CSS code */
  code: string;
  /** Any warnings generated during compilation */
  warnings?: string[];
}

// Create a require function to resolve modules from the framework's node_modules
const frameworkRequire = createRequire(import.meta.url);
const frameworkResolve = frameworkRequire.resolve;

/**
 * Bundle a CSS file into a single optimized CSS file using Tailwind 4
 *
 * @param cssContent - The CSS content to bundle
 * @param basePath - Base path for resolving imports
 * @returns Promise resolving to the compiled CSS code
 *
 * @example
 * ```typescript
 * const css = await bundleCssFile("@tailwind base;", "/project/root");
 * console.log(css); // Compiled and minified CSS
 * ```
 */
export async function bundleCssFile(cssContent: string, basePath: string): Promise<string> {
  const result = await bundleCssFileWithOptions({ cssContent, basePath });
  return result.code;
}

/**
 * Bundle a CSS file with detailed options and return comprehensive results
 *
 * @param options - Bundling options
 * @returns Promise resolving to the bundle result with code and warnings
 *
 * @throws {Error} If CSS compilation fails
 * @throws {Error} If basePath is invalid or inaccessible
 *
 * @example
 * ```typescript
 * const result = await bundleCssFileWithOptions({
 *   cssContent: "@tailwind base;",
 *   basePath: "/project/root",
 *   minify: false
 * });
 * console.log(result.code);
 * console.log(result.warnings);
 * ```
 */
export async function bundleCssFileWithOptions(options: BundleCssOptions): Promise<BundleCssResult> {
  const {
    cssContent,
    basePath,
    minify = true,
    sourceFile = path.join(basePath, "src", "styles.css"),
    scanPattern = '**/*'
  } = options;

  // Validate inputs
  if (!cssContent || typeof cssContent !== 'string') {
    throw new Error('cssContent must be a non-empty string');
  }

  if (!basePath || typeof basePath !== 'string') {
    throw new Error('basePath must be a non-empty string');
  }

  // Set up global resolver (like Tailwind's standalone CLI does)
  // This intercepts Tailwind module resolution to use framework's node_modules
  const originalResolver = (globalThis as any).__tw_resolve as TailwindResolver | undefined;

  (globalThis as any).__tw_resolve = (id: string, _baseDir: string): string | false => {
    if (id === "tailwindcss") {
      try {
        return frameworkResolve("tailwindcss/index.css");
      } catch (error) {
        console.error("Failed to resolve tailwindcss:", error);
        return false;
      }
    }
    return false;
  };

  try {
    // Compile the CSS with Tailwind
    const compiler = await compile(cssContent, {
      base: basePath,
      from: sourceFile,
      onDependency: (_dependencyPath: string) => {
        // Optional: Track dependencies for better caching
        // This callback can be used to invalidate caches when dependencies change
      }
    });

    // Scan for CSS candidates in the source files
    const scanner = new Scanner({
      sources: [{
        base: basePath,
        pattern: scanPattern,
        negated: false
      }]
    });

    const candidates = scanner.scan();
    const css = compiler.build(candidates);

    // Optimize the CSS
    const result = optimize(css, {
      minify,
    });

    return {
      code: result.code,
      warnings: []
    };
  } catch (error) {
    // Enhanced error handling with context
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to bundle CSS: ${errorMessage}\nBase path: ${basePath}\nSource file: ${sourceFile}`);
  } finally {
    // Restore the original resolver
    if (originalResolver) {
      (globalThis as any).__tw_resolve = originalResolver;
    } else {
      delete (globalThis as any).__tw_resolve;
    }
  }
}
