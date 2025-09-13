
# Platform design

## Specification of framework behavior

`./src/styles.css`
  - should most probably include `@import "tailwindcss";` at the top
  - automatic tailwindcss compilation

`./src/pages/**`
  - `default` export a `<Component/>` from page.tsx
  - `default` export a `<Component/>` from layout.tsx
  - `default` export a `Guard` from guard.tsx
  - `default` export a `HeadConfig` from head.ts
  - automatic folder based page router (use <Link> and other tools for fast navigation)
  - builds a single page application frontend

`./src/api/**`
  - export `GET`, `POST`, `DELETE`, `PUT`, `PATCH` from route.ts
  - export `middleware` from middleware.ts
  - automatic folder based api router

`./src/public/**`
  - public application assets


## CLI

`peaque dev`

Version 2.0
Run almost same steps as `peaque build` but with 
 - minification turned off
 - source maps enabled
 - installing a watcher for changes in files (maybe ./**)
 - a HMR client loaded in "index.html"
 - a server that can reload routes


`peaque build`

 - bundle tailwindcss + generated classes into `dist/peaque.css`
 - create _generated_main.tsx and bundle it into `dist/peaque.js`
   - produce a client-side router which depends on, and imports all pages
   - also handles layout.tsx and guard.ts
 - create _generated_server.ts and bundle it into `dist/server.js`
   - produce a server-side router which depends on, and imports all api handlers
   - installs routers for "index.html" on all routes supported by _generated_main.tsx
   - installs static file content routers for dist/assets/*
   - also handles middleware.ts
 - copies public static files into `dist/assets/*`
 - precompresses all files in dist with gz and brotli

  deploy instructions after the build:

     Deploying the build is copying the dist/* somewhere
     Launching the server is just `cd dist && node server.js`

`peaque start`

 - essentially just runs `cd dist && node server.js`
