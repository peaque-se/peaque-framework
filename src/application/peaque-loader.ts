import { promises as fs } from 'fs';
import path from 'path';
import { PeaqueApplication, PeaquePage, PeaqueApiRoute, PeaquePublicFile, PeaqueJob, PeaqueAsset } from "./peaque-application.js";

export async function loadPeaqueApplication(basePath: string): Promise<PeaqueApplication> {
  const srcPath = path.join(basePath, 'src');

  const pages = await scanPages(path.join(srcPath, 'pages'));
  const apiRoutes = await scanApiRoutes(path.join(srcPath, 'api'));
  const publicFiles = await scanPublicFiles(path.join(srcPath, 'public'));
  const jobs = await scanJobs(path.join(srcPath, 'jobs'));
  const assets: PeaqueAsset[] = []; // TODO: Implement asset scanning if needed

  const stylesPath = await fileExists(path.join(srcPath, 'styles.css')) ? path.join(srcPath, 'styles.css') : undefined;
  const envPath = await fileExists(path.join(basePath, '.env')) ? path.join(basePath, '.env') : undefined;
  const tailwindConfigPath = await fileExists(path.join(basePath, 'tailwind.config.js')) ? path.join(basePath, 'tailwind.config.js') : undefined;

  return {
    basePath,
    pages,
    apiRoutes,
    publicFiles,
    jobs,
    assets,
    stylesPath,
    envPath,
    tailwindConfigPath,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function scanPages(pagesDir: string): Promise<PeaquePage[]> {
  const pages: PeaquePage[] = [];
  if (!(await fileExists(pagesDir))) return pages;

  async function scan(dir: string, currentRoute: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const newRoute = currentRoute === '' ? entry.name : `${currentRoute}/${entry.name}`;
        await scan(fullPath, newRoute);
      } else if (entry.name === 'page.tsx') {
        const route = currentRoute === '' ? '/' : `/${currentRoute}`;
        const componentPath = fullPath;
        const layoutPath = await fileExists(path.join(dir, 'layout.tsx')) ? path.join(dir, 'layout.tsx') : undefined;
        const guardPath = await fileExists(path.join(dir, 'guard.ts')) ? path.join(dir, 'guard.ts') : undefined;
        const isDynamic = route.includes('[');
        const params = extractParams(route);
        pages.push({
          path: route,
          componentPath,
          layoutPath,
          guardPath,
          isDynamic,
          params,
        });
      }
    }
  }

  await scan(pagesDir, '');
  return pages;
}

async function scanApiRoutes(apiDir: string): Promise<PeaqueApiRoute[]> {
  const apiRoutes: PeaqueApiRoute[] = [];
  if (!(await fileExists(apiDir))) return apiRoutes;

  async function scan(dir: string, currentRoute: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const newRoute = currentRoute === '' ? entry.name : `${currentRoute}/${entry.name}`;
        await scan(fullPath, newRoute);
      } else if (entry.name === 'route.ts') {
        const route = currentRoute === '' ? '/' : `/${currentRoute}`;
        const handlerPath = fullPath;
        const isDynamic = route.includes('[');
        const params = extractParams(route);
        // TODO: Parse the file to determine actual methods supported
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']; // Default methods
        apiRoutes.push({
          path: route,
          methods,
          handlerPath,
          isDynamic,
          params,
        });
      }
    }
  }

  await scan(apiDir, '');
  return apiRoutes;
}

async function scanPublicFiles(publicDir: string): Promise<PeaquePublicFile[]> {
  const files: PeaquePublicFile[] = [];
  if (!(await fileExists(publicDir))) return files;

  async function scan(dir: string, currentPath: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const newPath = currentPath === '' ? entry.name : `${currentPath}/${entry.name}`;
        await scan(fullPath, newPath);
      } else {
        const path_ = currentPath === '' ? `/${entry.name}` : `/${currentPath}/${entry.name}`;
        const mimeType = getMimeType(entry.name);
        files.push({
          path: path_,
          filePath: fullPath,
          mimeType,
        });
      }
    }
  }

  await scan(publicDir, '');
  return files;
}

async function scanJobs(jobsDir: string): Promise<PeaqueJob[]> {
  const jobs: PeaqueJob[] = [];
  if (!(await fileExists(jobsDir))) return jobs;

  const entries = await fs.readdir(jobsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const name = path.parse(entry.name).name;
      const jobPath = path.join(jobsDir, entry.name);
      jobs.push({
        name,
        jobPath,
        // schedule: undefined // TODO: Parse schedule from file if needed
      });
    }
  }

  return jobs;
}

function extractParams(route: string): string[] {
  const matches = route.match(/\[([^\]]+)\]/g);
  return matches ? matches.map(m => m.slice(1, -1)) : [];
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}