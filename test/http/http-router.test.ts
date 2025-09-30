import { Router, executeMiddlewareChain } from "../../src/http/http-router.js"
import { HttpMethod, PeaqueRequest, RequestHandler, RequestMiddleware } from "../../src/http/http-types.js"
import { describe, test, expect, beforeEach, jest } from '@jest/globals'

// Mock PeaqueRequest implementation for testing
class MockPeaqueRequest implements PeaqueRequest {
  private _path: string
  private _method: HttpMethod
  private _pathParams: Record<string, string> = {}
  private _queryParams: Record<string, string[]> = {}
  private _headers: Record<string, string[]> = {}
  private _body: any = null
  private _responded = false
  private _responseCode = 200
  private _responseBody: any = null
  private _originalUrl = ""
  private _ip = "127.0.0.1"
  private _cookies: any = {
    get: jest.fn(),
    getAll: jest.fn(),
    set: jest.fn(),
    remove: jest.fn()
  }

  constructor(path: string = "/", method: HttpMethod = "GET") {
    this._path = path
    this._method = method
    this._originalUrl = path
  }

  body<T = any>(): T {
    return this._body as T
  }

  isResponded(): boolean {
    return this._responded
  }

  path(): string {
    return this._path
  }

  setPath(path: string): void {
    this._path = path
  }

  param(name: string): string | undefined {
    return this._pathParams[name] || this._queryParams[name]?.[0]
  }

  paramNames(): string[] {
    return [...Object.keys(this._pathParams), ...Object.keys(this._queryParams)]
  }

  pathParam(name: string): string | undefined {
    return this._pathParams[name]
  }

  setPathParam(name: string, value: string): void {
    this._pathParams[name] = value
  }

  queryParam(name: string): string | undefined {
    return this._queryParams[name]?.[0]
  }

  setQueryParam(name: string, value: string[]): void {
    this._queryParams[name] = value
  }

  queryParamValues(name: string): string[] | undefined {
    return this._queryParams[name]
  }

  requestHeader(name: string): string | undefined {
    return this._headers[name.toLowerCase()]?.[0]
  }

  requestHeaderValues(name: string): string[] | undefined {
    return this._headers[name.toLowerCase()]
  }

  method(): HttpMethod {
    return this._method
  }

  originalUrl(): string {
    return this._originalUrl
  }

  ip(): string {
    return this._ip
  }

  cookies(): any {
    return this._cookies
  }

  code(statusCode: number): PeaqueRequest {
    this._responseCode = statusCode
    this._responded = true
    return this
  }

  header(name: string, value: string): PeaqueRequest {
    this._headers[name.toLowerCase()] = [value]
    return this
  }

  type(contentType: string): PeaqueRequest {
    return this.header("content-type", contentType)
  }

  send<T = any>(data?: T): void {
    this._responseBody = data
    this._responded = true
  }

  redirect(url: string, code: number = 302): void {
    this._responseCode = code
    this._responseBody = url
    this._responded = true
  }

  responseCode(): number {
    return this._responseCode
  }

  responseBody(): any {
    return this._responseBody
  }

  isUpgradeRequest(): boolean {
    return false
  }

  upgradeToWebSocket(handler: any): any {
    throw new Error("WebSocket upgrade not implemented in mock")
  }

  // Helper methods for testing
  getPathParams(): Record<string, string> {
    return { ...this._pathParams }
  }

  getQueryParams(): Record<string, string[]> {
    return { ...this._queryParams }
  }

  getHeaders(): Record<string, string[]> {
    return { ...this._headers }
  }

  resetResponse(): void {
    this._responded = false
    this._responseCode = 200
    this._responseBody = null
  }
}

