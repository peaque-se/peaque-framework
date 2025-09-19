import path from "path"

export function makeImportsRelative(fileContents: string, includingPath: string = ""): string {
  let result = fileContents;

  const basePath = path.dirname(includingPath);


  function fn(match: string, from: string): string {
    if (from.startsWith("/@deps/") || from.startsWith("/@src/")) {
      return match;
    }
    if (from.startsWith(".")) {
      return `from '/@src/${path.join(basePath, from).replace(/\\/g, "/").replace(/.tsx$/, "").replace(/.ts$/, "").replace(/.jsx$/, "").replace(/.js$/, "")}'`;
    }
    if (from.startsWith("@/")) {
      return `from '/@src/src/${from.substring(2)}'`;
    }
    if (from.startsWith("/")) {
      return `from '/@src/${from}'`;
    }
    return `from '/@deps/${from}'`;
  }
  result = result.replace(/from ["]([^" ]+)["]/g, fn)
  result = result.replace(/from [']([^' ]+)[']/g, fn)
  return result;
}