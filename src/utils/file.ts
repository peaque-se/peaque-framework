/**
 * File and path manipulation utilities.
 *
 * This module provides utilities for working with file paths, extensions,
 * directory operations, and file system helpers.
 *
 * @module utils/file
 */

import { join, resolve, dirname, basename, extname, relative, normalize, sep, posix } from 'path';
import { existsSync, statSync, readdirSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from 'fs';

/**
 * Check if a file or directory exists.
 *
 * @param path - Path to check
 * @returns True if path exists
 *
 * @example
 * ```typescript
 * if (fileExists('./config.json')) {
 *   // File exists
 * }
 * ```
 */
export function fileExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory.
 *
 * @param path - Path to check
 * @returns True if path is a directory
 *
 * @example
 * ```typescript
 * if (isDirectory('./src')) {
 *   // Path is a directory
 * }
 * ```
 */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file.
 *
 * @param path - Path to check
 * @returns True if path is a file
 *
 * @example
 * ```typescript
 * if (isFile('./package.json')) {
 *   // Path is a file
 * }
 * ```
 */
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Get file extension with or without dot.
 *
 * @param filePath - File path
 * @param includeDot - Include the dot in extension (default: true)
 * @returns File extension
 *
 * @example
 * ```typescript
 * getExtension('file.txt'); // '.txt'
 * getExtension('file.txt', false); // 'txt'
 * getExtension('file.tar.gz'); // '.gz'
 * ```
 */
export function getExtension(filePath: string, includeDot = true): string {
  const ext = extname(filePath);
  return includeDot ? ext : ext.slice(1);
}

/**
 * Get filename without extension.
 *
 * @param filePath - File path
 * @returns Filename without extension
 *
 * @example
 * ```typescript
 * getFilenameWithoutExtension('/path/to/file.txt'); // 'file'
 * getFilenameWithoutExtension('image.png'); // 'image'
 * ```
 */
export function getFilenameWithoutExtension(filePath: string): string {
  const base = basename(filePath);
  const ext = extname(base);
  return base.slice(0, -ext.length || undefined);
}

/**
 * Change file extension.
 *
 * @param filePath - Original file path
 * @param newExtension - New extension (with or without dot)
 * @returns Path with new extension
 *
 * @example
 * ```typescript
 * changeExtension('file.txt', '.md'); // 'file.md'
 * changeExtension('file.txt', 'json'); // 'file.json'
 * changeExtension('/path/to/file.txt', '.js'); // '/path/to/file.js'
 * ```
 */
export function changeExtension(filePath: string, newExtension: string): string {
  const dir = dirname(filePath);
  const name = getFilenameWithoutExtension(filePath);
  const ext = newExtension.startsWith('.') ? newExtension : `.${newExtension}`;
  return join(dir, name + ext);
}

/**
 * Normalize path separators to forward slashes (useful for cross-platform paths).
 *
 * @param path - Path to normalize
 * @returns Path with forward slashes
 *
 * @example
 * ```typescript
 * normalizePath('path\\to\\file'); // 'path/to/file'
 * normalizePath('path/to/file'); // 'path/to/file'
 * ```
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Ensure a path uses the platform's separator.
 *
 * @param path - Path to convert
 * @returns Path with platform-specific separators
 *
 * @example
 * ```typescript
 * toPlatformPath('path/to/file'); // 'path\to\file' on Windows, 'path/to/file' on Unix
 * ```
 */
export function toPlatformPath(path: string): string {
  return normalize(path);
}

/**
 * Join path segments using forward slashes (cross-platform).
 *
 * @param segments - Path segments to join
 * @returns Joined path with forward slashes
 *
 * @example
 * ```typescript
 * joinPath('src', 'utils', 'file.ts'); // 'src/utils/file.ts'
 * ```
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(join(...segments));
}

/**
 * Get relative path from one path to another.
 *
 * @param from - Source path
 * @param to - Target path
 * @returns Relative path
 *
 * @example
 * ```typescript
 * getRelativePath('/src/utils', '/src/types');
 * // '../types'
 * ```
 */
export function getRelativePath(from: string, to: string): string {
  return normalizePath(relative(from, to));
}

/**
 * Ensure directory exists, create if it doesn't.
 *
 * @param dirPath - Directory path
 * @returns True if directory was created, false if it already existed
 *
 * @example
 * ```typescript
 * ensureDirectory('./dist/assets');
 * // Creates all necessary parent directories
 * ```
 */
export function ensureDirectory(dirPath: string): boolean {
  try {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      return true;
    }
    return false;
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * Get all files in a directory (non-recursive).
 *
 * @param dirPath - Directory path
 * @param filter - Optional filter function
 * @returns Array of file paths
 *
 * @example
 * ```typescript
 * const files = getFiles('./src');
 * const tsFiles = getFiles('./src', f => f.endsWith('.ts'));
 * ```
 */
export function getFiles(
  dirPath: string,
  filter?: (filename: string) => boolean
): string[] {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    let files = entries
      .filter(entry => entry.isFile())
      .map(entry => join(dirPath, entry.name));

    if (filter) {
      files = files.filter(filter);
    }

    return files.map(normalizePath);
  } catch (error) {
    throw new Error(`Failed to read directory ${dirPath}: ${error}`);
  }
}

/**
 * Get all directories in a directory (non-recursive).
 *
 * @param dirPath - Directory path
 * @param filter - Optional filter function
 * @returns Array of directory paths
 *
 * @example
 * ```typescript
 * const dirs = getDirectories('./src');
 * ```
 */
export function getDirectories(
  dirPath: string,
  filter?: (dirname: string) => boolean
): string[] {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    let dirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => join(dirPath, entry.name));

    if (filter) {
      dirs = dirs.filter(filter);
    }

    return dirs.map(normalizePath);
  } catch (error) {
    throw new Error(`Failed to read directory ${dirPath}: ${error}`);
  }
}

