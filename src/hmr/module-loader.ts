import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { registerSourceMap } from '../exceptions/sourcemaps.js'

type BuildContext = {
  ctx: esbuild.BuildContext
  outfile: string
  buildPromise?: Promise<esbuild.BuildResult>
}

export class ModuleLoader {
  private static importCounter = 0
  private readonly buildContexts = new Map<string, BuildContext>()
  private readonly loadingPromises = new Map<string, Promise<any>>()
  private readonly moduleCache = new Map<string, any>()
  private readonly options: {
    absWorkingDir?: string
    tsconfig?: string
    cacheDir?: string
    aliasAt?: string
  }

  constructor(options: {
    absWorkingDir?: string
    tsconfig?: string
    cacheDir?: string
    aliasAt?: string
  } = {}) {
    this.options = options
  }

  async loadModule<T = any>(modulePath: string, bustCache = true): Promise<T> {
    if (this.loadingPromises.has(modulePath)) {
      return this.loadingPromises.get(modulePath)!
    }
    if (!bustCache && this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath)!
    }
    const loadingPromise = this.compileAndImport(modulePath)
    this.loadingPromises.set(modulePath, loadingPromise)
    try {
      const result = await loadingPromise
      this.moduleCache.set(modulePath, result)
      return result
    } finally {
      this.loadingPromises.delete(modulePath)
    }
  }

  async loadExport<T = any>(modulePath: string, exportName: string, bustCache = true): Promise<T> {
    const module = await this.loadModule(modulePath, bustCache)
    const exportValue = module[exportName]
    if (!exportValue) {
      throw new Error(`Module ${modulePath} does not export '${exportName}'. Available exports: ${Object.keys(module)}`)
    }
    return exportValue
  }

  clearCache(): void {
    this.moduleCache.clear()
    this.loadingPromises.clear()
  }

  getCacheStats(): { cached: number; loading: number } {
    return {
      cached: this.moduleCache.size,
      loading: this.loadingPromises.size
    }
  }

  private async compileAndImport(modulePath: string): Promise<any> {
    const absWorkingDir = this.options.absWorkingDir ?? process.cwd()
    const cacheDir = this.options.cacheDir ?? path.join(absWorkingDir, '.peaque', 'temp')
    const aliasAt = this.options.aliasAt ?? path.join(absWorkingDir, 'src')

    const rawPath = modulePath.split('?')[0]
    const entryPath = path.resolve(absWorkingDir, this.toFilePath(rawPath))
    const outFile = path.join(cacheDir, this.sanitizeFilename(path.relative(absWorkingDir, entryPath)))

    let buildContext = this.buildContexts.get(entryPath)
    if (!buildContext) {
      await fs.promises.mkdir(path.dirname(outFile), { recursive: true })
      const ctx = await esbuild.context({
        entryPoints: [entryPath],
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node20',
        write: true,
        outfile: outFile,
        absWorkingDir,
        sourcemap: 'external',
        // sourceRoot: path.relative(absWorkingDir, path.dirname(entryPath)).replace(/\\/g, '/'),
        // outdir: path.dirname(entryPath),
        tsconfig: this.options.tsconfig,
        alias: { '@': aliasAt, 'react': 'react', 'react-dom': 'react-dom' },
        external: ['react', 'react-dom'],
        packages: 'external',
        logLevel: 'silent'
      })
      buildContext = { ctx, outfile: outFile }
      this.buildContexts.set(entryPath, buildContext)
    }

    if (!buildContext.buildPromise) {
      buildContext.buildPromise = buildContext.ctx.rebuild()
    }
    const buildResult = await buildContext.buildPromise
    buildContext.buildPromise = undefined

    if (buildResult.errors?.length) {
      throw new Error('esbuild compilation failed:\n' + buildResult.errors.map(e => e.text).join('\n'))
    }

    const moduleHref = pathToFileURL(buildContext.outfile).href + `?v=${++ModuleLoader.importCounter}`

    // load the source map and register it
    if (fs.existsSync(outFile + '.map')) {
      const sourceMap = JSON.parse(fs.readFileSync(outFile + '.map', 'utf-8'))
      // patch the sources to be relative to the absWorkingDir
      const orig = JSON.stringify(sourceMap.sources)
      if (sourceMap.sources && Array.isArray(sourceMap.sources)) {
        sourceMap.sources = sourceMap.sources.map((src: string) => {
          const absolutePath = path.resolve(path.dirname(outFile), src)
          const relativeToAbsWorkingDir = path.relative(absWorkingDir, absolutePath)
          return `${relativeToAbsWorkingDir.replace(/\\/g, '/')}`
        })
      }
      registerSourceMap(moduleHref, sourceMap)
    }

    const result = await import(moduleHref)
    fs.unlinkSync(buildContext.outfile)
    fs.unlinkSync(buildContext.outfile + '.map')
    return result
  }

  private toFilePath(raw: string): string {
    try {
      const url = new URL(raw)
      if (url.protocol === 'file:') return fileURLToPath(url)
      if (url.protocol === 'data:') return raw
      throw new Error(`Unsupported URL scheme: ${url.protocol}`)
    } catch {
      return raw
    }
  }

  private sanitizeFilename(filePath: string): string {
    return filePath.replace(/[:\\/]/g, '_') + '.mjs'
  }
}