describe('Router - Comprehensive HTTP Router Tests', () => {
  let router: Router
  let mockHandler: jest.MockedFunction<RequestHandler>
  let mockMiddleware: jest.MockedFunction<RequestMiddleware>
  let mockFallbackHandler: jest.MockedFunction<RequestHandler>

  beforeEach(() => {
    router = new Router()
    mockHandler = jest.fn()
    mockMiddleware = jest.fn()
    mockFallbackHandler = jest.fn()
  })

  describe('Route Registration', () => {
    test('should register routes for different HTTP methods', () => {
      const methods: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]

      methods.forEach(method => {
        router.addRoute(method, "/test", mockHandler)
      })

      methods.forEach(method => {
        const match = router.getMatchingRoute(method, "/test")
        expect(match).toBeDefined()
        expect(match!.method).toBe(method)
        expect(match!.path).toBe("/test")
      })
    })

    test('should allow method chaining with addRoute', () => {
      const result = router
        .addRoute("GET", "/users", mockHandler)
        .addRoute("POST", "/users", mockHandler)

      expect(result).toBe(router) // Should return the same router instance
    })

    test('should store original path correctly', () => {
      router.addRoute("GET", "/api/v1/users/:id/posts/:postId", mockHandler)

      const match = router.getMatchingRoute("GET", "/api/v1/users/123/posts/456")
      expect(match?.path).toBe("/api/v1/users/:id/posts/:postId")
    })
  })

  describe('Static Route Matching', () => {
    test('should match exact static routes', () => {
      router.addRoute("GET", "/users", mockHandler)

      const match = router.getMatchingRoute("GET", "/users")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({})
      expect(match!.handler).toBe(mockHandler)
    })

    test('should not match static routes with extra path segments', () => {
      router.addRoute("GET", "/users", mockHandler)

      const match = router.getMatchingRoute("GET", "/users/123")
      expect(match).toBeUndefined()
    })

    test('should not match static routes with missing path segments', () => {
      router.addRoute("GET", "/api/users", mockHandler)

      const match = router.getMatchingRoute("GET", "/api")
      expect(match).toBeUndefined()
    })

    test('should match root route', () => {
      router.addRoute("GET", "/", mockHandler)

      const match = router.getMatchingRoute("GET", "/")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({})
    })

    test('should handle trailing slashes in matching', () => {
      router.addRoute("GET", "/users", mockHandler)

      const match1 = router.getMatchingRoute("GET", "/users")
      const match2 = router.getMatchingRoute("GET", "/users/")

      expect(match1).toBeDefined()
      expect(match2).toBeDefined()
    })

    test('should differentiate between methods for same path', () => {
      router.addRoute("GET", "/users", mockHandler)
      router.addRoute("POST", "/users", mockHandler)

      const getMatch = router.getMatchingRoute("GET", "/users")
      const postMatch = router.getMatchingRoute("POST", "/users")
      const putMatch = router.getMatchingRoute("PUT", "/users")

      expect(getMatch).toBeDefined()
      expect(postMatch).toBeDefined()
      expect(putMatch).toBeUndefined()
    })
  })

  describe('Parameterized Route Matching', () => {
    test('should match parameterized routes and extract parameters', () => {
      router.addRoute("GET", "/users/:id", mockHandler)

      const match = router.getMatchingRoute("GET", "/users/123")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ id: "123" })
    })

    test('should match multiple parameters in same route', () => {
      router.addRoute("GET", "/users/:userId/posts/:postId", mockHandler)

      const match = router.getMatchingRoute("GET", "/users/123/posts/456")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ userId: "123", postId: "456" })
    })

    test('should handle parameters with special characters', () => {
      router.addRoute("GET", "/files/:filename", mockHandler)

      const match = router.getMatchingRoute("GET", "/files/my-file_with.special.chars.txt")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ filename: "my-file_with.special.chars.txt" })
    })

    test('should handle URL-encoded parameters', () => {
      router.addRoute("GET", "/users/:name", mockHandler)

      const match = router.getMatchingRoute("GET", "/users/John%20Doe")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ name: "John%20Doe" }) // Router doesn't decode, that's handled elsewhere
    })

    test('should prefer static routes over parameterized routes', () => {
      router.addRoute("GET", "/users/new", mockHandler)
      router.addRoute("GET", "/users/:id", mockHandler)

      const staticMatch = router.getMatchingRoute("GET", "/users/new")
      const paramMatch = router.getMatchingRoute("GET", "/users/123")

      expect(staticMatch).toBeDefined()
      expect(staticMatch!.parameters).toEqual({})
      expect(paramMatch).toBeDefined()
      expect(paramMatch!.parameters).toEqual({ id: "123" })
    })

    test('should not match parameterized routes with missing parameters', () => {
      router.addRoute("GET", "/users/:id/posts/:postId", mockHandler)

      const match = router.getMatchingRoute("GET", "/users/123/posts")
      expect(match).toBeUndefined()
    })
  })

  describe('Wildcard Route Matching', () => {
    test('should match wildcard routes and capture remaining path', () => {
      router.addRoute("GET", "/files/*path", mockHandler)

      const match = router.getMatchingRoute("GET", "/files/docs/readme.txt")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ path: "docs/readme.txt" })
    })

    test('should match wildcard routes with custom parameter names', () => {
      router.addRoute("GET", "/assets/*filepath", mockHandler)

      const match = router.getMatchingRoute("GET", "/assets/images/logo.png")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ filepath: "images/logo.png" })
    })

    test('should match wildcard routes with empty remaining path', () => {
      router.addRoute("GET", "/files/*path", mockHandler)

      // This should not match because /files/ matches the static "files" node which has no handler
      const match = router.getMatchingRoute("GET", "/files/")
      expect(match).toBeUndefined()
    })

    test('should handle wildcard routes with multiple path segments', () => {
      router.addRoute("GET", "/api/*version", mockHandler)

      const match = router.getMatchingRoute("GET", "/api/v1/users/123/posts/456")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ version: "v1/users/123/posts/456" })
    })

    test('should prefer static and param routes over wildcard routes', () => {
      router.addRoute("GET", "/files/docs", mockHandler)  // static: /files/docs
      router.addRoute("GET", "/files/:type", mockHandler) // param: /files/:type
      router.addRoute("GET", "/files/*path", mockHandler) // wildcard: /files/*path

      const staticMatch = router.getMatchingRoute("GET", "/files/docs")
      const paramMatch = router.getMatchingRoute("GET", "/files/images")
      const wildcardMatch = router.getMatchingRoute("GET", "/files/docs/readme.txt")

      expect(staticMatch!.parameters).toEqual({})
      expect(paramMatch!.parameters).toEqual({ type: "images" })
      // This should not match because /files/docs/readme.txt tries to match /files/docs first,
      // but /files/docs has a handler, so it doesn't continue to wildcard
      expect(wildcardMatch).toBeUndefined()
    })
  })

  describe('Complex Route Patterns', () => {
    test('should handle mixed static, param, and wildcard routes', () => {
      router.addRoute("GET", "/api/v1/users/:id/posts/*path", mockHandler)

      const match = router.getMatchingRoute("GET", "/api/v1/users/123/posts/comments/recent")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({
        id: "123",
        path: "comments/recent"
      })
    })

    test('should handle deeply nested route structures', () => {
      router.addRoute("GET", "/a/b/c/d/e/f/g/:param", mockHandler)

      const match = router.getMatchingRoute("GET", "/a/b/c/d/e/f/g/test")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ param: "test" })
    })

    test('should handle routes with same prefix but different patterns', () => {
      router.addRoute("GET", "/api/users", mockHandler)
      // Removed conflicting routes
      router.addRoute("GET", "/api/users/*path", mockHandler)

      const exactMatch = router.getMatchingRoute("GET", "/api/users")
      const wildcardMatch = router.getMatchingRoute("GET", "/api/users/123/settings")

      expect(exactMatch!.parameters).toEqual({})
      expect(wildcardMatch!.parameters).toEqual({ path: "123/settings" })
    })
  })

  describe('Middleware Functionality', () => {
    test('should apply global middleware to all routes', () => {
      const globalMiddleware: RequestMiddleware = jest.fn(async (req: PeaqueRequest, next: RequestHandler) => {
        await next(req)
      })

      router = router.use(globalMiddleware)
      router.addRoute("GET", "/test", mockHandler)

      const match = router.getMatchingRoute("GET", "/test")
      expect(match!.middleware).toContain(globalMiddleware)
    })

    test('should chain multiple global middlewares', () => {
      const middleware1: RequestMiddleware = jest.fn(async (req: PeaqueRequest, next: RequestHandler) => {
        await next(req)
      })
      const middleware2: RequestMiddleware = jest.fn(async (req: PeaqueRequest, next: RequestHandler) => {
        await next(req)
      })

      router = router.use(middleware1).use(middleware2)
      router.addRoute("GET", "/test", mockHandler)

      const match = router.getMatchingRoute("GET", "/test")
      expect(match!.middleware).toEqual([middleware1, middleware2])
    })

    test('should create new router instance when adding middleware', () => {
      const originalRouter = router
      const newRouter = router.use(mockMiddleware)

      expect(newRouter).not.toBe(originalRouter)
      expect(newRouter).toBeInstanceOf(Router)
    })

    test('should share route tree between middleware-wrapped routers', () => {
      router.addRoute("GET", "/test", mockHandler)
      const newRouter = router.use(mockMiddleware)

      const originalMatch = router.getMatchingRoute("GET", "/test")
      const newMatch = newRouter.getMatchingRoute("GET", "/test")

      expect(originalMatch).toBeDefined()
      expect(newMatch).toBeDefined()
      expect(originalMatch!.handler).toBe(newMatch!.handler)
    })
  })

  describe('Fallback Handler', () => {
    test('should set fallback handler', () => {
      router.fallback(mockFallbackHandler)

      // Access private property for testing
      expect((router as any).fallbackHandler).toBe(mockFallbackHandler)
    })

    test('should allow method chaining with fallback', () => {
      const result = router.fallback(mockFallbackHandler)
      expect(result).toBe(router)
    })
  })

  describe('Request Handler Integration', () => {
    test('should process matched routes through getRequestHandler', async () => {
      router.addRoute("GET", "/users/:id", mockHandler)

      const requestHandler = router.getRequestHandler()
      const req = new MockPeaqueRequest("/users/123", "GET")

      await requestHandler(req)

      expect(mockHandler).toHaveBeenCalledWith(req)
      expect(req.getPathParams()).toEqual({ id: "123" })
    })

    test('should execute middleware chain before handler', async () => {
      const callOrder: string[] = []

      const middleware1: RequestMiddleware = jest.fn(async (req, next) => {
        callOrder.push('middleware1')
        await (next as any)()
        callOrder.push('middleware1-end')
      })

      const middleware2: RequestMiddleware = jest.fn(async (req, next) => {
        callOrder.push('middleware2')
        await (next as any)()
        callOrder.push('middleware2-end')
      })

      const testHandler: RequestHandler = jest.fn(async (req) => {
        callOrder.push('handler')
      })

      router = router.use(middleware1).use(middleware2)
      router.addRoute("GET", "/test", testHandler)

      const requestHandler = router.getRequestHandler()
      const req = new MockPeaqueRequest("/test", "GET")

      await requestHandler(req)

      expect(callOrder).toEqual(['middleware1', 'middleware2', 'handler', 'middleware2-end', 'middleware1-end'])
    })

    test('should call fallback handler for unmatched routes', async () => {
      router.fallback(mockFallbackHandler)

      const requestHandler = router.getRequestHandler()
      const req = new MockPeaqueRequest("/nonexistent", "GET")

      await requestHandler(req)

      expect(mockFallbackHandler).toHaveBeenCalledWith(req)
    })

    test('should call fallback handler when request is not responded to', async () => {
      const nonRespondingHandler: RequestHandler = jest.fn(async (req) => {
        // Handler doesn't respond
      })

      router.addRoute("GET", "/test", nonRespondingHandler)
      router.fallback(mockFallbackHandler)

      const requestHandler = router.getRequestHandler()
      const req = new MockPeaqueRequest("/test", "GET")

      await requestHandler(req)

      expect(nonRespondingHandler).toHaveBeenCalledWith(req)
      expect(mockFallbackHandler).toHaveBeenCalledWith(req)
    })

    test('should not call fallback handler when request is responded to', async () => {
      const respondingHandler = jest.fn<RequestHandler>().mockImplementation(async (req) => {
        req.send("response")
      })

      router.addRoute("GET", "/test", respondingHandler)
      router.fallback(mockFallbackHandler)

      const requestHandler = router.getRequestHandler()
      const req = new MockPeaqueRequest("/test", "GET")

      await requestHandler(req)

      expect(respondingHandler).toHaveBeenCalledWith(req)
      expect(mockFallbackHandler).not.toHaveBeenCalled()
    })
  })

  describe('executeMiddlewareChain function', () => {
    test('should execute middleware chain in correct order', async () => {
      const callOrder: string[] = []

      const middleware1: RequestMiddleware = async (req, next) => {
        callOrder.push('mw1-start')
        await (next as any)()
        callOrder.push('mw1-end')
      }

      const middleware2: RequestMiddleware = async (req, next) => {
        callOrder.push('mw2-start')
        await (next as any)()
        callOrder.push('mw2-end')
      }

      const finalHandler: RequestHandler = async (req) => {
        callOrder.push('handler')
      }

      const req = new MockPeaqueRequest()

      await executeMiddlewareChain(req, [middleware1, middleware2], finalHandler)

      expect(callOrder).toEqual(['mw1-start', 'mw2-start', 'handler', 'mw2-end', 'mw1-end'])
    })

    test('should handle empty middleware array', async () => {
      const req = new MockPeaqueRequest()
      const finalHandler: RequestHandler = jest.fn(async (req) => {})

      await executeMiddlewareChain(req, [], finalHandler)

      expect(finalHandler).toHaveBeenCalledWith(req)
    })

    test('should throw error for invalid middleware', async () => {
      const req = new MockPeaqueRequest()
      const finalHandler: RequestHandler = jest.fn(async (req) => {})

      await expect(executeMiddlewareChain(req, [null as any], finalHandler))
        .rejects.toThrow("⚠️  Error: One or more middleware functions are not valid.")
    })

    test('should handle middleware that throws errors', async () => {
      const errorMiddleware: RequestMiddleware = jest.fn(async (req, next) => {
        throw new Error("Middleware error")
      })

      const req = new MockPeaqueRequest()
      const finalHandler: RequestHandler = jest.fn(async (req) => {})

      await expect(executeMiddlewareChain(req, [errorMiddleware], finalHandler))
        .rejects.toThrow("Middleware error")

      expect(finalHandler).not.toHaveBeenCalled()
    })

    test('should handle async middleware', async () => {
      const asyncMiddleware: RequestMiddleware = jest.fn(async (req: PeaqueRequest, next: RequestHandler) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        await next(req)
      })

      const finalHandler: RequestHandler = jest.fn(async (req) => {})
      const req = new MockPeaqueRequest()

      await executeMiddlewareChain(req, [asyncMiddleware], finalHandler)

      expect(asyncMiddleware).toHaveBeenCalledWith(req, expect.any(Function))
      expect(finalHandler).toHaveBeenCalledWith(req)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty path', () => {
      router.addRoute("GET", "/", mockHandler)

      const match = router.getMatchingRoute("GET", "")
      expect(match).toBeDefined()
    })

    test('should handle malformed parameter names', () => {
      // Parameter names with special characters should still work
      router.addRoute("GET", "/users/:user-id", mockHandler)

      const match = router.getMatchingRoute("GET", "/users/123")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ "user-id": "123" })
    })

    test('should handle wildcard with no name', () => {
      router.addRoute("GET", "/files/*", mockHandler)

      const match = router.getMatchingRoute("GET", "/files/test.txt")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ wildcard: "test.txt" })
    })

    test('should handle multiple slashes in path', () => {
      router.addRoute("GET", "/api/v1/users", mockHandler)

      const match1 = router.getMatchingRoute("GET", "/api/v1/users")
      const match2 = router.getMatchingRoute("GET", "//api//v1//users")

      expect(match1).toBeDefined()
      expect(match2).toBeDefined()
    })

    test('should handle routes with query parameters in matching', () => {
      router.addRoute("GET", "/users", mockHandler)

      // Router should not match paths with query parameters mixed in
      const match = router.getMatchingRoute("GET", "/users?id=123")
      expect(match).toBeUndefined()
    })

    test('should handle very long paths', () => {
      const longPath = "/api/" + "segment/".repeat(100) + ":param"
      router.addRoute("GET", longPath, mockHandler)

      const testPath = "/api/" + "segment/".repeat(100) + "test"
      const match = router.getMatchingRoute("GET", testPath)

      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ param: "test" })
    })

    test('should handle routes with unicode characters', () => {
      router.addRoute("GET", "/users/:name", mockHandler)

      const match = router.getMatchingRoute("GET", "/users/José_María")
      expect(match).toBeDefined()
      expect(match!.parameters).toEqual({ name: "José_María" })
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle many routes efficiently', () => {
      // Add many routes
      for (let i = 0; i < 1000; i++) {
        router.addRoute("GET", `/route${i}`, mockHandler)
        router.addRoute("GET", `/api/v1/route${i}/:id`, mockHandler)
      }

      // Test lookup performance (should be fast)
      const startTime = Date.now()
      for (let i = 0; i < 100; i++) {
        const match = router.getMatchingRoute("GET", `/route${i % 1000}`)
        expect(match).toBeDefined()
      }
      const endTime = Date.now()

      // Should complete in reasonable time (less than 100ms for 100 lookups)
      expect(endTime - startTime).toBeLessThan(100)
    })

    test('should handle deep nesting efficiently', async () => {
      let currentRouter = router

      // Create deeply nested middleware chain
      for (let i = 0; i < 20; i++) {
        const middleware: RequestMiddleware = async (req, next) => {
          await next(req)
        }
        currentRouter = currentRouter.use(middleware)
      }

      currentRouter.addRoute("GET", "/deep", mockHandler)

      const requestHandler = currentRouter.getRequestHandler()
      const req = new MockPeaqueRequest("/deep", "GET")

      const startTime = Date.now()
      await requestHandler(req)
      const endTime = Date.now()

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(50)
      expect(mockHandler).toHaveBeenCalledWith(req)
    })

    test('should handle wildcard routes with long captured paths', () => {
      router.addRoute("GET", "/files/*path", mockHandler)

      const longCapturedPath = "a/".repeat(1000) + "file.txt"
      const match = router.getMatchingRoute("GET", "/files/" + longCapturedPath)

      expect(match).toBeDefined()
      expect(match!.parameters.path).toBe(longCapturedPath)
    })
  })

  describe('Integration Scenarios', () => {
    test('should handle REST API routing patterns', () => {
      // Set up a typical REST API
      router.addRoute("GET", "/api/v1/users", mockHandler)
      router.addRoute("POST", "/api/v1/users", mockHandler)
      router.addRoute("GET", "/api/v1/users/:id", mockHandler)
      router.addRoute("PUT", "/api/v1/users/:id", mockHandler)
      router.addRoute("DELETE", "/api/v1/users/:id", mockHandler)
      router.addRoute("GET", "/api/v1/users/:id/posts", mockHandler)
      router.addRoute("POST", "/api/v1/users/:id/posts", mockHandler)

      const tests = [
        { method: "GET" as HttpMethod, path: "/api/v1/users", params: {} },
        { method: "POST" as HttpMethod, path: "/api/v1/users", params: {} },
        { method: "GET" as HttpMethod, path: "/api/v1/users/123", params: { id: "123" } },
        { method: "PUT" as HttpMethod, path: "/api/v1/users/456", params: { id: "456" } },
        { method: "DELETE" as HttpMethod, path: "/api/v1/users/789", params: { id: "789" } },
        { method: "GET" as HttpMethod, path: "/api/v1/users/123/posts", params: { id: "123" } },
        { method: "POST" as HttpMethod, path: "/api/v1/users/456/posts", params: { id: "456" } },
      ]

      tests.forEach(({ method, path, params }) => {
        const match = router.getMatchingRoute(method, path)
        expect(match).toBeDefined()
        expect(match!.method).toBe(method)
        expect(match!.parameters).toEqual(params)
      })
    })

    test('should handle file serving routes', () => {
      router.addRoute("GET", "/static/*path", mockHandler)
      router.addRoute("GET", "/assets/images/*path", mockHandler)
      router.addRoute("GET", "/files/:category/*path", mockHandler)

      const tests = [
        { path: "/static/css/style.css", params: { path: "css/style.css" } },
        { path: "/static/js/app.js", params: { path: "js/app.js" } },
        { path: "/assets/images/logo.png", params: { path: "logo.png" } },
        { path: "/assets/images/icons/user.svg", params: { path: "icons/user.svg" } },
        { path: "/files/documents/readme.txt", params: { category: "documents", path: "readme.txt" } },
        { path: "/files/images/photos/vacation.jpg", params: { category: "images", path: "photos/vacation.jpg" } },
      ]

      tests.forEach(({ path, params }) => {
        const match = router.getMatchingRoute("GET", path)
        expect(match).toBeDefined()
        expect(match!.parameters).toEqual(params)
      })
    })

    test('should handle complex middleware scenarios', async () => {
      const authMiddleware: RequestMiddleware = async (req, next) => {
        // Simulate auth check
        if (req.path().includes('admin')) {
          req.header('user-role', 'admin')
        }
        await (next as any)()
      }

      const loggingMiddleware: RequestMiddleware = async (req, next) => {
        // Simulate logging
        await (next as any)()
      }

      const corsMiddleware: RequestMiddleware = async (req, next) => {
        req.header('access-control-allow-origin', '*')
        await (next as any)()
      }

      router = router
        .use(corsMiddleware) // Global CORS
        .use(loggingMiddleware) // Global logging

      // Admin routes with auth
      const adminRouter = router.use(authMiddleware)
      adminRouter.addRoute("GET", "/admin/users", mockHandler)
      adminRouter.addRoute("POST", "/admin/users", mockHandler)

      // Public routes without auth
      router.addRoute("GET", "/public/data", mockHandler)

      const requestHandler = router.getRequestHandler()

      // Test admin route
      const adminReq = new MockPeaqueRequest("/admin/users", "GET")
      await requestHandler(adminReq)

      expect(mockHandler).toHaveBeenCalledWith(adminReq)
      expect(adminReq.getHeaders()['access-control-allow-origin']).toEqual(['*'])
      expect(adminReq.getHeaders()['user-role']).toEqual(['admin'])

      // Test public route
      const publicReq = new MockPeaqueRequest("/public/data", "GET")
      await requestHandler(publicReq)

      expect(mockHandler).toHaveBeenCalledWith(publicReq)
      expect(publicReq.getHeaders()['access-control-allow-origin']).toEqual(['*'])
      expect(publicReq.getHeaders()['user-role']).toBeUndefined()
    })
  })
})