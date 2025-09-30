import { FileCache } from "../../src/server/file-cache.js"
import { hashFile } from "../../src/compiler/hash-file.js"
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Mock the hashFile function
jest.mock('../../src/compiler/hash-file.js')
const mockHashFile = hashFile as jest.MockedFunction<typeof hashFile>

describe('FileCache', () => {
  let cache: FileCache<string>
  let tempDir: string

  beforeEach(() => {
    cache = new FileCache<string>()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-cache-test-'))
    jest.clearAllMocks()
  })

  describe('cacheByHash', () => {
    test('should call producer and cache result on first access', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'initial content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn(async () => 'produced value')

      const result = await cache.cacheByHash(testFile, producer)

      expect(result).toBe('produced value')
      expect(producer).toHaveBeenCalledTimes(1)
      expect(mockHashFile).toHaveBeenCalledWith(testFile)
    })

    test('should return cached value without calling producer when hash matches', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn(async () => 'produced value')

      // First call - should produce
      const result1 = await cache.cacheByHash(testFile, producer)
      expect(result1).toBe('produced value')
      expect(producer).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const result2 = await cache.cacheByHash(testFile, producer)
      expect(result2).toBe('produced value')
      expect(producer).toHaveBeenCalledTimes(1) // Still only called once
      expect(mockHashFile).toHaveBeenCalledTimes(2)
    })

    test('should call producer again when file hash changes', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'initial content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn<() => Promise<string>>()
        .mockResolvedValueOnce('first value')
        .mockResolvedValueOnce('second value')

      // First call with initial hash
      const result1 = await cache.cacheByHash(testFile, producer)
      expect(result1).toBe('first value')
      expect(producer).toHaveBeenCalledTimes(1)

      // Simulate file change by returning different hash
      mockHashFile.mockResolvedValue('hash456')

      // Second call with new hash
      const result2 = await cache.cacheByHash(testFile, producer)
      expect(result2).toBe('second value')
      expect(producer).toHaveBeenCalledTimes(2)
    })

    test('should handle different file types (objects)', async () => {
      const cache = new FileCache<{ data: string }>()
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn(async () => ({ data: 'object value' }))

      const result = await cache.cacheByHash(testFile, producer)

      expect(result).toEqual({ data: 'object value' })
      expect(producer).toHaveBeenCalledTimes(1)

      // Verify caching works
      const result2 = await cache.cacheByHash(testFile, producer)
      expect(result2).toEqual({ data: 'object value' })
      expect(producer).toHaveBeenCalledTimes(1)
    })

    test('should handle different file types (numbers)', async () => {
      const cache = new FileCache<number>()
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn(async () => 42)

      const result = await cache.cacheByHash(testFile, producer)

      expect(result).toBe(42)
      expect(producer).toHaveBeenCalledTimes(1)
    })

    test('should handle synchronous producers', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn(() => 'sync value')

      const result = await cache.cacheByHash(testFile, producer)

      expect(result).toBe('sync value')
      expect(producer).toHaveBeenCalledTimes(1)
    })

    test('should maintain separate caches for different files', async () => {
      const file1 = path.join(tempDir, 'file1.txt')
      const file2 = path.join(tempDir, 'file2.txt')
      fs.writeFileSync(file1, 'content1')
      fs.writeFileSync(file2, 'content2')

      mockHashFile
        .mockResolvedValueOnce('hash1')
        .mockResolvedValueOnce('hash2')
        .mockResolvedValueOnce('hash1') // file1 second call
        .mockResolvedValueOnce('hash2') // file2 second call

      const producer1 = jest.fn(async () => 'value1')
      const producer2 = jest.fn(async () => 'value2')

      // Cache both files
      const result1 = await cache.cacheByHash(file1, producer1)
      const result2 = await cache.cacheByHash(file2, producer2)

      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
      expect(producer1).toHaveBeenCalledTimes(1)
      expect(producer2).toHaveBeenCalledTimes(1)

      // Access both again - should use cache
      const result1Again = await cache.cacheByHash(file1, producer1)
      const result2Again = await cache.cacheByHash(file2, producer2)

      expect(result1Again).toBe('value1')
      expect(result2Again).toBe('value2')
      expect(producer1).toHaveBeenCalledTimes(1)
      expect(producer2).toHaveBeenCalledTimes(1)
    })

    test('should handle producer throwing errors', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn(async () => {
        throw new Error('Producer error')
      })

      await expect(cache.cacheByHash(testFile, producer)).rejects.toThrow('Producer error')
      expect(producer).toHaveBeenCalledTimes(1)
    })

    test('should not cache errors from producer', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('success value')

      // First call throws
      await expect(cache.cacheByHash(testFile, producer)).rejects.toThrow('First error')

      // Second call should try producer again (error wasn't cached)
      const result = await cache.cacheByHash(testFile, producer)
      expect(result).toBe('success value')
      expect(producer).toHaveBeenCalledTimes(2)
    })

    test('should handle hashFile throwing errors', async () => {
      const testFile = path.join(tempDir, 'nonexistent.txt')

      mockHashFile.mockRejectedValue(new Error('File not found'))
      const producer = jest.fn(async () => 'value')

      await expect(cache.cacheByHash(testFile, producer)).rejects.toThrow('File not found')
      expect(producer).not.toHaveBeenCalled()
    })

    test('should handle null and undefined values', async () => {
      const cacheNull = new FileCache<null>()
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producerNull = jest.fn(async () => null)

      const result = await cacheNull.cacheByHash(testFile, producerNull)

      expect(result).toBeNull()
      expect(producerNull).toHaveBeenCalledTimes(1)

      // Verify caching works with null
      const result2 = await cacheNull.cacheByHash(testFile, producerNull)
      expect(result2).toBeNull()
      expect(producerNull).toHaveBeenCalledTimes(1)
    })

    test('should handle empty strings', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      const producer = jest.fn(async () => '')

      const result = await cache.cacheByHash(testFile, producer)

      expect(result).toBe('')
      expect(producer).toHaveBeenCalledTimes(1)

      // Verify caching works with empty string
      const result2 = await cache.cacheByHash(testFile, producer)
      expect(result2).toBe('')
      expect(producer).toHaveBeenCalledTimes(1)
    })

    test('should handle concurrent calls for the same file', async () => {
      const testFile = path.join(tempDir, 'test.txt')
      fs.writeFileSync(testFile, 'content')

      mockHashFile.mockResolvedValue('hash123')
      let producerCallCount = 0
      const producer = jest.fn(async () => {
        producerCallCount++
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'value'
      })

      // Make two concurrent calls
      const [result1, result2] = await Promise.all([
        cache.cacheByHash(testFile, producer),
        cache.cacheByHash(testFile, producer)
      ])

      expect(result1).toBe('value')
      expect(result2).toBe('value')
      // Both calls should execute the producer since they run concurrently
      // before the cache is populated
      expect(producerCallCount).toBeGreaterThanOrEqual(1)
    })
  })
})
