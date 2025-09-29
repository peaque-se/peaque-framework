import { readdirSync } from "fs"
import { join } from "path/posix"

export interface FileSystemEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  path: string
}

export interface FileSystem {
  readDirectory(dir: string): FileSystemEntry[]
  joinPath(...parts: string[]): string
}

export class MockFileSystem implements FileSystem {
  private files: Map<string, FileSystemEntry[]> = new Map()

  /**
   * Add a mock directory with its contents for testing
   * @param path - The directory path
   * @param entries - Array of files/directories in this directory
   */
  addDirectory(path: string, entries: FileSystemEntry[]) {
    this.files.set(path, entries)
  }

  readDirectory(dir: string): FileSystemEntry[] {
    return this.files.get(dir) || []
  }

  joinPath(...parts: string[]): string {
    return parts.join("/")
  }
}

export class RealFileSystem implements FileSystem {
  readDirectory(dir: string): FileSystemEntry[] {
    return readdirSync(dir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      path: join(dir, entry.name),
    }))
  }

  joinPath(...parts: string[]): string {
    return join(...parts)
  }
}
