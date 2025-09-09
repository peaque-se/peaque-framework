#!/usr/bin/env node

import { PeaqueFramework } from './framework.js';
import { DevServer } from './dev-server.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const command = process.argv[2];

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

  const config = {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    dev: command === 'dev',
    pagesDir: fs.existsSync(path.join(cwd, 'src', 'pages')) ? path.join(cwd, 'src', 'pages') : path.join(cwd, 'pages'),
    apiDir: fs.existsSync(path.join(cwd, 'src', 'api')) ? path.join(cwd, 'src', 'api') : path.join(cwd, 'api'),
    publicDir: fs.existsSync(path.join(cwd, 'src', 'public')) ? path.join(cwd, 'src', 'public') : path.join(cwd, 'public'),
    buildDir: path.join(cwd, '.peaque', 'dist')
  };

  const framework = new PeaqueFramework(config);

  switch (command) {
    case 'dev':
      console.log('🚀 Starting Peaque in development mode...');
      const devServer = new DevServer(framework);
      await devServer.start();
      await framework.start();
      break;

    case 'build':
      console.log('🔨 Building Peaque application...');
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
      await framework.start();
      break;

    default:
      console.log('Usage: peaque <command>');
      console.log('');
      console.log('Commands:');
      console.log('  dev     Start development server with HMR');
      console.log('  build   Build the application for production');
      console.log('  start   Start the production server');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
