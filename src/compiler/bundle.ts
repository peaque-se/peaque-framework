/// Bundles modules from node_modules, handling both CommonJS and ES modules
/// Uses esbuild to create a single ES module output
/// Handles dependencies by marking them as external to avoid bundling them
/// Converts require calls to import statements for compatibility
/// © Peaque Developers 2025

import * as fs from "fs"
import path from "path"
import * as esbuild from "esbuild"
import { createRequire } from "module"
import { makeImportsRelative } from "./imports.js"

interface PackageJson {
  name?: string
  version?: string
  main?: string
  module?: string
  type?: string
  exports?: unknown
  dependencies?: Record<string, string>
}

/// Determines if a package.json indicates an ES module
/// This is based on the presence of "module" field, the "type" field,
/// and the extensions of the "main" field.
function isESMModule(pkgJson: PackageJson): boolean {
  if (!pkgJson) return false
  if (pkgJson.module) return true
  // if the export contains . and it has an import field, it's ESM
  const exports = pkgJson.exports as Record<string, unknown> | undefined
  if (exports && typeof exports === "object" && exports["."] && typeof exports["."] === "object" && (exports["."] as Record<string, unknown>).import) return true
  if (pkgJson.main && pkgJson.main.endsWith(".cjs")) return false
  if (pkgJson.main && pkgJson.main.endsWith(".mjs")) return true

  return pkgJson.type === "module"
}

const dependencies: string[] = []

/// Bundles a CommonJS module into an ES module using esbuild
/// This is a bit tricky because we need to handle the exports correctly
/// and also make sure that we don't bundle dependencies that are already
/// available in the environment (like react, react-dom, etc.)
/// The strategy is to create a small wrapper module that imports the CJS module
/// using a dynamic import and then re-exports the named exports and the default export.
/// Then we bundle this wrapper module using esbuild and mark the dependencies as external.
/// Finally, we convert any remaining require calls to imports for react and scheduler (TODO: generalize this)
async function bundleCommonJSModule(moduleName: string, pkgJson: PackageJson, basePath: string): Promise<string> {
  const moduleBaseName = moduleName.split("/")[0]
  const require = createRequire("file://" + path.join(basePath, "noop.js").replace(/\\/g, "/"))
  const mod = require(moduleName)
  const keys = Object.keys(mod)
  let code = `import cjs from ${JSON.stringify(moduleName)};\n\n`
  if (keys.length > 0) {
    code += `export const { ${keys.join(", ")} } = cjs;\n`
  }
  code += `export default cjs;\n`

  const result = await esbuild.build({
    stdin: {
      contents: code,
      resolveDir: basePath,
      sourcefile: "stdin.js",
      loader: "js",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    splitting: false,
    define: { "process.env.NODE_ENV": '"development"' },
    external: dependencies.filter((d) => d !== moduleBaseName),
  })
  return makeImportsRelative(convertRequiresToImports(result.outputFiles[0].text))
}

/// Converts require(XXX) calls to import statements and inject a fake require function
/// This is a bit of a hack and only works for simple cases
/// TODO: use a proper parser to handle all cases
function convertRequiresToImports(bundledCode: string): string {
  const addedImports = new Set<string>()

  for (const match of bundledCode.matchAll(/require\(([^)]+)\)/g)) {
    const requirePath: string = match[1]
    const importName = `__pq__${requirePath.replace(/["']/g, "").trim()}`
    const importLine = `import * as ${importName} from ${requirePath};`
    addedImports.add(importLine)
  }

  if (addedImports.size === 0) {
    return bundledCode
  }

  const requireLines = []
  requireLines.push(`function require(path) {`)
  addedImports.forEach((line) => {
    const match = line.match(/import \* as (__pq__[^ ]+) from (.+);/)
    if (match) {
      const importName = match[1]
      const importPath = match[2]
      requireLines.push(`  if (path === ${importPath}) return ${importName};`)
    }
  })
  requireLines.push(`  throw new Error("Cannot find module '" + path + "'");`)
  requireLines.push(`}`)

  const addedImportsString = Array.from(addedImports.values()).join("\n")
  const requireString = requireLines.join("\n")
  return addedImportsString + "\n" + requireString + "\n" + bundledCode
}

