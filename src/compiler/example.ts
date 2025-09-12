import * as fs from "fs"
import * as path from "path"
import { bundleBackendProgram } from "./backend-bundler"
import { generateBackendProgram } from "./backend-generator"
import { bundleContentProdToString } from "./frontend-bundler"
import { generateMainFile } from "./frontend-generator"
import { bundleCssFile } from "./tailwind-bundler"
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

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
  importPrefix: "../src/",
})
console.timeEnd("Backend generation time")

// // save backend to .peaque/server.ts for inspection
const backendTsPath = path.join(basePath, ".peaque/server-entry.ts")
fs.writeFileSync(backendTsPath, backend, "utf-8")
// console.log("✅ Saved generated backend to:", backendTsPath)


// Bundle the backend program into a single executable file
console.time("Backend bundling time")
const backendBundleResult = await bundleBackendProgram({
  inputFile: backendTsPath,
  baseDir: basePath,
  outfile: path.join(process.cwd(), "dist-prod", "server.cjs"),
  minify: false,
  sourcemap: true
})
console.timeEnd("Backend bundling time")
console.log("✅ Bundled backend successfully")
console.log(`📦 Bundle written to: ${backendBundleResult.outfile}`)

if (backendBundleResult.warnings.length > 0) {
  console.log("⚠️  Build warnings:", backendBundleResult.warnings.length)
}

// create ./dist-prod folder and write (server.js there)
// create ./dist-prod/assets folder and write (bundle.js, bundle.css, etc there)
const distProdPath = join(process.cwd(), "dist-prod");
const assetsPath = join(distProdPath, "assets");

// Create dist-prod directory
mkdirSync(distProdPath, { recursive: true });

// Server is already written by the bundler
// writeFileSync(join(distProdPath, "server.cjs"), backendBundleResult.code, "utf-8");

// Create assets directory
mkdirSync(assetsPath, { recursive: true });

// Write bundle.js
if (res.bundleContent) {
  writeFileSync(join(assetsPath, "bundle.js"), res.bundleContent, "utf-8");
}

// Write bundle.css
writeFileSync(join(assetsPath, "bundle.css"), result, "utf-8");

console.log("✅ Files written to dist-prod");