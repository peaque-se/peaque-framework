import * as fs from "fs"
import path from "path"
import * as esbuild from "esbuild"
import { createRequire } from "module"
import { makeImportsRelative } from "./imports.js"

function isESMModule(pkgJson: any): boolean {
  if (pkgJson.name === "tailwind-merge") return true
  if (!pkgJson) return false
  if (pkgJson.module) return true
  if (pkgJson.main && pkgJson.main.endsWith(".cjs")) return false
  if (pkgJson.main && pkgJson.main.endsWith(".mjs")) return true

  return pkgJson.type === "module"
}

const dependencies: string[] = []

async function bundleCommonJSModule(moduleName: string, pkgJson: any, basePath: string): Promise<string> {
  const moduleBaseName = moduleName.split("/")[0]
  const moduleRequestPath = moduleName.includes("/") ? moduleName.split("/").slice(1).join("/") : ""

  //console.log(`Bundling CommonJS module: ${moduleName}, base: ${dependencies}`)
  // let entryPath = path.join(basePath, "node_modules", moduleBaseName, pkgJson.main || "index.js")
  // // understand the package.json exports field if it exists
  // if (pkgJson.exports) {
  //   if (typeof pkgJson.exports === "string") {
  //     // simple case, exports is a string
  //     entryPath = path.join("node_modules", moduleBaseName, pkgJson.exports)
  //   } else if (typeof pkgJson.exports === "object") {
  //     // more complex case, exports is an object
  //     if (pkgJson.exports[`./${moduleRequestPath}`]) {
  //       if (typeof pkgJson.exports[`./${moduleRequestPath}`] === "string") {
  //         entryPath = path.join("node_modules", moduleBaseName, pkgJson.exports[`./${moduleRequestPath}`])
  //       } else if (typeof pkgJson.exports[`./${moduleRequestPath}`] === "object" && pkgJson.exports[`./${moduleRequestPath}`].import) {
  //         entryPath = path.join("node_modules", moduleBaseName, pkgJson.exports[`./${moduleRequestPath}`].import)
  //       } else if (typeof pkgJson.exports[`./${moduleRequestPath}`] === "object" && pkgJson.exports[`./${moduleRequestPath}`].default) {
  //         entryPath = path.join("node_modules", moduleBaseName, pkgJson.exports[`./${moduleRequestPath}`].default)
  //       }
  //     } else if (pkgJson.exports["."]) {
  //       if (typeof pkgJson.exports["."] === "string") {
  //         entryPath = path.join("node_modules", moduleBaseName, pkgJson.exports["."])
  //       } else if (typeof pkgJson.exports["."] === "object" && pkgJson.exports["."].import) {
  //         entryPath = path.join("node_modules", moduleBaseName, pkgJson.exports["."].import)
  //       } else if (typeof pkgJson.exports["."] === "object" && pkgJson.exports["."].default) {
  //         entryPath = path.join("node_modules", moduleBaseName, pkgJson.exports["."].default)
  //       }
  //     }
  //   }
  // }
  //console.log(`Bundling CommonJS module: ${moduleName}, entryPath: ${entryPath}`)

  const require = createRequire("file://" + path.join(basePath, "noop.js").replace(/\\/g, "/"))
  const mod = require(moduleName)
  const keys = Object.keys(mod)
  let code = `import cjs from ${JSON.stringify(moduleName)};\n\n`
  if (keys.length > 0) {
    code += `export const { ${keys.join(", ")} } = cjs;\n`
  }
  code += `export default cjs;\n`


  // for commonjs modules, we need to bundle them using esbuild
  // find the main file from package.json
  const result = await esbuild.build({
    //entryPoints: [entryPath],
    stdin: {
      contents: code,
      resolveDir: basePath,
      sourcefile: "stdin.js",
      loader: "js",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    splitting: false,
    define: { "process.env.NODE_ENV": '"development"' },
    external: dependencies.filter(d => d !== moduleBaseName),
  })
  return convertRequiresToImports(result.outputFiles[0].text)
  //return result.outputFiles[0].text
}

function convertRequiresToImports(bundledCode: string): string {
  let result = bundledCode

  // // print all occurrences of require(...) calls
  // result.match(/require\([^)]+\)/g)?.forEach(req => {
  //   console.log("Found require call:", req)
  // })

  // Add import statement at the top if there are require calls for react
  // also handle "scheduler"

  if (result.includes('require("react")') || result.includes('require("react/jsx-runtime")') || result.includes('require("scheduler")')) {
    const lines = []
    lines.push('import * as peaque_React from "/@deps/react";')
    lines.push('import * as peaque_JSX from "/@deps/react/jsx-runtime";')
    lines.push('import * as peaque_Scheduler from "/@deps/scheduler";')


    lines.push('function require(moduleName) { ')
    lines.push('  console.log("Requiring module:", moduleName);')
    lines.push('  if (moduleName === "react") return peaque_React;')
    lines.push('  if (moduleName === "react/jsx-runtime") return peaque_JSX;')
    lines.push('  if (moduleName === "scheduler") return peaque_Scheduler;')
    lines.push('  throw new Error("Module not found: " + moduleName);')
    lines.push('}')
    lines.push(result)
    
    result = lines.join("\n")
  }
  
  return result
}

async function bundleESMModule(moduleName: string, moduleBaseName: string, pkgJson: any, basePath: string): Promise<string> {
  let code = `export * from ${JSON.stringify(moduleBaseName)};\n`

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
    external: dependencies.filter(d => d !== moduleBaseName && d !== moduleName),
  })
  return convertRequiresToImports(makeImportsRelative(result.outputFiles[0].text))
}

function findModuleName(moduleName: string, basePath: string): string {
  // if the moduleName contains any /, check all parts until we find a match
  if (moduleName.includes("/")) {
    const parts = moduleName.split("/")
    for (let i = 0; i < parts.length; i++) {
      const attempt = parts.slice(0, i+1).join("/")
      //console.log(`Checking for module: ${attempt}`)
      if (fs.existsSync(path.join(basePath, "node_modules", attempt, "package.json"))) {
        return attempt
      }
    }
    throw new Error(`Could not find module name for ${moduleName}`)
  }
  return moduleName
}

export function setBaseDependencies(basePath: string) {
  const pkgPath = path.join(basePath, "package.json")
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`No package.json found in the current directory: ${basePath}`)
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
  const deps = Object.keys(pkg.dependencies || {})
  dependencies.push(...deps)
}

export async function bundleModuleFromNodeModules(moduleName: string, basePath: string): Promise<string> {
  const moduleBaseName = findModuleName(moduleName, basePath)

  const pkgJsonPath = path.join(basePath, "node_modules", moduleBaseName, "package.json")
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"))

  const isESM = isESMModule(pkgJson)

  //console.log(`Bundling module: ${moduleName}, isESM: ${isESM}`)

  if (!isESM) {
    return await bundleCommonJSModule(moduleName, pkgJson, basePath)
  }

  return await bundleESMModule(moduleName, moduleBaseName, pkgJson, basePath)
}
