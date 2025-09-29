import { install } from "source-map-support"
import fs from "fs"
import path from "path"
import url from "url"

export function setupSourceMaps() {
  install({
    environment: "node",
    handleUncaughtExceptions: false,
    retrieveSourceMap: (source) => {
      if (!source.startsWith("file://")) return null
      const mapPath = url.fileURLToPath(source) + ".map"
      if (!fs.existsSync(mapPath)) {
        return null
      }
      const map = fs.readFileSync(mapPath, "utf-8")
      return {
        url: source,
        map: map,
      }
    },
  })
}
