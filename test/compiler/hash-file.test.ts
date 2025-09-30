import { hashFile } from "../../src/compiler/hash-file.js"
import fs from "fs"
import path from "path"
import os from "os"
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'

describe('hashFile', () => {
  let tempDir: string
  let testFiles: string[] = []

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hash-file-test-'))
  })

  afterEach(() => {
    // Clean up test files
    for (const file of testFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file)
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    testFiles = []

    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir)
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  const createTestFile = (filename: string, content: string): string => {
    const filePath = path.join(tempDir, filename)
    fs.writeFileSync(filePath, content, 'utf-8')
    testFiles.push(filePath)
    return filePath
  }

  describe('Basic hashing', () => {
    test('should hash a simple text file', async () => {
      const filePath = createTestFile('test.txt', 'Hello, World!')
      const hash = await hashFile(filePath)

      expect(hash).toBe('0a0a9f2a6772942557ab5355d76af442f8f65e01')
      expect(typeof hash).toBe('string')
      expect(hash).toHaveLength(40) // SHA-1 produces 40 character hex string
    })

    test('should hash an empty file', async () => {
      const filePath = createTestFile('empty.txt', '')
      const hash = await hashFile(filePath)

      expect(hash).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709') // SHA-1 of empty string
      expect(hash).toHaveLength(40)
    })

    test('should produce consistent hashes for identical content', async () => {
      const content = 'This is test content'
      const filePath1 = createTestFile('file1.txt', content)
      const filePath2 = createTestFile('file2.txt', content)

      const hash1 = await hashFile(filePath1)
      const hash2 = await hashFile(filePath2)

      expect(hash1).toBe(hash2)
    })

    test('should produce different hashes for different content', async () => {
      const filePath1 = createTestFile('file1.txt', 'Content A')
      const filePath2 = createTestFile('file2.txt', 'Content B')

      const hash1 = await hashFile(filePath1)
      const hash2 = await hashFile(filePath2)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Different file types', () => {
    test('should hash a JSON file', async () => {
      const jsonContent = JSON.stringify({ name: 'test', value: 123 }, null, 2)
      const filePath = createTestFile('data.json', jsonContent)
      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should hash a JavaScript file', async () => {
      const jsContent = 'function test() { return 42; }\nexport default test;'
      const filePath = createTestFile('script.js', jsContent)
      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should hash a TypeScript file', async () => {
      const tsContent = 'interface Test { value: number; }\nconst test: Test = { value: 42 };'
      const filePath = createTestFile('script.ts', tsContent)
      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should hash binary content', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD])
      const filePath = path.join(tempDir, 'binary.bin')
      fs.writeFileSync(filePath, binaryData)
      testFiles.push(filePath)

      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })
  })

  describe('Content sensitivity', () => {
    test('should detect single character difference', async () => {
      const filePath1 = createTestFile('file1.txt', 'test content')
      const filePath2 = createTestFile('file2.txt', 'test conten')

      const hash1 = await hashFile(filePath1)
      const hash2 = await hashFile(filePath2)

      expect(hash1).not.toBe(hash2)
    })

    test('should be sensitive to whitespace', async () => {
      const filePath1 = createTestFile('file1.txt', 'line1\nline2')
      const filePath2 = createTestFile('file2.txt', 'line1\r\nline2')

      const hash1 = await hashFile(filePath1)
      const hash2 = await hashFile(filePath2)

      expect(hash1).not.toBe(hash2)
    })

    test('should be sensitive to trailing newlines', async () => {
      const filePath1 = createTestFile('file1.txt', 'content')
      const filePath2 = createTestFile('file2.txt', 'content\n')

      const hash1 = await hashFile(filePath1)
      const hash2 = await hashFile(filePath2)

      expect(hash1).not.toBe(hash2)
    })

    test('should be case sensitive', async () => {
      const filePath1 = createTestFile('file1.txt', 'Hello')
      const filePath2 = createTestFile('file2.txt', 'hello')

      const hash1 = await hashFile(filePath1)
      const hash2 = await hashFile(filePath2)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Large file handling', () => {
    test('should hash a moderately large file', async () => {
      // Create a 1MB file
      const largeContent = 'x'.repeat(1024 * 1024)
      const filePath = createTestFile('large.txt', largeContent)

      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should hash multiple large files consistently', async () => {
      const largeContent = 'Test content\n'.repeat(100000) // ~1.2MB
      const filePath1 = createTestFile('large1.txt', largeContent)
      const filePath2 = createTestFile('large2.txt', largeContent)

      const hash1 = await hashFile(filePath1)
      const hash2 = await hashFile(filePath2)

      expect(hash1).toBe(hash2)
    })
  })

  describe('Error handling', () => {
    test('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.txt')

      await expect(hashFile(nonExistentPath)).rejects.toThrow()
    })

    test('should throw error for directory path', async () => {
      await expect(hashFile(tempDir)).rejects.toThrow()
    })

    test('should throw error for invalid path', async () => {
      const invalidPath = '\0invalid\0path'

      await expect(hashFile(invalidPath)).rejects.toThrow()
    })
  })

  describe('Special characters and encoding', () => {
    test('should hash file with Unicode content', async () => {
      const unicodeContent = '你好世界 🌍 Привет мир'
      const filePath = createTestFile('unicode.txt', unicodeContent)

      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should hash file with emoji', async () => {
      const emojiContent = '🎉🎊🎈🎁💯✨🌟⭐'
      const filePath = createTestFile('emoji.txt', emojiContent)

      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should hash file with special characters', async () => {
      const specialContent = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`'
      const filePath = createTestFile('special.txt', specialContent)

      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })
  })

  describe('Real-world scenarios', () => {
    test('should hash CSS file with Tailwind content', async () => {
      const cssContent = `
@tailwind base;
@tailwind components;
@tailwind utilities;

.custom-class {
  @apply flex items-center justify-center;
  background: linear-gradient(to right, #667eea 0%, #764ba2 100%);
}
`
      const filePath = createTestFile('styles.css', cssContent)

      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should hash TypeScript component file', async () => {
      const tsxContent = `
import React from 'react';

interface Props {
  title: string;
  onClick: () => void;
}

export const Button: React.FC<Props> = ({ title, onClick }) => {
  return <button onClick={onClick}>{title}</button>;
};
`
      const filePath = createTestFile('Button.tsx', tsxContent)

      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should detect file modification', async () => {
      const filePath = createTestFile('mutable.txt', 'original content')
      const hash1 = await hashFile(filePath)

      // Modify the file
      fs.writeFileSync(filePath, 'modified content', 'utf-8')
      const hash2 = await hashFile(filePath)

      expect(hash1).not.toBe(hash2)
    })

    test('should handle file with only newlines', async () => {
      const filePath = createTestFile('newlines.txt', '\n\n\n\n')
      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })

    test('should handle file with mixed line endings', async () => {
      const content = 'line1\nline2\r\nline3\rline4'
      const filePath = createTestFile('mixed-endings.txt', content)
      const hash = await hashFile(filePath)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(40)
    })
  })

  describe('Hash format validation', () => {
    test('should return lowercase hexadecimal hash', async () => {
      const filePath = createTestFile('test.txt', 'test content')
      const hash = await hashFile(filePath)

      expect(hash).toMatch(/^[a-f0-9]{40}$/)
    })

    test('should never return uppercase characters', async () => {
      const filePath = createTestFile('test.txt', 'UPPERCASE CONTENT')
      const hash = await hashFile(filePath)

      expect(hash).toBe(hash.toLowerCase())
      expect(hash).not.toMatch(/[A-Z]/)
    })
  })
})
