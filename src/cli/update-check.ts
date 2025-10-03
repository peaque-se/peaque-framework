import { platformVersion } from "../server/version.js"
import colors from "yoctocolors"

export async function checkForUpdates(): Promise<void> {
  try {
    const response = await fetch("https://registry.npmjs.org/@peaque/framework/latest")
    const data = await response.json()

    if (data.version !== platformVersion) {
      console.log(colors.yellow(`-----------------------------------------------------------------`))
      console.log(colors.yellow(`   Version ${data.version} of @peaque/framework is available`))
      console.log(colors.yellow(`   (You have version ${platformVersion} installed)`))
      console.log("")
      console.log(colors.yellow(`   To update to the latest version, run:`))
      console.log("")
      console.log(colors.yellow(`   npm install @peaque/framework@latest`))
      console.log("")
      console.log(colors.yellow(`-----------------------------------------------------------------`))
      console.log("")
    }
  } catch {
    // Silently ignore errors (network issues, etc.)
  }
}