/**
 * Get all files in a directory recursively.
 *
 * @param dirPath - Directory path
 * @param filter - Optional filter function
 * @returns Array of file paths
 *
 * @example
 * ```typescript
 * const allFiles = getFilesRecursive('./src');
 * const tsFiles = getFilesRecursive('./src', f => f.endsWith('.ts'));
 * ```
 */
export function getFilesRecursive(
  dirPath: string,
  filter?: (filename: string) => boolean
): string[] {
  const results: string[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        results.push(...getFilesRecursive(fullPath, filter));
      } else if (entry.isFile()) {
        if (!filter || filter(fullPath)) {
          results.push(normalizePath(fullPath));
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to read directory ${dirPath}: ${error}`);
  }

  return results;
}

/**
 * Read file as string with encoding.
 *
 * @param filePath - File path
 * @param encoding - Text encoding (default: 'utf-8')
 * @returns File contents
 *
 * @example
 * ```typescript
 * const content = readFileString('./package.json');
 * const config = JSON.parse(content);
 * ```
 */
export function readFileString(
  filePath: string,
  encoding: BufferEncoding = 'utf-8'
): string {
  try {
    return readFileSync(filePath, encoding);
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Read file as Buffer.
 *
 * @param filePath - File path
 * @returns File contents as Buffer
 *
 * @example
 * ```typescript
 * const buffer = readFileBuffer('./image.png');
 * ```
 */
export function readFileBuffer(filePath: string): Buffer {
  try {
    return readFileSync(filePath);
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Read and parse JSON file.
 *
 * @param filePath - JSON file path
 * @returns Parsed JSON object
 *
 * @example
 * ```typescript
 * const config = readJsonFile<Config>('./config.json');
 * ```
 */
export function readJsonFile<T = any>(filePath: string): T {
  try {
    const content = readFileString(filePath);
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read JSON file ${filePath}: ${error}`);
  }
}

/**
 * Write string to file.
 *
 * @param filePath - File path
 * @param content - Content to write
 * @param encoding - Text encoding (default: 'utf-8')
 *
 * @example
 * ```typescript
 * writeFileString('./output.txt', 'Hello World');
 * ```
 */
