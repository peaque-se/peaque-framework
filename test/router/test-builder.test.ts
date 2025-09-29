import { buildRouter, RouteFileConfig } from "../../src/router/builder.js"
import { MockFileSystem } from "../../src/router/utils.js"
import { match } from "../../src/router/router.js"
import { describe, test, expect } from '@jest/globals'

describe('Router Builder', () => {
  test('should build router with mock filesystem', () => {
    const mockFs = new MockFileSystem()

    // Set up a mock directory structure
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

    const config: RouteFileConfig[] = [
      { pattern: "page.tsx", property: "page", stacks: false, accept: true }
    ]

    const router = buildRouter("/app/pages", config, mockFs)

    // Test the router
    const homeMatch = match("/", router)
    expect(homeMatch?.pattern).toBe("/")

    const usersMatch = match("/users", router)
    expect(usersMatch?.pattern).toBe("/users")

    const userMatch = match("/users/123", router)
    expect(userMatch?.pattern).toBe("/users/:id")
    expect(userMatch?.params).toEqual({ id: "123" })
  })
})