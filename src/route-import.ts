// import-with-ts-paths.ts
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

// Optional: enable tsconfig paths (uncomment plugin block below)
// import * as tsconfigPathsNS from '@esbuild-plugins/tsconfig-paths'
// const tsconfigPaths = (tsconfigPathsNS as any).default ?? (tsconfigPathsNS as any)

type Ctx = { ctx: esbuild.BuildContext, outfile: string }
const contexts = new Map<string, Ctx>() // one context per entry file
let bust = 0 // to bypass Node's ESM cache

function toFilePath(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol === 'file:') return fileURLToPath(u)
    // Allow "data:" for completeness, but we won't use it here
    if (u.protocol === 'data:') return raw
    throw new Error(`Unsupported URL scheme: ${u.protocol}`)
  } catch {
    // not a URL -> treat as path
    return raw
  }
}

function sanitizeFilename(p: string) {
  // Stable filename for outfile inside cache dir
  return p.replace(/[:\\/]/g, '_') + '.mjs'
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true })
}

/**
 * Fast runtime importer with path aliases + incremental rebuilds.
 *
 * @param rawFileUrl file path or file:// URL (may include ?t=...)
 * @param options    { absWorkingDir, tsconfig, cacheDir, aliasAt }
 */
export async function importWithTsPaths(
  rawFileUrl: string,
  options?: {
    absWorkingDir?: string
    tsconfig?: string
    cacheDir?: string
    aliasAt?: string // defaults to <absWorkingDir>/src for "@/..."
  }
) {
  const absWorkingDir = options?.absWorkingDir ?? process.cwd()
  const tsconfig = options?.tsconfig
  const cacheDir = options?.cacheDir ?? path.join(absWorkingDir, '.peaque-cache', 'bundles')
  const aliasAt = options?.aliasAt ?? path.join(absWorkingDir, 'src')

  // Strip query (e.g. ?t=...) for filesystem work; keep it only for cache-busting import
  const rawNoQuery = rawFileUrl.split('?')[0]
  const entryPath = path.resolve(absWorkingDir, toFilePath(rawNoQuery))
  const outFile = path.join(cacheDir, sanitizeFilename(path.relative(absWorkingDir, entryPath)))

  // Create or reuse incremental esbuild context for this entry
  let rec = contexts.get(entryPath)
  if (!rec) {
    await ensureDir(path.dirname(outFile))

    const ctx = await esbuild.context({
      entryPoints: [entryPath],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      write: true,
      outfile: outFile,
      absWorkingDir,
      sourcemap: 'inline',
      tsconfig,
      // Either use native alias...
      alias: { '@': aliasAt },
      // ...or enable tsconfig paths plugin:
      // plugins: [tsconfigPaths()],
      packages: 'external', // leave node_modules external for speed
      logLevel: 'silent',
    })

    rec = { ctx, outfile: outFile }
    contexts.set(entryPath, rec)
  }

  // Rebuild incrementally (fast)
  const res = await rec.ctx.rebuild()
  if (res.errors?.length) {
    // surface errors early
    throw new Error('esbuild failed:\n' + res.errors.map(e => e.text).join('\n'))
  }

  // Import from disk with a cache-busting query so Node reloads the new build
  const fileHref = pathToFileURL(rec.outfile).href + `?v=${++bust}`
  return import(fileHref)
}

/** Optional: dispose all contexts when your dev server shuts down */
export async function disposeImporters() {
  await Promise.all([...contexts.values()].map(v => v.ctx.dispose()))
  contexts.clear()
}