export function writeFileString(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf-8'
): void {
  try {
    ensureDirectory(dirname(filePath));
    writeFileSync(filePath, content, encoding);
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
}

/**
 * Write Buffer to file.
 *
 * @param filePath - File path
 * @param buffer - Buffer to write
 *
 * @example
 * ```typescript
 * writeFileBuffer('./image.png', buffer);
 * ```
 */
export function writeFileBuffer(filePath: string, buffer: Buffer): void {
  try {
    ensureDirectory(dirname(filePath));
    writeFileSync(filePath, buffer);
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
}

/**
 * Write object to JSON file.
 *
 * @param filePath - JSON file path
 * @param data - Data to write
 * @param pretty - Pretty print with indentation (default: false)
 *
 * @example
 * ```typescript
 * writeJsonFile('./config.json', { port: 3000 }, true);
 * ```
 */
export function writeJsonFile(
  filePath: string,
  data: any,
  pretty = false
): void {
  try {
    const content = JSON.stringify(data, null, pretty ? 2 : 0);
    writeFileString(filePath, content);
  } catch (error) {
    throw new Error(`Failed to write JSON file ${filePath}: ${error}`);
  }
}

/**
 * Copy file from source to destination.
 *
 * @param sourcePath - Source file path
 * @param destPath - Destination file path
 *
 * @example
 * ```typescript
 * copyFile('./src/template.txt', './dist/output.txt');
 * ```
 */
export function copyFile(sourcePath: string, destPath: string): void {
  try {
    ensureDirectory(dirname(destPath));
    copyFileSync(sourcePath, destPath);
  } catch (error) {
    throw new Error(`Failed to copy file from ${sourcePath} to ${destPath}: ${error}`);
  }
}

/**
 * Delete a file.
 *
 * @param filePath - File path to delete
 *
 * @example
 * ```typescript
 * deleteFile('./temp.txt');
 * ```
 */
export function deleteFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (error) {
    throw new Error(`Failed to delete file ${filePath}: ${error}`);
  }
}

/**
 * Get file size in bytes.
 *
 * @param filePath - File path
 * @returns File size in bytes
 *
 * @example
 * ```typescript
 * const size = getFileSize('./large-file.bin');
 * console.log(`File is ${size} bytes`);
 * ```
 */
export function getFileSize(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch (error) {
    throw new Error(`Failed to get size of file ${filePath}: ${error}`);
  }
}

/**
 * Get file modification time.
 *
 * @param filePath - File path
 * @returns Modification date
 *
 * @example
 * ```typescript
 * const mtime = getFileModifiedTime('./file.txt');
 * console.log(`Last modified: ${mtime.toISOString()}`);
 * ```
 */
export function getFileModifiedTime(filePath: string): Date {
  try {
    return statSync(filePath).mtime;
  } catch (error) {
    throw new Error(`Failed to get modification time of file ${filePath}: ${error}`);
  }
}

/**
 * Format file size in human-readable format.
 *
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted size string
 *
 * @example
 * ```typescript
 * formatFileSize(1024); // '1.00 KB'
 * formatFileSize(1048576); // '1.00 MB'
 * formatFileSize(1234567, 1); // '1.2 MB'
 * ```
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Check if path is absolute.
 *
 * @param path - Path to check
 * @returns True if path is absolute
 *
 * @example
 * ```typescript
 * isAbsolutePath('/usr/local'); // true
 * isAbsolutePath('C:\\Users'); // true (on Windows)
 * isAbsolutePath('./relative'); // false
 * ```
 */
export function isAbsolutePath(path: string): boolean {
  return resolve(path) === normalize(path);
}

/**
 * Convert relative path to absolute path.
 *
 * @param path - Relative path
 * @param basePath - Base path (default: current working directory)
 * @returns Absolute path
 *
 * @example
 * ```typescript
 * toAbsolutePath('./src/index.ts'); // '/home/user/project/src/index.ts'
 * toAbsolutePath('../config.json', '/home/user/project/src');
 * // '/home/user/project/config.json'
 * ```
 */
export function toAbsolutePath(path: string, basePath?: string): string {
  return resolve(basePath || process.cwd(), path);
}

/**
 * Get the common base path of multiple paths.
 *
 * @param paths - Array of paths
 * @returns Common base path
 *
 * @example
 * ```typescript
 * getCommonPath([
 *   '/home/user/project/src/index.ts',
 *   '/home/user/project/src/utils/file.ts',
 *   '/home/user/project/dist/index.js'
 * ]);
 * // '/home/user/project'
 * ```
 */
export function getCommonPath(paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) return dirname(paths[0]);

  const normalizedPaths = paths.map(normalizePath);
  const parts = normalizedPaths[0].split('/');

  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = parts.slice(0, i + 1).join('/');
    if (normalizedPaths.every(path => path.startsWith(candidate))) {
      return candidate || '/';
    }
  }

  return '/';
}
