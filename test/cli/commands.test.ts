import { jest } from '@jest/globals'

// Mock the version import
jest.mock('../../src/server/version.js', () => ({
  platformVersion: '1.0.0'
}))

import { createCommandLineParser } from '../../src/cli/commandline-parser.js'
import type { DevCommandOptions, BuildCommandOptions, StartCommandOptions } from '../../src/cli/commands.js'
import type { DevServer } from '../../src/server/dev-server.js'
import path from 'path'

describe('CLI Command Parsing', () => {
  let mockDevCommand: jest.MockedFunction<(options: DevCommandOptions) => Promise<DevServer>>
  let mockBuildCommand: jest.MockedFunction<(options: BuildCommandOptions) => Promise<void>>
  let mockStartCommand: jest.MockedFunction<(options: StartCommandOptions) => Promise<void>>

  beforeEach(() => {
    mockDevCommand = jest.fn<(options: DevCommandOptions) => Promise<DevServer>>().mockResolvedValue({} as DevServer)
    mockBuildCommand = jest.fn<(options: BuildCommandOptions) => Promise<void>>().mockResolvedValue(undefined)
    mockStartCommand = jest.fn<(options: StartCommandOptions) => Promise<void>>().mockResolvedValue(undefined)
  })

  describe('dev command', () => {
    it('should parse "peaque dev" with default options', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 3000,
        strict: true,
        fullStackTrace: false
      })
    })

    it('should parse "peaque dev -p 2000" with custom port', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev', '-p', '2000'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 2000,
        strict: true,
        fullStackTrace: false
      })
    })

    it('should parse "peaque dev --port 4000" with custom port', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev', '--port', '4000'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 4000,
        strict: true,
        fullStackTrace: false
      })
    })

    it('should parse "peaque dev -b /custom/path" with custom base path', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev', '-b', '/custom/path'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: '/custom/path',
        port: 3000,
        strict: true,
        fullStackTrace: false
      })
    })

    it('should parse "peaque dev --base /custom/path" with custom base path', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev', '--base', '/custom/path'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: '/custom/path',
        port: 3000,
        strict: true,
        fullStackTrace: false
      })
    })

    it('should parse "peaque dev --no-strict" with strict mode disabled', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev', '--no-strict'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 3000,
        strict: false,
        fullStackTrace: false
      })
    })

    it('should parse "peaque dev --full-stack-traces" with full stack traces enabled', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev', '--full-stack-traces'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 3000,
        strict: true,
        fullStackTrace: true
      })
    })

    it('should parse "peaque dev -p 5000 -b /path --no-strict --full-stack-traces" with all options', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'dev', '-p', '5000', '-b', '/path', '--no-strict', '--full-stack-traces'])

      expect(mockDevCommand).toHaveBeenCalledWith({
        basePath: '/path',
        port: 5000,
        strict: false,
        fullStackTrace: true
      })
    })
  })

  describe('build command', () => {
    it('should parse "peaque build" with default options', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'build'])

      expect(mockBuildCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        output: path.join(process.cwd(), 'dist'),
        minify: true
      })
    })

    it('should parse "peaque build -o /custom/output" with custom output', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'build', '-o', '/custom/output'])

      expect(mockBuildCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        output: '/custom/output',
        minify: true
      })
    })

    it('should parse "peaque build --output /custom/output" with custom output', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'build', '--output', '/custom/output'])

      expect(mockBuildCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        output: '/custom/output',
        minify: true
      })
    })

    it('should parse "peaque build -b /custom/path" with custom base path', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'build', '-b', '/custom/path'])

      expect(mockBuildCommand).toHaveBeenCalledWith({
        basePath: '/custom/path',
        output: path.join('/custom/path', 'dist'),
        minify: true
      })
    })

    it('should parse "peaque build --base /custom/path" with custom base path', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'build', '--base', '/custom/path'])

      expect(mockBuildCommand).toHaveBeenCalledWith({
        basePath: '/custom/path',
        output: path.join('/custom/path', 'dist'),
        minify: true
      })
    })

    it('should parse "peaque build --no-minify" with minification disabled', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'build', '--no-minify'])

      expect(mockBuildCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        output: path.join(process.cwd(), 'dist'),
        minify: false
      })
    })

    it('should parse "peaque build -b /path -o /output --no-minify" with all options', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'build', '-b', '/path', '-o', '/output', '--no-minify'])

      expect(mockBuildCommand).toHaveBeenCalledWith({
        basePath: '/path',
        output: '/output',
        minify: false
      })
    })
  })

  describe('start command', () => {
    it('should parse "peaque start" with default options', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'start'])

      expect(mockStartCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 3000
      })
    })

    it('should parse "peaque start -p 4000" with custom port', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'start', '-p', '4000'])

      expect(mockStartCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 4000
      })
    })

    it('should parse "peaque start --port 5000" with custom port', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'start', '--port', '5000'])

      expect(mockStartCommand).toHaveBeenCalledWith({
        basePath: process.cwd(),
        port: 5000
      })
    })

    it('should parse "peaque start -b /custom/path" with custom base path', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'start', '-b', '/custom/path'])

      expect(mockStartCommand).toHaveBeenCalledWith({
        basePath: '/custom/path',
        port: 3000
      })
    })

    it('should parse "peaque start --base /custom/path" with custom base path', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'start', '--base', '/custom/path'])

      expect(mockStartCommand).toHaveBeenCalledWith({
        basePath: '/custom/path',
        port: 3000
      })
    })

    it('should parse "peaque start -b /path -p 6000" with all options', () => {
      const program = createCommandLineParser(mockDevCommand, mockBuildCommand, mockStartCommand)
      program.parse(['node', 'peaque', 'start', '-b', '/path', '-p', '6000'])

      expect(mockStartCommand).toHaveBeenCalledWith({
        basePath: '/path',
        port: 6000
      })
    })
  })
})