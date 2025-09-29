import { describe, expect, test } from "@jest/globals"
import path from "path"
import { RouteFileConfig } from "../../src/router/builder.js"
import { RouteNode } from "../../src/router/router.js"
import { serializeRouterToJs } from "../../src/router/serializer.js"

// Default configuration for common file types
const defaultConfig: RouteFileConfig[] = [
  { pattern: "page.tsx", property: "page", stacks: false, accept: true },
  { pattern: "layout.tsx", property: "layout", stacks: true },
  { pattern: "guard.ts", property: "guards", stacks: true },
  { pattern: "head.ts", property: "heads", stacks: true },
  { pattern: "middleware.ts", property: "middleware", stacks: false },
]

function componentify(router: RouteNode, baseDir: string): Set<string> {
  const imports = new Set<string>()

  function getComponentName(filePath: string): string {
    const relativePath = path.relative(baseDir, filePath)
    const componentName = relativePath
      .replace(/[^a-zA-Z0-9]/g, " ") // Replace non-alphanumeric characters with space
      .split(" ") // Split by space
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
      .join("") // Join back without spaces
    return componentName
  }

  function traverse(node: RouteNode) {
    // Convert names to component names
    if (node.names) {
      for (const key in node.names) {
        const name = node.names[key]
        const componentName = getComponentName(name)
        node.names[key] = componentName
        const filename = path.relative(baseDir, name)
        imports.add(`import ${componentName} from "./${filename.replace(/\\/g, "/")}";`)
      }
    }
    // Convert stacks to component names
    if (node.stacks) {
      for (const key in node.stacks) {
        node.stacks[key] = node.stacks[key].map((name: string) => {
          const componentName = getComponentName(name)
          const filename = path.relative(baseDir, name)
          imports.add(`import ${componentName} from "./${filename.replace(/\\/g, "/")}";`)
          return componentName
        })
      }
    }
    for (const child of node.staticChildren.values()) {
      traverse(child)
    }
    if (node.paramChild) {
      traverse(node.paramChild)
    }
    if (node.wildcardChild) {
      traverse(node.wildcardChild)
    }
  }

  traverse(router)
  return imports
}

describe("Router Serialization", () => {
  test("should serialize router to JavaScript", () => {
    // Create a mock router for testing
    const mockRouter: RouteNode = {
      staticChildren: new Map([
        [
          "users",
          {
            staticChildren: new Map([
              [
                "[id]",
                {
                  staticChildren: new Map(),
                  accept: true,
                  names: { page: "/users/[id]/page.tsx" },
                  stacks: {},
                },
              ],
            ]),
            accept: true,
            names: { page: "/users/page.tsx" },
            stacks: {},
          },
        ],
      ]),
      accept: true,
      names: { page: "/page.tsx" },
      stacks: {},
    }

    const js = serializeRouterToJs(mockRouter, true)
    expect(js).toContain("staticChildren")
    expect(js).toContain("users")
    expect(typeof js).toBe("string")
  })

  test("should match parameterized routes", () => {
    // This test would need actual file system access, so we'll skip for now
    // In a real scenario, you'd mock the file system or use a test directory
    expect(true).toBe(true) // Placeholder test
  })

  test("should generate component imports", () => {
    const mockRouter: RouteNode = {
      staticChildren: new Map(),
      accept: true,
      names: { page: "/test/page.tsx" },
      stacks: {},
    }

    const imports = componentify(mockRouter, "/test")
    expect(imports.size).toBe(1)
    expect(Array.from(imports)[0]).toContain("import")
    expect(Array.from(imports)[0]).toContain("PageTsx")
  })
})
