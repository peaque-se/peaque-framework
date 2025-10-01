///
/// Module to bundle a css file into a single "peaque.css" file using Tailwind 4
///
import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from '@tailwindcss/oxide';
import { createRequire } from "module";

// Create a require function to resolve modules from the framework's node_modules
const frameworkRequire = createRequire(import.meta.url)
const frameworkResolve = frameworkRequire.resolve

export async function bundleCssFile(cssContent : string, basePath: string): Promise<string> {

  // Set up global resolver (like Tailwind's standalone CLI does)
  // This intercepts Tailwind module resolution to use framework's node_modules
  const originalResolver = (globalThis as any).__tw_resolve
  ;(globalThis as any).__tw_resolve = (id: string, baseDir: string) => {
    if (id === "tailwindcss") return frameworkResolve("tailwindcss/index.css")
    return false
  }

  try {
    const compiler = await compile(cssContent, {
      base: basePath,
      from: basePath + "/src/styles.css",
      onDependency: (path) => {
      }
    })
    const scanner = new Scanner({sources: [{ base:basePath, pattern: '**/*', negated: false }]})
    const candidates = scanner.scan()
    const css = compiler.build(candidates)
    const result = optimize(css, {
      minify: true,
    })
    return result.code
  } finally {
    if (originalResolver) {
      (globalThis as any).__tw_resolve = originalResolver
    } else {
      delete (globalThis as any).__tw_resolve
    }
  }
}
