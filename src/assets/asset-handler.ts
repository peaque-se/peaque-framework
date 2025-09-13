// GET handler for serving static assets with compression support

import { RequestHandler } from "../http/http-types"
import { Router } from "../http/http-router"
import { promises as fs } from "fs"
import { join, extname, basename } from "path"

const contentTypeRegistry: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".br": "application/x-brotli",
}

interface AssetData {
  contentType: string
  original: Buffer
  gzip?: Buffer
  brotli?: Buffer
}

interface AssetStats {
  totalBytesInMemory: number
  totalGzipBytes: number
  totalBrotliBytes: number
  totalUncompressedBytes: number
}

function createHandler(asset: AssetData): RequestHandler {
  return async (req) => {
    const acceptEncoding = req.requestHeader("accept-encoding") || ""
    let buffer: Buffer
    let encoding: string | undefined

    if (acceptEncoding.includes("br") && asset.brotli) {
      buffer = asset.brotli
      encoding = "br"
    } else if (acceptEncoding.includes("gzip") && asset.gzip) {
      buffer = asset.gzip
      encoding = "gzip"
    } else {
      buffer = asset.original
    }

    req.type(asset.contentType)
    if (encoding) {
      req.header("content-encoding", encoding)
    }
    req.send(buffer)
  }
}

export async function addAssetRoutesForFolder(router: Router, folderPath: string, basePath: string = "/assets"): Promise<AssetStats> {
  const assets = new Map<string, AssetData>()

  let totalBytesInMemory = 0
  let totalGzipBytes = 0
  let totalBrotliBytes = 0
  let totalUncompressedBytes = 0

  // Load all files recursively
  async function loadFiles(dir: string, basePath: string = ""): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relativePath = join(basePath, entry.name)
      if (entry.isDirectory()) {
        await loadFiles(fullPath, relativePath)
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (ext === ".gz" || ext === ".br") continue // Skip compressed files
        const baseName = basename(entry.name, ext)
        const asset: AssetData = {
          original: await fs.readFile(fullPath),
          contentType: contentTypeRegistry[ext] || "application/octet-stream",
        }

        // Check for compressed versions
        const gzipPath = join(dir, `${baseName}${ext}.gz`)
        const brotliPath = join(dir, `${baseName}${ext}.br`)
        try {
          asset.gzip = await fs.readFile(gzipPath)
        } catch {}
        try {
          asset.brotli = await fs.readFile(brotliPath)
        } catch {}

        assets.set(relativePath, asset)

        totalUncompressedBytes += asset.original.length
        if (asset.gzip) {
          totalGzipBytes += asset.gzip.length
          totalBytesInMemory += asset.gzip.length
        }
        if (asset.brotli) {
          totalBrotliBytes += asset.brotli.length
          totalBytesInMemory += asset.brotli.length
        }
        totalBytesInMemory += asset.original.length
      }
    }
  }

  await loadFiles(folderPath)

  // Register one route per file
  for (const [relativePath, asset] of assets) {
    const routePath = `${basePath}/${relativePath}`.replace(/\\/g, "/") // Ensure forward slashes
    const handler = createHandler(asset)
    router.addRoute("GET", routePath, handler)
  }

  return {
    totalBytesInMemory,
    totalGzipBytes,
    totalBrotliBytes,
    totalUncompressedBytes,
  }
}
