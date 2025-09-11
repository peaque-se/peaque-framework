import { writeFile } from "fs/promises"
import * as path from "path"
import * as fs from "fs"
import { bundleContentProdToString } from "./frontend-bundler"
import { generateMainFile } from "./frontend-generator"
import { bundleCssFile } from "./tailwind-bundler"

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
// check if the result contains a class with 31337 in it
if (result.includes("31337")) {
  console.log("✅ Tailwind CSS processing looks good (found class with 31337)")
}