///
/// Module to bundle a _generated_main.tsx file into a single "peaque.js" file (and a map file)
/// - return dependencies for HMR analysis
///

import { BuildContext, BuildResult, context } from "esbuild"
import * as fs from "fs"
import * as path from "path"

export interface FrontendBuildOptions {
  entryFile?: string // Optional when entryContent is provided
  entryContent?: string // Content as string instead of file path
  baseDir?: string // Base directory for resolving relative imports (required when using entryContent)
  outputFile?: string // Optional when writeToFile is false
  isDevelopment?: boolean
  sourcemap?: boolean
  minify?: boolean
  define?: Record<string, string>
  alias?: Record<string, string>
  external?: string[]
  /** Whether to write to file or return as string */
  writeToFile?: boolean
}

export interface DependencyInfo {
  /** Absolute path to the dependency file */
  path: string
  /** Size in bytes */
  bytes: number
  /** File extension */
  extension: string
  /** Whether this is a source file (not from node_modules) */
  isSourceFile: boolean
}

export interface FrontendBuildResult {
  success: boolean
  errors?: string[]
  warnings?: string[]
  /** All detected dependency files */
  dependencies?: DependencyInfo[]
  /** Source files only (excluding node_modules and externals) */
  sourceDependencies?: DependencyInfo[]
  /** Build metadata */
  metafile?: Metafile
  /** Bundle content as string (when writeToFile is false) */
  bundleContent?: string
  /** Source map content as string (when writeToFile is false and sourcemap is true) */
  sourceMapContent?: string
}

interface MetafileInput {
  bytes?: number
  imports?: Array<{ path: string }>
}

interface Metafile {
  inputs?: Record<string, MetafileInput>
}

/**
 * Extract dependency information from esbuild metafile
 */
function extractDependencies(
  metafile: Metafile | undefined,
  externalPackages: string[] = []
): {
  dependencies: DependencyInfo[]
  sourceDependencies: DependencyInfo[]
} {
  const dependencies: DependencyInfo[] = []
  const sourceDependencies: DependencyInfo[] = []

  if (!metafile || !metafile.inputs) {
    return { dependencies, sourceDependencies }
  }

  // Collect all external packages for filtering
  const allExternals = new Set(["react", "react-dom", ...externalPackages])

  for (const [inputPath, inputInfo] of Object.entries(metafile.inputs)) {
    // Normalize path to absolute
    const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath)

    const extension = path.extname(absolutePath)
    const bytes = inputInfo.bytes || 0

    const dependency: DependencyInfo = {
      path: absolutePath,
      bytes,
      extension,
      isSourceFile: false,
    }

    dependencies.push(dependency)

    // Check if this is a source file (not from node_modules and not external)
    const isFromNodeModules = absolutePath.includes("node_modules")
    const isExternal = Array.from(allExternals).some((ext) => absolutePath.includes(`node_modules/${ext}`) || absolutePath.includes(`node_modules\\${ext}`))

    if (!isFromNodeModules && !isExternal) {
      dependency.isSourceFile = true
      sourceDependencies.push(dependency)
    }
  }

  // Sort by size (largest first) for easier analysis
  dependencies.sort((a, b) => b.bytes - a.bytes)
  sourceDependencies.sort((a, b) => b.bytes - a.bytes)

  return { dependencies, sourceDependencies }
}

/**
 * Frontend Bundler class that supports incremental builds for better performance
 */
export class FrontendBundler {
  private options: FrontendBuildOptions
  private context: BuildContext | null = null
  private lastResult: BuildResult | null = null

  constructor(options: FrontendBuildOptions) {
    this.options = { ...options }
  }

  /**
   * Update the build options
   */
  updateOptions(newOptions: Partial<FrontendBuildOptions>): void {
    this.options = { ...this.options, ...newOptions }
  }

