///
/// Module to bundle a css file into a single "peaque.css" file using Tailwind 4
///

import tailwind from "@tailwindcss/postcss"
import autoprefixer from "autoprefixer"
import postcss from "postcss"

export async function bundleCssFile(cssContent : string, basePath: string): Promise<string> {
  const result = await postcss([tailwind({
    optimize: true,
    base: basePath
  }), autoprefixer]).process(cssContent, {
    from: basePath + "/src/styles.css", // Input file (for source maps)
    to: undefined, // No output file, just return result
  })
  
  return result.css
}
