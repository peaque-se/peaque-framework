import path from "path"
import { promises as fs } from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const platformVersion = JSON.parse(await fs.readFile(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version