  /**
   * Initialize the esbuild context for incremental builds
   */
  private async initializeContext(): Promise<void> {
    if (this.context) {
      return // Already initialized
    }

    const { entryFile, entryContent, baseDir, outputFile, isDevelopment = false, sourcemap = true, minify = !isDevelopment, define = {}, alias = {}, external = [], writeToFile = true } = this.options

    // Validate input options
    if (!entryFile && !entryContent) {
      throw new Error("Either entryFile or entryContent must be provided")
    }

    if (entryContent && !baseDir) {
      throw new Error("baseDir must be provided when using entryContent")
    }

    // Ensure output directory exists when writing to file
    if (writeToFile && outputFile) {
      const outputDir = path.dirname(outputFile)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
    }

    // Default environment variables
    const defaultDefines = {
      "process.env.NODE_ENV": isDevelopment ? '"development"' : '"production"',
      ...define,
    }

    // Default aliases for React consistency
    const defaultAliases = {
      react: "react",
      "react-dom": "react-dom",
      ...alias,
    }

    const buildOptions: Parameters<typeof context>[0] = {
      bundle: true,
      format: "esm",
      target: "es2020",
      minify,
      sourcemap,
      sourcesContent: sourcemap,
      sourceRoot: isDevelopment ? "/" : undefined,
      metafile: true,
      define: defaultDefines,
      loader: {
        ".tsx": "tsx",
        ".ts": "ts",
        ".jsx": "jsx",
        ".js": "js",
      },
      jsx: "automatic",
      jsxImportSource: "react",
      alias: defaultAliases,
      external: [
        //        'react',
        //        'react-dom',
        ...external,
      ],
      //      packages: 'external', // Keep node_modules external for performance
      logLevel: "silent", // We'll handle errors ourselves
    }

    // Configure entry point based on input type
    if (entryContent) {
      // Use stdin for string content
      buildOptions.stdin = {
        contents: entryContent,
        loader: "tsx", // Assume TSX for generated main files
        sourcefile: "_generated_main.tsx", // Virtual filename for source maps
        resolveDir: baseDir || process.cwd(),
      }
      buildOptions.absWorkingDir = baseDir
    } else if (entryFile) {
      // Use file path
      buildOptions.entryPoints = [entryFile]
      buildOptions.absWorkingDir = baseDir || path.dirname(entryFile)
    }

    // Configure output based on writeToFile option
    if (writeToFile && outputFile) {
      buildOptions.outfile = outputFile
      buildOptions.write = true
    } else {
      buildOptions.write = false
    }

    this.context = await context(buildOptions)
  }

  /**
   * Perform the initial build
   */
  async build(): Promise<FrontendBuildResult> {
    try {
      await this.initializeContext()

      if (!this.context) {
        return {
          success: false,
          errors: ["Failed to initialize build context"],
        }
      }

      this.lastResult = await this.context.rebuild()

      return this.processBuildResult(this.lastResult)
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      }
    }
  }

  /**
   * Perform an incremental rebuild (much faster for subsequent builds)
   */
  async rebuild(): Promise<FrontendBuildResult> {
    try {
      if (!this.context) {
        // If no context exists, do a full build
        return this.build()
      }

      this.lastResult = await this.context.rebuild()

      return this.processBuildResult(this.lastResult)
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      }
    }
  }

  /**
   * Process the esbuild result into our standardized format
   */
  private processBuildResult(result: BuildResult): FrontendBuildResult {
    // Check for build errors
    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors.map((error) => {
        const location = error.location
        if (location) {
          return `${location.file}:${location.line}:${location.column}: ${error.text}`
        }
        return error.text
      })

      return {
        success: false,
        errors: errorMessages,
      }
    }

    // Collect warnings
    const warnings: string[] = []
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((warning) => {
        const location = warning.location
        if (location) {
          warnings.push(`${location.file}:${location.line}:${location.column}: ${warning.text}`)
        } else {
          warnings.push(warning.text)
        }
      })
    }

    // Extract dependency information from metafile
    const { dependencies, sourceDependencies } = extractDependencies(result.metafile, this.options.external)

    // Extract bundle content when not writing to file
    let bundleContent: string | undefined
    let sourceMapContent: string | undefined

    if (!this.options.writeToFile && result.outputFiles) {
      // Find the main bundle file (usually the first one)
      const mainOutput = result.outputFiles.find((file) => !file.path.endsWith(".map"))
      if (mainOutput) {
        bundleContent = mainOutput.text
      }

      // Find the source map file
      if (this.options.sourcemap) {
        const mapOutput = result.outputFiles.find((file) => file.path.endsWith(".map"))
        if (mapOutput) {
          sourceMapContent = mapOutput.text
        }
      }
    }

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      dependencies,
      sourceDependencies,
      metafile: result.metafile,
      bundleContent,
      sourceMapContent,
    }
  }

  /**
   * Dispose of the build context to free resources
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.dispose()
      this.context = null
      this.lastResult = null
    }
  }

  /**
   * Get the last build result
   */
  getLastResult(): FrontendBuildResult | null {
    if (!this.lastResult) {
      return null
    }
    return this.processBuildResult(this.lastResult)
  }
}