/// Bundles an ESM module using esbuild
/// This is simpler than the CJS case because we can just re-export everything
/// and let esbuild handle the tree-shaking and bundling.
/// We still need to mark dependencies as external to avoid bundling them.
export async function bundleESMModule(moduleName: string, moduleBaseName: string, pkgJson: PackageJson, basePath: string): Promise<string> {
  let code = `export * from ${JSON.stringify(moduleName)};\n`
  const result = await esbuild.build({
    stdin: {
      contents: code,
      resolveDir: basePath,
      sourcefile: "stdin.js",
      loader: "js",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    splitting: false,
    define: { "process.env.NODE_ENV": '"development"' },
    external: dependencies.filter((d) => d !== moduleBaseName && d !== moduleName),
  })
  return makeImportsRelative(convertRequiresToImports(result.outputFiles[0].text))
}

/// Finds the correct module name in node_modules, handling scoped packages and sub-paths
/// For example, for moduleName = "@scope/package/sub/path", it will check for
/// "@scope/package", then "@scope", and finally "package" until it finds a package.json
function findModuleName(moduleName: string, basePath: string): string | null {
  if (moduleName.includes("/")) {
    const parts = moduleName.split("/")
    for (let i = parts.length; i > 0; i--) {
      const attempt = parts.slice(0, i).join("/")
      if (fs.existsSync(path.join(basePath, "node_modules", attempt, "package.json"))) {
        return attempt
      }
    }
    return null
  }
  return fs.existsSync(path.join(basePath, "node_modules", moduleName, "package.json")) ? moduleName : null
}

/// Sets the base dependencies from the package.json in the given basePath
/// This is used to avoid bundling dependencies that are already available in the environment
export function setBaseDependencies(basePath: string) {
  if (true) {
    const pkgPath = path.join(basePath, "package.json")
    if (!fs.existsSync(pkgPath)) {
      throw new Error(`No package.json found in the current directory: ${basePath}`)
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson
    const deps = Object.keys(pkg.dependencies || {})
    dependencies.push(...deps)
  }

  // also exclude any dependencies that @peaque/framework depends on
  const frameworkPkgPath = path.join(basePath, "node_modules", "@peaque", "framework", "package.json")
  if (fs.existsSync(frameworkPkgPath)) {
    const frameworkPkg = JSON.parse(fs.readFileSync(frameworkPkgPath, "utf-8")) as PackageJson
    const frameworkDeps = Object.keys(frameworkPkg.dependencies || {})
    const ownDeps = frameworkDeps.filter((d) => !dependencies.includes(d))
    dependencies.push(...ownDeps)
  } else {
    console.warn(`Warning: Could not find @peaque/framework package.json in ${frameworkPkgPath}. Make sure @peaque/framework is installed.`)
  }
}

// Bundles a module from node_modules, handling both CommonJS and ESM modules
// It first determines the module type by checking the package.json
// Then it calls the appropriate bundling function
export async function bundleModuleFromNodeModules(moduleName: string, basePath: string): Promise<string> {
  // try to load it from node_modules/@peaque/framework if not found
  let moduleBaseName = findModuleName(moduleName, basePath)
  if (!moduleBaseName) {
    moduleBaseName = findModuleName(moduleName, path.join(basePath, "node_modules", "@peaque", "framework"))
    if (!moduleBaseName) {
      throw new Error(`Module ${moduleName} not found in node_modules or node_modules/@peaque/framework`)
    } else {
      basePath = path.join(basePath, "node_modules", "@peaque", "framework")
    }
  }

  const pkgJsonPath = path.join(basePath, "node_modules", moduleBaseName, "package.json")
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as PackageJson

  const isESM = isESMModule(pkgJson)

  if (!isESM) {
    return await bundleCommonJSModule(moduleName, pkgJson, basePath)
  } else {
    return await bundleESMModule(moduleName, moduleBaseName, pkgJson, basePath)
  }
}
