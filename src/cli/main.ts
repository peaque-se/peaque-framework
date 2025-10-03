#!/usr/bin/env node

import { createCommandLineParser } from "./commandline-parser.js"
import { checkForUpdates } from "./update-check.js"
import { devCommand, buildCommand, startCommand } from "./commands.js"

await checkForUpdates()
const program = createCommandLineParser(devCommand, buildCommand, startCommand)
program.parse(process.argv)
