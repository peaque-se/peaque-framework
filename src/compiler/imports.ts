/// Manages import path aliases and rewrites import paths to be compatible with the Peaque environment
/// © Peaque Developers 2025
import path from "path"

let globalImportAliases: Record<string, string> = {};

/// Sets up import path aliases based on the provided tsconfig.json
export function setupImportAliases(tsconfigJson:any) {
  const paths = tsconfigJson?.compilerOptions?.paths;
  if (!paths) return {};
  const aliases: Record<string, string> = {};
  for (const alias in paths) {
    const target = paths[alias][0];
    const cleanedAlias = alias.replace(/\/\*$/, '');
    const cleanedTarget = target.replace(/\/\*$/, '');
    aliases[cleanedAlias] = cleanedTarget;
  }
  globalImportAliases = aliases;
  return aliases;
}

/// Makes all import paths in the given file contents relative to the includingPath
/// This is used to rewrite imports to work in the Peaque environment
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
    for (const alias in globalImportAliases) {
      if (from === alias) {
        const targetPath = globalImportAliases[alias];
        return `from '/@src/${targetPath}'`;
      } else if (from.startsWith(alias + "/")) {
        const targetPath = globalImportAliases[alias] + from.substring(alias.length);
        return `from '/@src/${targetPath}'`;
      }
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