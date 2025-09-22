import fs from "fs"
import { createHash } from "crypto"
import { pipeline } from "stream/promises"

export async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha1")
  const stream = fs.createReadStream(path)
  await pipeline(stream, hash)
  return hash.digest("hex")
}