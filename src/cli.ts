#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { DevServer } from './dev-server.js';
import { PeaqueFramework } from './framework.js';

const command = process.argv[2];

// Parse CLI arguments for flags
const args = process.argv.slice(3);
const verbose = args.includes('--verbose') || args.includes('-v');

function makeFramework(): PeaqueFramework {
  const cwd = process.cwd();

  // Load environment variables from .env files
  const envPath = path.join(cwd, '.env');
  const envLocalPath = path.join(cwd, '.env.local');

  // Load .env file if it exists
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath });
    console.log('📄 Loaded .env file');
  }

  // Load .env.local file if it exists (overrides .env)
  if (fs.existsSync(envLocalPath)) {
    loadEnv({ path: envLocalPath, override: true });
    console.log('📄 Loaded .env.local file');
  }

  const config = {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    dev: command === 'dev',
    pagesDir: path.join(cwd, 'src', 'pages'),
    apiDir: path.join(cwd, 'src', 'api'),
    publicDir: path.join(cwd, 'src', 'public'),
    buildDir: path.join(cwd, '.peaque', 'dist'),
    logger: verbose
  };

  return new PeaqueFramework(config);
}

function showHelp() {
      console.log('Usage: peaque <command> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  dev     Start development server with HMR');
      console.log('  build   Build the application for production');
      console.log('  start   Start the production server');
      console.log('');
      console.log('Options:');
      console.log('  -v, --verbose   Enable verbose logging');
      console.log('  -h, --help      Show this help message');
}

async function main() {
  const cwd = process.cwd();

  // Check if we're in a Peaque project
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ Not a Peaque project (no package.json found)');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  if (!packageJson.dependencies || !packageJson.dependencies['@peaque/framework']) {
    console.error('❌ Not a Peaque project (missing @peaque/framework dependency)');
    process.exit(1);
  }

  switch (command) {
    case 'dev':
      console.log('🚀 Starting Peaque in development mode...');
      const devFramework = makeFramework();
      const devServer = new DevServer(devFramework);
      await devServer.start();
      await devFramework.start();
      break;

    case 'build':
      console.log('🔨 Building Peaque application...');
      const framework = makeFramework();
      const result = await framework.build();
      if (result.success) {
        console.log('✅ Build completed successfully');
      } else {
        console.error('❌ Build failed:');
        result.errors?.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
      }
      break;

    case 'start':
      console.log('🚀 Starting Peaque in production mode...');
      await makeFramework().start();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      process.exit(0);

    default:
      console.log('❌ Unknown command:', command);
      console.log('');
      showHelp();
      process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
