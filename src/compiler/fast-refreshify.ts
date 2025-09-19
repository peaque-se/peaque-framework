import { transformSync } from "@swc/core"

export function fastRefreshify(code: string, filename: string) {
  const output = transformSync(code, {
    filename,
    jsc: {
      target: "es2020",
      parser: {
        syntax: "typescript",
        tsx: true,
      },
      transform: {
        react: {
          development: true,
          runtime: "automatic",
          refresh: {
            refreshReg: `window.$RefreshReg$(${JSON.stringify(filename)})`,
            refreshSig: `window.$RefreshSig$`,
            emitFullSignatures: true,
          },
          useBuiltins: true,
        },
        optimizer: {
          globals: {
            vars: {
              "process.env.NODE_ENV": '"development"',
            },
          },
        },
      },
    },
    module: {
      type: "es6",
    },
    sourceMaps: "inline",
  })
  return output.code
}
