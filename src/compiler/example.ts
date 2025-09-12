import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from 'url'
import { bundleBackendProgram } from "./backend-bundler"
import { generateBackendProgram } from "./backend-generator"
import { bundleContentProdToString } from "./frontend-bundler"
import { generateMainFile } from "./frontend-generator"
import { bundleCssFile } from "./tailwind-bundler"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const basePath = "c:/projects/peaque-claude-experiments/peaque-manager-coach"
console.time("Generate _main.tsx")
const mainContent = await generateMainFile(basePath, true, "./src/")
console.timeEnd("Generate _main.tsx")

// const outputPath = path.join(basePath, ".peaque/_generated_main.tsx")
// await writeFile(outputPath, mainContent, "utf-8")
// console.log("✅ Generated _generated_main.tsx at " + outputPath)

// call the bundler with string content (no file I/O)
console.time("Bundle time")
const res = await bundleContentProdToString(mainContent, basePath);
console.timeEnd("Bundle time")

console.log("✅ Bundle success:", res.success)
if (res.success) {
  console.log("Bundle size:", res.bundleContent?.length)
  //console.log("Dependencies:", res.dependencies)
} else {
  console.log("Errors:", res.errors)
  console.log("Warnings:", res.warnings)
}

// load style.css from basePath/src/styles.css
const stylePath = path.join(basePath, "src/styles.css")
const cssContent = fs.readFileSync(stylePath, "utf-8")
console.time("CSS bundle time")
const result = await bundleCssFile(cssContent, basePath)
console.timeEnd("CSS bundle time")

console.log("✅ Bundled CSS size:", result.length)

console.time("Backend generation time")
const backend = await generateBackendProgram({
  baseDir: basePath,
  importPrefix: "./src/",
  frameworkPath: path.join(__dirname, "..")
})
console.timeEnd("Backend generation time")
console.log("✅ Generated backend program")

// Bundle the backend program into a single executable file
console.time("Backend bundling time")
const outputBundlePath = path.join(basePath, ".peaque/server.js")

await bundleBackendProgram({
  generatedCode: backend,
  outputPath: outputBundlePath,
  baseDir: basePath,
  minify: false,
  sourcemap: true
})
console.timeEnd("Backend bundling time")
console.log("✅ Bundled backend to:", outputBundlePath)
