# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Peaque Framework is a full-stack TypeScript web framework combining file-based routing, React, Tailwind CSS, and Hot Module Replacement. It's designed to be "the last JavaScript framework ever to be needed" with zero configuration setup.

## Development Commands

```bash
# Build TypeScript to dist/
npm run build

# Watch mode for development
npm run dev

# Prepare package for publishing
npm run prepublishOnly
```

## Architecture

### Core Components

- **PeaqueFramework** (`src/framework.ts`): Main framework class that orchestrates the entire system
  - Manages Fastify server, route discovery, build processes
  - Handles both development and production modes
  - Integrates with DevServer for HMR functionality

- **Router** (`src/router.ts`): File-based routing system
  - Discovers API routes (`**/route.ts`), pages (`**/page.tsx`), layouts (`**/layout.tsx`), guards (`**/guard.ts`)
  - Converts file paths to route paths (e.g., `[id]` → `:id`)
  - Manages route matching and dynamic imports

- **DevServer** (`src/dev-server.ts`): Development server with HMR
  - WebSocket server on port 24678 for live reloading
  - File watching with chokidar for pages, API routes, and CSS
  - Separate rebuild strategies for different file types

- **CLI** (`src/cli.ts`): Command-line interface
  - Commands: `dev`, `build`, `start`
  - Auto-detects project structure (`pages/` vs `src/pages/`)
  - Environment variable loading from `.env` files

### File-Based Routing Convention

- **Pages**: `pages/**/page.tsx` → React components for routes
- **Layouts**: `pages/**/layout.tsx` → Wrapper components for nested routes
- **Guards**: `pages/**/guard.ts` → Authentication/authorization functions
- **API Routes**: `api/**/route.ts` → HTTP handlers (GET, POST, PUT, DELETE, etc.)
- **Dynamic Routes**: `[param]` folders → URL parameters

### Build System

- Uses esbuild for fast TypeScript/React compilation
- PostCSS + Tailwind CSS 4 + Autoprefixer for styling
- Generates `.peaque/_generated_main.tsx` entry point dynamically
- Development assets go to `.peaque/dist/dev/`, production to `.peaque/dist/`

### Type System

Key types in `src/types.ts`:
- `PeaqueRequest`: Http request and reply wrapper
- `RouteHandler`: API route function signature
- `CookieJar`: Cookie management utilities

## Project Structure Detection

The framework automatically detects:
- `src/pages/` directory structure for tsx pages with tailwindcss support
- `src/api/` directory structure for API routes
- `src/public/` directory structure for public static files

## Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: localhost)
- `NODE_ENV`: Environment mode
- `PEAQUE_PUBLIC_*`: Client-side accessible variables

## CSS Processing

- Automatic Tailwind CSS setup with `styles.css` as entry point
- Automatic purging and minification in production
- Live CSS reloading in development

## Testing & Quality

No specific test setup - relies on TypeScript for type checking. When implementing features:
- Use `npm run build` to verify TypeScript compilation
- Test CLI commands: `peaque dev`, `peaque build`, `peaque start`
- Verify HMR works for page/API/CSS changes