/**
 * Clean esbuild bundler for the _generated_main.tsx file
 * Extracts and simplifies the bundling logic from the framework
 * @deprecated Use FrontendBundler class for better performance with incremental builds
 */
export async function bundleFrontend(options: FrontendBuildOptions): Promise<FrontendBuildResult> {
  const bundler = new FrontendBundler(options)
  try {
    return await bundler.build()
  } finally {
    await bundler.dispose()
  }
}

/**
 * Convenience function to bundle the _generated_main.tsx file
 * This is the main entry point for bundling the generated main file
 */
export async function bundleGeneratedMain(generatedMainPath: string, outputPath: string, options: Partial<Omit<FrontendBuildOptions, "entryFile" | "outputFile">> = {}): Promise<FrontendBuildResult> {
  return bundleFrontend({
    entryFile: generatedMainPath,
    outputFile: outputPath,
    ...options,
  })
}

/**
 * Development build configuration for the _generated_main.tsx file
 */
export async function bundleGeneratedMainDev(generatedMainPath: string, outputPath: string): Promise<FrontendBuildResult> {
  return bundleGeneratedMain(generatedMainPath, outputPath, {
    isDevelopment: true,
    sourcemap: true,
    minify: false,
  })
}

/**
 * Production build configuration for the _generated_main.tsx file
 */
export async function bundleGeneratedMainProd(generatedMainPath: string, outputPath: string): Promise<FrontendBuildResult> {
  return bundleGeneratedMain(generatedMainPath, outputPath, {
    isDevelopment: false,
    sourcemap: true,
    minify: true,
  })
}

/**
 * Bundle the _generated_main.tsx file and return as string (in-memory)
 * This is useful for server-side rendering or when you don't want to write files
 */
export async function bundleGeneratedMainToString(generatedMainPath: string, options: Partial<Omit<FrontendBuildOptions, "entryFile" | "outputFile" | "writeToFile">> = {}): Promise<FrontendBuildResult> {
  return bundleFrontend({
    entryFile: generatedMainPath,
    writeToFile: false,
    ...options,
  })
}

/**
 * Development build configuration that returns bundle as string
 */
export async function bundleGeneratedMainDevToString(generatedMainPath: string): Promise<FrontendBuildResult> {
  return bundleGeneratedMainToString(generatedMainPath, {
    isDevelopment: true,
    sourcemap: true,
    minify: false,
  })
}

/**
 * Production build configuration that returns bundle as string
 */
export async function bundleGeneratedMainProdToString(generatedMainPath: string): Promise<FrontendBuildResult> {
  return bundleGeneratedMainToString(generatedMainPath, {
    isDevelopment: false,
    sourcemap: true,
    minify: true,
  })
}

/**
 * Bundle content from string (no file I/O required)
 * This is useful for in-memory code generation and bundling
 */
export async function bundleContent(content: string, baseDir: string, options: Partial<Omit<FrontendBuildOptions, "entryFile" | "entryContent" | "baseDir">> = {}): Promise<FrontendBuildResult> {
  return bundleFrontend({
    entryContent: content,
    baseDir,
    ...options,
  })
}

/**
 * Development build from string content
 */
export async function bundleContentDev(content: string, baseDir: string): Promise<FrontendBuildResult> {
  return bundleContent(content, baseDir, {
    isDevelopment: true,
    sourcemap: true,
    minify: false,
  })
}

/**
 * Production build from string content
 */
export async function bundleContentProd(content: string, baseDir: string): Promise<FrontendBuildResult> {
  return bundleContent(content, baseDir, {
    isDevelopment: false,
    sourcemap: true,
    minify: true,
  })
}

/**
 * Bundle content from string and return as string (fully in-memory)
 */
export async function bundleContentToString(content: string, baseDir: string, options: Partial<Omit<FrontendBuildOptions, "entryFile" | "entryContent" | "baseDir" | "writeToFile">> = {}): Promise<FrontendBuildResult> {
  return bundleFrontend({
    entryContent: content,
    baseDir,
    writeToFile: false,
    ...options,
  })
}

/**
 * Development build from string content, return as string
 */
export async function bundleContentDevToString(content: string, baseDir: string): Promise<FrontendBuildResult> {
  return bundleContentToString(content, baseDir, {
    isDevelopment: true,
    sourcemap: true,
    minify: false,
  })
}

/**
 * Production build from string content, return as string
 */
export async function bundleContentProdToString(content: string, baseDir: string): Promise<FrontendBuildResult> {
  return bundleContentToString(content, baseDir, {
    isDevelopment: false,
    sourcemap: true,
    minify: true,
  })
}
