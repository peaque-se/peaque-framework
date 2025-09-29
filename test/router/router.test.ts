import { buildRouter, RouteFileConfig } from "../../src/router/builder.js"
import { match, RouteNode, MatchResult } from "../../src/router/router.js"
import { serializeRouterToJs } from "../../src/router/serializer.js"
import { MockFileSystem } from "../../src/router/utils.js"
import { describe, test, expect, beforeEach } from '@jest/globals'

describe('Router - Comprehensive Tests', () => {
  let mockFs: MockFileSystem
  let defaultConfig: RouteFileConfig[]

  beforeEach(() => {
    mockFs = new MockFileSystem()
    defaultConfig = [
      { pattern: "page.tsx", property: "page", stacks: false, accept: true },
      { pattern: "layout.tsx", property: "layout", stacks: true },
      { pattern: "middleware.ts", property: "middleware", stacks: false },
      { pattern: "guard.ts", property: "guards", stacks: true },
    ]
  })

  describe('match() function', () => {
    test('should match root route', () => {
      const root: RouteNode = {
        staticChildren: new Map(),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      const result = match("/", root)
      expect(result).toEqual({
        pattern: "/",
        params: {},
        names: { page: "/page.tsx" },
        stacks: {}
      })
    })

    test('should match static routes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }],
          ["posts", {
            staticChildren: new Map(),
            names: { page: "/posts/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      expect(match("/users", root)?.pattern).toBe("/users")
      expect(match("/posts", root)?.pattern).toBe("/posts")
      expect(match("/nonexistent", root)).toBeNull()
    })

    test('should match parameterized routes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            paramChild: {
              paramName: "id",
              staticChildren: new Map(),
              names: { page: "/users/[id]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      const result = match("/users/123", root)
      expect(result?.pattern).toBe("/users/:id")
      expect(result?.params).toEqual({ id: "123" })
    })

    test('should match nested parameterized routes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            paramChild: {
              paramName: "userId",
              staticChildren: new Map([
                ["posts", {
                  staticChildren: new Map(),
                  paramChild: {
                    paramName: "postId",
                    staticChildren: new Map(),
                    names: { page: "/users/[userId]/posts/[postId]/page.tsx" },
                    stacks: {},
                    accept: true
                  },
                  names: { page: "/users/[userId]/posts/page.tsx" },
                  stacks: {},
                  accept: true
                }]
              ]),
              names: { page: "/users/[userId]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      expect(match("/users/123/posts/456", root)?.params).toEqual({ userId: "123", postId: "456" })
      expect(match("/users/123/posts", root)?.params).toEqual({ userId: "123" })
    })

    test('should match wildcard routes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["files", {
            staticChildren: new Map(),
            wildcardChild: {
              paramName: "path",
              optional: false,
              staticChildren: new Map(),
              names: { page: "/files/[...path]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/files/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      const result = match("/files/docs/readme.txt", root)
      expect(result?.pattern).toBe("/files/*path")
      expect(result?.params).toEqual({ path: "docs/readme.txt" })
    })

    test('should match optional wildcard routes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["api", {
            staticChildren: new Map(),
            names: { page: "/api/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        wildcardChild: {
          paramName: "path",
          optional: true,
          staticChildren: new Map(),
          names: { page: "/[...path]/page.tsx" },
          stacks: {},
          accept: true
        },
        names: {}, // No page at root
        stacks: {},
        accept: false // Root doesn't accept, wildcard does
      }

      // Should match with path
      const result1 = match("/api/v1/users", root)
      expect(result1?.params).toEqual({ path: "api/v1/users" })
      expect(result1?.pattern).toBe("/*path?")

      // Should match without path (optional) - matches root wildcard
      const result2 = match("/unknown", root)
      expect(result2?.params).toEqual({ path: "unknown" })
      expect(result2?.pattern).toBe("/*path?")

      // Root does not match optional wildcard with empty path
      const result3 = match("/", root)
      expect(result3).toBeNull()
    })

    test('should handle excluded routes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["(auth)", {
            excludeFromPath: true,
            staticChildren: new Map([
              ["login", {
                staticChildren: new Map(),
                names: { page: "/(auth)/login/page.tsx" },
                stacks: {},
                accept: true
              }]
            ]),
            names: {},
            stacks: {},
            accept: false
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      const result = match("/login", root)
      expect(result?.pattern).toBe("/login")
      expect(result?.names.page).toBe("/(auth)/login/page.tsx")
    })

    test('should aggregate names and stacks from parent nodes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            names: { layout: "/users/layout.tsx" },
            stacks: { guards: ["/users/guard.ts"] },
            paramChild: {
              paramName: "id",
              staticChildren: new Map(),
              names: { page: "/users/[id]/page.tsx" },
              stacks: { guards: ["/users/[id]/guard.ts"] },
              accept: true
            },
            accept: true
          }]
        ]),
        names: { layout: "/layout.tsx" },
        stacks: { middleware: ["/middleware.ts"] },
        accept: true
      }

      const result = match("/users/123", root)
      expect(result?.names).toEqual({
        layout: "/users/layout.tsx", // from users node
        page: "/users/[id]/page.tsx"  // from [id] node
      })
      expect(result?.stacks).toEqual({
        guards: ["/users/guard.ts", "/users/[id]/guard.ts"], // stacks accumulate
        middleware: ["/middleware.ts"]
      })
    })

    test('should handle trailing slashes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      expect(match("/users/", root)?.pattern).toBe("/users")
      expect(match("/", root)?.pattern).toBe("/")
    })

    test('should handle empty and malformed paths', () => {
      const root: RouteNode = {
        staticChildren: new Map(),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      expect(match("", root)?.pattern).toBe("/")
      expect(match("//", root)?.pattern).toBe("/")
    })

    test('should prefer static routes over param routes', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map([
              ["new", {
                staticChildren: new Map(),
                names: { page: "/users/new/page.tsx" },
                stacks: {},
                accept: true
              }]
            ]),
            paramChild: {
              paramName: "id",
              staticChildren: new Map(),
              names: { page: "/users/[id]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      const staticResult = match("/users/new", root)
      expect(staticResult?.pattern).toBe("/users/new")
      expect(staticResult?.params).toEqual({})

      const paramResult = match("/users/123", root)
      expect(paramResult?.pattern).toBe("/users/:id")
      expect(paramResult?.params).toEqual({ id: "123" })
    })

    test('should decode URL parameters', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            paramChild: {
              paramName: "id",
              staticChildren: new Map(),
              names: { page: "/users/[id]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      // Test URL-encoded parameter
      const result = match("/users/my%2Fid", root)
      expect(result?.params).toEqual({ id: "my/id" })
    })

    test('should produce correct pattern for optional wildcard routes', () => {
      const root: RouteNode = {
        staticChildren: new Map(),
        wildcardChild: {
          paramName: "slug",
          optional: true,
          staticChildren: new Map(),
          names: { page: "/[[...slug]]/page.tsx" },
          stacks: {},
          accept: true
        },
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      // Optional wildcard should produce /*slug? pattern
      const result = match("/some/path", root)
      expect(result?.pattern).toBe("/*slug?")
      expect(result?.params).toEqual({ slug: "some/path" })
    })

    test('should decode wildcard URL parameters', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["files", {
            staticChildren: new Map(),
            wildcardChild: {
              paramName: "path",
              optional: false,
              staticChildren: new Map(),
              names: { page: "/files/[...path]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/files/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      // Test URL-encoded wildcard parameter
      const result = match("/files/docs%2Freadme.txt", root)
      expect(result?.params).toEqual({ path: "docs/readme.txt" })
    })

    test('should handle malformed URL encoding gracefully', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            paramChild: {
              paramName: "id",
              staticChildren: new Map(),
              names: { page: "/users/[id]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      // Test malformed URL encoding (should fall back to raw value)
      const result = match("/users/invalid%2", root)
      expect(result?.params).toEqual({ id: "invalid%2" })
    })
  })

  describe('buildRouter() function', () => {
    test('should build router from directory structure', () => {
      mockFs.addDirectory("/app/pages", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/page.tsx" },
        { name: "users", isDirectory: true, isFile: false, path: "/app/pages/users" }
      ])

      mockFs.addDirectory("/app/pages/users", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/page.tsx" },
        { name: "[id]", isDirectory: true, isFile: false, path: "/app/pages/users/[id]" }
      ])

      mockFs.addDirectory("/app/pages/users/[id]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/[id]/page.tsx" }
      ])

      const router = buildRouter("/app/pages", defaultConfig, mockFs)

      expect(router.accept).toBe(true)
      expect(router.names.page).toBe("/app/pages/page.tsx")
      expect(router.staticChildren.has("users")).toBe(true)

      const usersNode = router.staticChildren.get("users")!
      expect(usersNode.accept).toBe(true)
      expect(usersNode.names.page).toBe("/app/pages/users/page.tsx")
      expect(usersNode.paramChild).toBeDefined()
      expect(usersNode.paramChild!.paramName).toBe("id")
      expect(usersNode.paramChild!.names.page).toBe("/app/pages/users/[id]/page.tsx")
    })

    test('should handle stacked files', () => {
      mockFs.addDirectory("/app/pages", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/page.tsx" },
        { name: "layout.tsx", isFile: true, isDirectory: false, path: "/app/pages/layout.tsx" },
        { name: "guard.ts", isFile: true, isDirectory: false, path: "/app/pages/guard.ts" },
        { name: "users", isDirectory: true, isFile: false, path: "/app/pages/users" }
      ])

      mockFs.addDirectory("/app/pages/users", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/page.tsx" },
        { name: "layout.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/layout.tsx" },
        { name: "guard.ts", isFile: true, isDirectory: false, path: "/app/pages/users/guard.ts" }
      ])

      const router = buildRouter("/app/pages", defaultConfig, mockFs)

      expect(router.stacks.layout).toEqual(["/app/pages/layout.tsx"])
      expect(router.stacks.guards).toEqual(["/app/pages/guard.ts"])

      const usersNode = router.staticChildren.get("users")!
      expect(usersNode.stacks.layout).toEqual(["/app/pages/users/layout.tsx"])
      expect(usersNode.stacks.guards).toEqual(["/app/pages/users/guard.ts"])
    })

    test('should handle wildcard routes', () => {
      mockFs.addDirectory("/app/pages", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/page.tsx" },
        { name: "[...slug]", isDirectory: true, isFile: false, path: "/app/pages/[...slug]" }
      ])

      mockFs.addDirectory("/app/pages/[...slug]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/[...slug]/page.tsx" }
      ])

      const router = buildRouter("/app/pages", defaultConfig, mockFs)

      expect(router.wildcardChild).toBeDefined()
      expect(router.wildcardChild!.paramName).toBe("slug")
      expect(router.wildcardChild!.optional).toBe(false)
    })

    test('should handle optional wildcard routes', () => {
      mockFs.addDirectory("/app/pages", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/page.tsx" },
        { name: "[[...slug]]", isDirectory: true, isFile: false, path: "/app/pages/[[...slug]]" }
      ])

      mockFs.addDirectory("/app/pages/[[...slug]]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/[[...slug]]/page.tsx" }
      ])

      const router = buildRouter("/app/pages", defaultConfig, mockFs)

      expect(router.wildcardChild).toBeDefined()
      expect(router.wildcardChild!.paramName).toBe("slug")
      expect(router.wildcardChild!.optional).toBe(true)
    })

    test('should handle excluded routes', () => {
      mockFs.addDirectory("/app/pages", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/page.tsx" },
        { name: "(auth)", isDirectory: true, isFile: false, path: "/app/pages/(auth)" }
      ])

      mockFs.addDirectory("/app/pages/(auth)", [
        { name: "login", isDirectory: true, isFile: false, path: "/app/pages/(auth)/login" }
      ])

      mockFs.addDirectory("/app/pages/(auth)/login", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/(auth)/login/page.tsx" }
      ])

      const router = buildRouter("/app/pages", defaultConfig, mockFs)

      const authNode = router.staticChildren.get("(auth)")!
      expect(authNode.excludeFromPath).toBe(true)

      const loginNode = authNode.staticChildren.get("login")!
      expect(loginNode.names.page).toBe("/app/pages/(auth)/login/page.tsx")
    })

    test('should throw error for ambiguous excluded routes', () => {
      mockFs.addDirectory("/app/pages", [
        { name: "(auth)", isDirectory: true, isFile: false, path: "/app/pages/(auth)" },
        { name: "(admin)", isDirectory: true, isFile: false, path: "/app/pages/(admin)" }
      ])

      mockFs.addDirectory("/app/pages/(auth)", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/(auth)/page.tsx" }
      ])

      mockFs.addDirectory("/app/pages/(admin)", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/(admin)/page.tsx" }
      ])

      expect(() => buildRouter("/app/pages", defaultConfig, mockFs)).toThrow("Ambiguous routes")
    })

    test('should handle empty directories', () => {
      mockFs.addDirectory("/app/pages", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/page.tsx" },
        { name: "empty", isDirectory: true, isFile: false, path: "/app/pages/empty" }
      ])

      mockFs.addDirectory("/app/pages/empty", [])

      const router = buildRouter("/app/pages", defaultConfig, mockFs)

      expect(router.staticChildren.has("empty")).toBe(true)
      const emptyNode = router.staticChildren.get("empty")!
      expect(emptyNode.accept).toBe(false)
    })
  })

  describe('serializeRouterToJs() function', () => {
    test('should serialize simple router', () => {
      const root: RouteNode = {
        staticChildren: new Map(),
        names: { page: "HomePage" },
        stacks: {},
        accept: true
      }

      const js = serializeRouterToJs(root, true)
      expect(js).toContain("const router = {")
      expect(js).toContain("names: { page: HomePage }")
      expect(js).toContain("accept: true")
    })

    test('should serialize complex router with component names', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            paramChild: {
              paramName: "id",
              staticChildren: new Map(),
              names: { page: "UserDetailPage" },
              stacks: { guards: ["AuthGuard", "UserGuard"] },
              accept: true
            },
            names: { page: "UsersPage" },
            stacks: { layout: ["MainLayout"] },
            accept: true
          }]
        ]),
        names: { page: "HomePage" },
        stacks: { middleware: ["GlobalMiddleware"] },
        accept: true
      }

      const js = serializeRouterToJs(root, true)
      expect(js).toContain("staticChildren: new Map([")
      expect(js).toContain('"users"')
      expect(js).toContain("paramChild:")
      expect(js).toContain("paramName: \"id\"")
      expect(js).toContain("names: { page: UserDetailPage }")
      expect(js).toContain("stacks: { guards: [AuthGuard, UserGuard] }")
    })

    test('should serialize with string literals when namesAndStacksAreComponentNames is false', () => {
      const root: RouteNode = {
        staticChildren: new Map(),
        names: { page: "/page.tsx" },
        stacks: { layout: ["/layout.tsx"] },
        accept: true
      }

      const js = serializeRouterToJs(root, false)
      expect(js).toContain('names: {"page":"/page.tsx"}')
      expect(js).toContain('stacks: {"layout":["/layout.tsx"]}')
    })

    test('should handle wildcard children', () => {
      const root: RouteNode = {
        staticChildren: new Map(),
        wildcardChild: {
          paramName: "path",
          optional: true,
          staticChildren: new Map(),
          names: { page: "CatchAllPage" },
          stacks: {},
          accept: true
        },
        names: { page: "HomePage" },
        stacks: {},
        accept: true
      }

      const js = serializeRouterToJs(root, true)
      expect(js).toContain("wildcardChild:")
      expect(js).toContain("paramName: \"path\"")
      expect(js).toContain("optional: true")
    })
  })

  describe('Integration tests', () => {
    test('should build and match complex routing structure', () => {
      // Set up a complex directory structure
      mockFs.addDirectory("/app/pages", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/page.tsx" },
        { name: "layout.tsx", isFile: true, isDirectory: false, path: "/app/pages/layout.tsx" },
        { name: "users", isDirectory: true, isFile: false, path: "/app/pages/users" },
        { name: "posts", isDirectory: true, isFile: false, path: "/app/pages/posts" },
        { name: "[...notfound]", isDirectory: true, isFile: false, path: "/app/pages/[...notfound]" }
      ])

      mockFs.addDirectory("/app/pages/users", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/page.tsx" },
        { name: "layout.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/layout.tsx" },
        { name: "[id]", isDirectory: true, isFile: false, path: "/app/pages/users/[id]" }
      ])

      mockFs.addDirectory("/app/pages/users/[id]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/[id]/page.tsx" },
        { name: "posts", isDirectory: true, isFile: false, path: "/app/pages/users/[id]/posts" }
      ])

      mockFs.addDirectory("/app/pages/users/[id]/posts", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/[id]/posts/page.tsx" },
        { name: "[postId]", isDirectory: true, isFile: false, path: "/app/pages/users/[id]/posts/[postId]" }
      ])

      mockFs.addDirectory("/app/pages/users/[id]/posts/[postId]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/users/[id]/posts/[postId]/page.tsx" }
      ])

      mockFs.addDirectory("/app/pages/posts", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/posts/page.tsx" },
        { name: "[id]", isDirectory: true, isFile: false, path: "/app/pages/posts/[id]" }
      ])

      mockFs.addDirectory("/app/pages/posts/[id]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/posts/[id]/page.tsx" }
      ])

      mockFs.addDirectory("/app/pages/[...notfound]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/pages/[...notfound]/page.tsx" }
      ])

      const router = buildRouter("/app/pages", defaultConfig, mockFs)

      // Test various routes
      expect(match("/", router)?.pattern).toBe("/")
      expect(match("/users", router)?.pattern).toBe("/users")
      expect(match("/users/123", router)?.params).toEqual({ id: "123" })
      expect(match("/users/123/posts", router)?.params).toEqual({ id: "123" })
      expect(match("/users/123/posts/456", router)?.params).toEqual({ id: "123", postId: "456" })
      expect(match("/posts", router)?.pattern).toBe("/posts")
      expect(match("/posts/789", router)?.params).toEqual({ id: "789" })
      expect(match("/unknown/path", router)?.params).toEqual({ notfound: "unknown/path" })

      // Test stacks accumulation
      const userDetailMatch = match("/users/123", router)
      expect(userDetailMatch?.stacks.layout).toEqual(["/app/pages/layout.tsx", "/app/pages/users/layout.tsx"])
    })

    test('should handle real-world Next.js style routing', () => {
      // Simulate a Next.js style app directory structure
      mockFs.addDirectory("/app", [
        { name: "layout.tsx", isFile: true, isDirectory: false, path: "/app/layout.tsx" },
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/page.tsx" },
        { name: "dashboard", isDirectory: true, isFile: false, path: "/app/dashboard" },
        { name: "(auth)", isDirectory: true, isFile: false, path: "/app/(auth)" }
      ])

      mockFs.addDirectory("/app/dashboard", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/dashboard/page.tsx" },
        { name: "layout.tsx", isFile: true, isDirectory: false, path: "/app/dashboard/layout.tsx" },
        { name: "[userId]", isDirectory: true, isFile: false, path: "/app/dashboard/[userId]" }
      ])

      mockFs.addDirectory("/app/dashboard/[userId]", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/dashboard/[userId]/page.tsx" },
        { name: "settings", isDirectory: true, isFile: false, path: "/app/dashboard/[userId]/settings" }
      ])

      mockFs.addDirectory("/app/dashboard/[userId]/settings", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/dashboard/[userId]/settings/page.tsx" }
      ])

      mockFs.addDirectory("/app/(auth)", [
        { name: "login", isDirectory: true, isFile: false, path: "/app/(auth)/login" }
      ])

      mockFs.addDirectory("/app/(auth)/login", [
        { name: "page.tsx", isFile: true, isDirectory: false, path: "/app/(auth)/login/page.tsx" }
      ])

      const router = buildRouter("/app", defaultConfig, mockFs)

      // Test root and dashboard
      expect(match("/", router)?.names.page).toBe("/app/page.tsx")
      expect(match("/dashboard", router)?.names.page).toBe("/app/dashboard/page.tsx")

      // Test parameterized routes
      const userDashboard = match("/dashboard/user123", router)
      expect(userDashboard?.params).toEqual({ userId: "user123" })
      expect(userDashboard?.names.page).toBe("/app/dashboard/[userId]/page.tsx")

      // Test nested routes
      const userSettings = match("/dashboard/user123/settings", router)
      expect(userSettings?.params).toEqual({ userId: "user123" })
      expect(userSettings?.names.page).toBe("/app/dashboard/[userId]/settings/page.tsx")

      // Test excluded routes
      expect(match("/login", router)?.names.page).toBe("/app/(auth)/login/page.tsx")

      // Test layout inheritance
      const dashboardMatch = match("/dashboard", router)
      expect(dashboardMatch?.stacks.layout).toEqual(["/app/layout.tsx", "/app/dashboard/layout.tsx"])
    })
  })

  describe('Error handling and edge cases', () => {
    test('should handle deeply nested routes', () => {
      // Create a deeply nested structure
      let currentNode: RouteNode = {
        staticChildren: new Map(),
        names: {},
        stacks: {},
        accept: false
      }

      const root = currentNode

      // Create 10 levels of nesting
      for (let i = 0; i < 10; i++) {
        const child: RouteNode = {
          staticChildren: new Map(),
          names: {},
          stacks: {},
          accept: false
        }
        currentNode.staticChildren.set(`level${i}`, child)
        currentNode = child
      }

      currentNode.accept = true
      currentNode.names.page = "/deep/page.tsx"

      const path = "/" + Array.from({ length: 10 }, (_, i) => `level${i}`).join("/")
      const result = match(path, root)
      expect(result?.pattern).toBe(path)
      expect(result?.names.page).toBe("/deep/page.tsx")
    })

    test('should handle routes with special characters in params', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["api", {
            staticChildren: new Map(),
            paramChild: {
              paramName: "path",
              staticChildren: new Map(),
              names: { page: "/api/[path]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: {},
            stacks: {},
            accept: false
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      // Test params with special characters
      const result1 = match("/api/user@domain.com", root)
      expect(result1?.params).toEqual({ path: "user@domain.com" })

      const result2 = match("/api/file-name_with.special.chars", root)
      expect(result2?.params).toEqual({ path: "file-name_with.special.chars" })

      const result3 = match("/api/123-456-789", root)
      expect(result3?.params).toEqual({ path: "123-456-789" })
    })

    test('should handle empty param matches', () => {
      const root: RouteNode = {
        staticChildren: new Map([
          ["users", {
            staticChildren: new Map(),
            paramChild: {
              paramName: "id",
              staticChildren: new Map(),
              names: { page: "/users/[id]/page.tsx" },
              stacks: {},
              accept: true
            },
            names: { page: "/users/page.tsx" },
            stacks: {},
            accept: true
          }]
        ]),
        names: { page: "/page.tsx" },
        stacks: {},
        accept: true
      }

      // "/users/" matches the static users route
      const result = match("/users/", root)
      expect(result?.pattern).toBe("/users")
      expect(result?.params).toEqual({})

      // "/users/123" matches the param route
      const result2 = match("/users/123", root)
      expect(result2?.pattern).toBe("/users/:id")
      expect(result2?.params).toEqual({ id: "123" })
    })

    test('should validate route configuration', () => {
      // Test with empty config
      const router1 = buildRouter("/empty", [], mockFs)
      expect(router1.accept).toBe(false)
      expect(router1.staticChildren.size).toBe(0)

      // Test with config that has no accept patterns
      const configWithoutAccept = [
        { pattern: "layout.tsx", property: "layout", stacks: true, accept: false }
      ]
      const router2 = buildRouter("/empty", configWithoutAccept, mockFs)
      expect(router2.accept).toBe(false)
    })
  })
})