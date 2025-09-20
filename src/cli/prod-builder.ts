import * as fs from "fs"
import path from "path"
import { precompressAssets } from "../assets/precompress-assets.js"
import { bundleBackendProgram } from "../compiler/backend-bundler.js"
import { generateBackendProgram } from "../compiler/backend-generator.js"
import { FrontendBundler } from "../compiler/frontend-bundler.js"
import { buildPageRouter, generatePageRouterJS } from "../compiler/frontend-generator.js"
import { bundleCssFile } from "../compiler/tailwind-bundler.js"
import { ModuleLoader } from "../hmr/module-loader.js"
import { HeadDefinition } from "../index.js"
import { mergeHead, renderHead } from "../client/head.js"

export const buildForProduction = async (basePath: string) => {
  const startTime = Date.now()
  console.log(`🚀  Starting @peaque/framework production build for ${basePath}`)
  const outDir = path.join(basePath, "dist")
  const assetDir = path.join(outDir, "assets")
  fs.mkdirSync(assetDir, { recursive: true })

  // produce dist/assets/peaque.js
  const pageRouter = await buildPageRouter(basePath)
  const jsCode = await generatePageRouterJS({ pageRouter, devMode: false, importPrefix: "../src" })
  const jsBundler = new FrontendBundler({
    entryContent: jsCode,
    baseDir: outDir,
    sourcemap: false,
    writeToFile: true,
    outputFile: path.join(assetDir, "peaque.js"),
  })
  const result = await jsBundler.build()
  if (result.errors && result.errors.length > 0) {
    console.error("Errors during JS bundling:", result.errors)
    process.exit(1)
  }

  // produce dist/assets/peaque.css
  const stylePath = path.join(basePath, "src/styles.css")
  const cssContent = fs.readFileSync(stylePath, "utf-8")
  const newCssContent = await bundleCssFile(cssContent, basePath)
  fs.writeFileSync(path.join(assetDir, "peaque.css"), newCssContent, "utf-8")

  // copy public folder to dist/assets
  await fs.promises.cp(path.join(basePath, "src/public"), assetDir, { recursive: true })

  // precompress dist/assets
  await precompressAssets(assetDir)

  // produce all distinct versions of head stacks and create the routings for index.html
  const indexRouter : string[] = []
  const defaultHead: HeadDefinition = {
    title: "Peaque Dev Server",
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "A Peaque Framework Application" },
    ],
    link: [{ rel: "stylesheet", href: "/peaque.css" }],
  }
  const headLoader = new ModuleLoader()
  const headStacks = new Map<string, string>()
  const headStackByRoute = new Map<string, string>()
  for (const route of pageRouter.routes) {
    let stackKey = route.headStack.map((h) => h.componentName).join("_")
    if (!headStacks.has(stackKey)) {
      let head = defaultHead
      for (const headStack of route.headStack) {
        const mod = await headLoader.loadModule(path.join(basePath, "src", "pages", headStack.relativePath))
        head = mergeHead(head, mod.default)
      }
      headStacks.set(stackKey, renderHead(head))
    }
    headStackByRoute.set(route.path, stackKey)
  }
  for (const [headStackKey, head] of headStacks) {
      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
${head}
</head>
<body>
<div id="peaque"></div>
<script type="module" src="/peaque.js"></script>
</body>
</html>`
    indexRouter.push(' const index_' + headStackKey + ' = `\n' + indexHtml + '\n`')
  }

  for (const [routePath, stackKey] of headStackByRoute) {
    indexRouter.push(' router.addRoute("GET", "' + routePath + '", (req) => { req.type("text/html").send(index_' + stackKey + ') })')
  }
  
  const indexRouterCode = indexRouter.join("\n")



  // generate dist/server.js
  const backendProgram = await generateBackendProgram({
    importPrefix: "../",
    baseDir: basePath,
    additionalRouterCode: indexRouterCode,
  })
  // await bundleBackendProgram({
  //   baseDir: basePath,
  //   outfile: path.join(outDir, "server_without_env.js"),
  //   inputContent: backendProgram.content,
  //   minify: false,
  //   sourcemap: true,
  // })
  fs.writeFileSync(path.join(outDir, "server_without_env.js"), backendProgram.content, "utf-8")

  // make a small main.js that starts the server after loading env vars
  const mainJs = `import dotenv from "dotenv"
const currentPath = process.cwd()
dotenv.config({path: \`\${currentPath}/.env\`, override: true})
dotenv.config()
require("./server_without_env.js")
`
  await bundleBackendProgram({
    baseDir: outDir,
    outfile: path.join(outDir, "main.js"),
    inputContent: mainJs,
    minify: true,
    sourcemap: false,
  })

  // remove server_without_env.js
  fs.unlinkSync(path.join(outDir, "server_without_env.js"))

  const endTime = Date.now()
  console.log("✅  Production build completed successfully in " + ((endTime - startTime) / 1000).toFixed(2) + " seconds")
}
