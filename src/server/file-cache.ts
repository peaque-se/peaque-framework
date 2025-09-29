import { hashFile } from "../compiler/hash-file.js"

interface CacheEntry<T> {
  hash: string
  value: T
}

export class FileCache<T> {
  private entryByFilename: Map<string, CacheEntry<T>> = new Map()

  async cacheByHash(filename: string, producer: () => Promise<T> | T): Promise<T> {
    const hash = await hashFile(filename)
    const entry : CacheEntry<T> | undefined = this.entryByFilename.get(filename)
    if (entry && entry.hash === hash) {
      return entry.value
    }
    const result = await producer()
    this.entryByFilename.set(filename, { hash, value: result })
    return result
  }
}
