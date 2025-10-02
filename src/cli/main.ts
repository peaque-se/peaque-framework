#!/usr/bin/env node

/**
 * Peaque Framework CLI
 *
 * Command-line interface for managing Peaque applications.
 * Provides commands for development, building, and running production servers.
 *
 * @module cli/main
 */

import { spawn } from "child_process";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { buildForProduction } from "../compiler/prod-builder.js";
import { DevServer } from "../server/dev-server.js";
import { platformVersion } from "../server/version.js";

const program = new Command();
program
  .name("peaque")
  .description("Peaque Framework - The last JavaScript framework ever to be needed")
  .version(platformVersion);

program
  .command("dev")
  .description("Start development server with Hot Module Replacement")
  .option("-p, --port <port>", "Server port (default: 3000)", "3000")
  .option("-b, --base <path>", "Project base path (default: current directory)")
  .option("-n, --no-strict", "Disable React strict mode", true)
  .option("--full-stack-traces", "Enable full stack traces for debugging")
  .action(function () {
    const basePath = this.opts().base || process.cwd();

    // Validate port number
    const port = parseInt(this.opts().port || "3000", 10);
    if (isNaN(port) || port < 0 || port > 65535) {
      console.error(`Error: Invalid port number: ${this.opts().port}`);
      process.exit(1);
    }

    // Check if base path exists
    if (!fs.existsSync(basePath)) {
      console.error(`Error: Base path does not exist: ${basePath}`);
      process.exit(1);
    }

    const options = {
      basePath,
      port,
      noStrict: this.opts().noStrict,
      fullStackTrace: this.opts().fullStackTraces || false
    };

    try {
      const devServer = new DevServer(options);
      devServer.start();

      // Graceful shutdown on SIGINT
      process.on("SIGINT", () => {
        console.log("\nShutting down gracefully...");
        devServer.stop("SIGINT");
        process.exit(0);
      });

      // Graceful shutdown on SIGTERM
      process.on("SIGTERM", () => {
        console.log("\nShutting down gracefully...");
        devServer.stop("SIGTERM");
        process.exit(0);
      });
    } catch (error) {
      console.error("Failed to start development server:", error);
      process.exit(1);
    }
  });

program
  .command("build")
  .description("Build the application for production deployment")
  .option("-o, --output <output>", "Output directory (default: ./dist)")
  .option("-b, --base <path>", "Project base path (default: current directory)")
  .action(function () {
    const basePath = this.opts().base || process.cwd();
    const outputPath = this.opts().output || path.join(basePath, "dist");

    // Check if base path exists
    if (!fs.existsSync(basePath)) {
      console.error(`Error: Base path does not exist: ${basePath}`);
      process.exit(1);
    }

    // Ensure output directory parent exists
    const outputParent = path.dirname(outputPath);
    if (!fs.existsSync(outputParent)) {
      console.error(`Error: Output parent directory does not exist: ${outputParent}`);
      process.exit(1);
    }

    console.log(`Building application from ${basePath} to ${outputPath}...`);

    buildForProduction(basePath, outputPath)
      .then(() => {
        console.log("✓ Build completed successfully");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Build error:", err);
        process.exit(1);
      });
  });

program
  .command("start")
  .description("Start the production server (requires build first)")
  .option("-b, --base <path>", "Project base path (default: current directory)")
  .option("-p, --port <port>", "Server port (default: 3000)", "3000")
  .action(function () {
    const basePath = this.opts().base || process.cwd();

    // Validate port number
    const port = this.opts().port;
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 0 || portNum > 65535) {
      console.error(`Error: Invalid port number: ${port}`);
      process.exit(1);
    }

    // Check for built application
    const inDist = fs.existsSync(path.join(basePath, "dist", "main.cjs"));
    const inSrc = fs.existsSync(path.join(basePath, "main.cjs"));
    const cwd = inDist ? path.join(basePath, "dist") : basePath;

    if (!inDist && !inSrc) {
      console.error(`Error: No main.cjs found in ${basePath} or ${path.join(basePath, "dist")}`);
      console.error("Please run 'peaque build' first to build your application.");
      process.exit(1);
    }

    console.log(`Starting production server on port ${port}...`);
    console.log(`Working directory: ${cwd}`);

    try {
      const child = spawn("node", ["./main.cjs", "--port", port], {
        cwd,
        stdio: 'inherit' // Better output handling
      });

      child.on("error", (err) => {
        console.error("Failed to start production server:", err);
        process.exit(1);
      });

      child.on("close", (code) => {
        if (code !== 0) {
          console.error(`Server exited with code ${code}`);
        }
        process.exit(code || 0);
      });

      // Graceful shutdown on SIGINT
      process.on("SIGINT", () => {
        console.log("\nShutting down gracefully...");
        child.kill("SIGINT");
      });

      // Graceful shutdown on SIGTERM
      process.on("SIGTERM", () => {
        console.log("\nShutting down gracefully...");
        child.kill("SIGTERM");
      });
    } catch (error) {
      console.error("Failed to start production server:", error);
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);
