# Peaque Framework - Cleanup & Improvement Checklist

Comprehensive audit of code quality, performance, security, and architecture improvements needed.

---

## 1. CODE QUALITY ISSUES

### 1.1 Unused/Redundant Code

- [ ] **[src/router/serializer.ts:26-32](src/router/serializer.ts#L26)** - Remove duplicate `paramName` handling
  - Lines 26-28 redundantly set paramName (already set for paramChild)

- [ ] **[src/cli/main.ts:39](src/cli/main.ts#L39)** - Remove commented-out code
  ```typescript
  //await runFastRefreshServer(basePath, port, noStrict)
  ```

- [ ] **[src/cli/fast-refresh-server.ts:138](src/cli/fast-refresh-server.ts#L138)** - Remove debugging code
  ```typescript
  //fs.writeFileSync("_generated_main_fast_refresh.txt", mainFile, "utf-8")
  ```

- [ ] **[src/http/http-server.ts:222](src/http/http-server.ts#L222)** - Remove or uncomment content-type header

### 1.2 Inconsistent Error Handling

- [ ] **[src/http/http-bodyparser.ts:75-83](src/http/http-bodyparser.ts#L75)** - Silent error handling
  - Add proper logging or re-throw with context

- [ ] **[src/server/dev-server.ts:358-364](src/server/dev-server.ts#L358)** - Return proper HTTP 500 instead of error as JavaScript

### 1.3 Code Duplication

- [ ] **Extract shared utilities** - `componentify()` duplicated in:
  - [src/cli/prod-builder.ts:29-75](src/cli/prod-builder.ts#L29)
  - [src/server/dev-server.ts:37-85](src/server/dev-server.ts#L37)

- [ ] **Extract shared utilities** - `checkSpecialPage()` duplicated in:
  - [src/cli/prod-builder.ts:77-100](src/cli/prod-builder.ts#L77)
  - [src/server/dev-server.ts:87-100](src/server/dev-server.ts#L87)

- [ ] **[src/cli/prod-builder.ts:401-410](src/cli/prod-builder.ts#L401)** - Consolidate SIGINT/SIGTERM handlers

---

## 2. PERFORMANCE OPTIMIZATIONS

### 2.1 Inefficient String Operations

- [ ] **[src/router/serializer.ts:6-61](src/router/serializer.ts#L6)** - Use array operations only, single join at end

- [ ] **[src/compiler/bundle.ts:72-98](src/compiler/bundle.ts#L72)** - Replace regex with proper AST parsing (see TODO:68)

### 2.2 File System Operations

- [ ] **[src/server/dev-server.ts:166,320,336](src/server/dev-server.ts#L166)** - Cache `statSync()` results
  - Multiple stat calls for same file

- [ ] **[src/hmr/module-loader.ts:135-136](src/hmr/module-loader.ts#L135)** - Use `fs.promises.unlink()` instead of sync

### 2.3 Unnecessary Work

- [ ] **[src/server/dev-server.ts:287-310](src/server/dev-server.ts#L287)** - Implement incremental router updates
  - Currently rebuilds entire frontend router on any file change

- [ ] **[src/compiler/frontend-bundler.ts:357-366](src/compiler/frontend-bundler.ts#L357)** - Remove deprecated `bundleFrontend()` function

---

## 3. TYPE SAFETY IMPROVEMENTS

### 3.1 Remove `any` Types (20+ occurrences)

- [x] **[src/router/router.ts:18-19](src/router/router.ts#L18)** - Define interfaces for `names` and `stacks`
  - Changed to use generics: `RouteNode<T>` and `MatchResult<T>` for flexible typing
  - Default type is `unknown` for type safety

- [x] **[src/http/default-impl.ts:82,120](src/http/default-impl.ts#L82)** - Define proper body types
  - Changed `any` to `unknown` for type safety
  - Updated constructor and methods to use `unknown`

- [x] **[src/compiler/frontend-bundler.ts:72,164,236,257](src/compiler/frontend-bundler.ts#L72)** - Import proper esbuild types
  - Created `Metafile` and `MetafileInput` interfaces
  - Updated `extractDependencies` to accept `Metafile | undefined`
  - Changed `buildOptions` to use `Parameters<typeof context>[0]`

- [x] **[src/http/http-types.ts:12,33,37](src/http/http-types.ts#L12)** - Use generic constraints
  - Changed `body<T = any>()` to `body<T = unknown>()`
  - Changed `send<T = any>()` to `send<T = unknown>()`
  - Changed `responseBody(): any` to `responseBody(): unknown`

- [x] **[src/compiler/bundle.ts:16,37](src/compiler/bundle.ts#L16)** - Define `PackageJson` interface
  - Created custom `PackageJson` interface with proper types
  - Updated all functions using package.json to use the interface

### 3.2 Missing Return Type Annotations

- [ ] **[src/router/utils.ts:24,32](src/router/utils.ts#L24)** - Add explicit return types

- [ ] **[src/http/http-router.ts:160-177](src/http/http-router.ts#L160)** - Add return type to `executeMiddlewareChain`

### 3.3 Type Assertions Without Validation

- [ ] **[src/router/router.ts:94](src/router/router.ts#L94)** - Add runtime validation before `!` assertions
  ```typescript
  const subNode = node.staticChildren.get(seg)!  // ← Unsafe
  ```

---

## 4. ARCHITECTURE CONCERNS

### 4.1 Circular Dependencies Risk

- [ ] **[src/index.ts & src/exceptions/index.ts](src/index.ts)** - Move exceptions to avoid circular deps

### 4.2 Tight Coupling

- [ ] **[src/server/dev-server.ts:111-149](src/server/dev-server.ts#L111)** - Split DevServer responsibilities
  - Extract: FileWatcherService, ModuleLoaderService, CSSCompilationService, RouterBuilderService
  - Implement dependency injection

- [ ] **[src/http/http-server.ts:88-246](src/http/http-server.ts#L88)** - Extract WebSocket handling to adapter

### 4.3 Global Mutable State

- [ ] **[src/compiler/bundle.ts:27](src/compiler/bundle.ts#L27)** - Move `dependencies` array to class-based state

- [ ] **[src/hmr/module-loader.ts:14](src/hmr/module-loader.ts#L14)** - Make `importCounter` instance-level

### 4.4 Configuration Conflicts

- [ ] **[tsconfig.json:28-29](tsconfig.json#L28)** - Fix include/exclude conflict
  ```json
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist", "test"]  // ← Includes then excludes test
  ```

---

## 5. ERROR HANDLING GAPS

### 5.1 Missing Error Handling

- [ ] **[src/router/router.ts:108-112](src/router/router.ts#L108)** - Wrap all `decodeURIComponent()` calls in try-catch

- [ ] **[src/http/http-server.ts:146-156](src/http/http-server.ts#L146)** - Add error handling for URLSearchParams

### 5.2 Unhandled Promise Rejections

- [ ] **[src/server/dev-server.ts:161-169](src/server/dev-server.ts#L161)** - Implement proper error recovery

- [ ] **[src/cli/fast-refresh-server.ts:306-309](src/cli/fast-refresh-server.ts#L306)** - Add retry logic for job updates

### 5.3 Insufficient Error Context

- [ ] **[src/http/http-router.ts:163](src/http/http-router.ts#L163)** - Include middleware index/name in error

- [ ] **[src/hmr/module-loader.ts:56](src/hmr/module-loader.ts#L56)** - Add absolute path in error message

---

## 6. DOCUMENTATION NEEDS

### 6.1 Missing JSDoc Comments

- [ ] **[src/router/router.ts:32-166](src/router/router.ts#L32)** - Document `match()` function with examples

- [ ] **[src/http/http-router.ts:18-158](src/http/http-router.ts#L18)** - Add JSDoc for all public methods

- [ ] **[src/server/dev-server.ts:110](src/server/dev-server.ts#L110)** - Replace unprofessional comment with proper docs

### 6.2 Incomplete TODO Comments

- [ ] **[src/application/peaque-loader.ts:30,63,136](src/application/peaque-loader.ts#L30)** - Create GitHub issues for TODOs

- [ ] **[src/compiler/bundle.ts:36,68](src/compiler/bundle.ts#L36)** - Create technical debt tickets

### 6.3 API Documentation

- [ ] Create `src/README.md` explaining architecture
- [ ] Add inline examples for complex APIs
- [ ] Add description comments to type definitions

---

## 7. CONFIGURATION ISSUES

### 7.1 TypeScript Configuration

- [ ] **[tsconfig.json:29](tsconfig.json#L29)** - Remove "test" from exclude (already in include)

- [ ] **[tsconfig.json:26](tsconfig.json#L26)** - Remove trailing comma in paths object

### 7.2 Missing Configuration Files

- [ ] Add `.eslintrc.json` with strict rules
- [ ] Add `.prettierrc` for consistent formatting
- [ ] Add `.github/workflows/ci.yml` for automated testing

### 7.3 Package.json Issues

- [ ] **[package.json:78](package.json#L78)** - Make Tailwind peer dependency flexible
  - Change to `^4.1.0` for minor version updates

---

## 8. BUILD AND TOOLING IMPROVEMENTS

### 8.1 Development Experience

- [ ] **[src/server/dev-server.ts:481-483](src/server/dev-server.ts#L481)** - Add visual error overlay in browser

- [ ] **[src/compiler/frontend-bundler.ts:270-283](src/compiler/frontend-bundler.ts#L270)** - Format errors with code frames

### 8.2 Build Performance

- [ ] **[src/hmr/module-loader.ts:85-102](src/hmr/module-loader.ts#L85)** - Implement esbuild context pooling

- [ ] **CSS bundling** - Implement file watching and caching for CSS

### 8.3 Testing Infrastructure

- [ ] **[jest.config.js:14-15](jest.config.js#L14)** - Add coverage thresholds (80% minimum)

- [ ] Add tests for:
  - `src/http/http-server.ts`
  - `src/server/dev-server.ts`
  - `src/compiler/*` modules

---

## 9. SECURITY CONCERNS

### 9.1 Path Traversal Vulnerabilities ⚠️ CRITICAL

- [x] **[src/server/dev-server.ts:495-500](src/server/dev-server.ts#L495)** - Fix `serveFileFromPublicDir()`
  - Add `path.normalize()` and validate resolved path is within public dir
  - Prevent `../` attacks

- [x] **[src/server/dev-server.ts:344-365](src/server/dev-server.ts#L344)** - Fix `serveBundledSrcFile()`
  - Add path sanitization and validation

### 9.2 Unsafe Dynamic Imports

- [ ] **[src/hmr/module-loader.ts:134](src/hmr/module-loader.ts#L134)** - Use cryptographic hash for cache busting

### 9.3 Missing Input Validation

- [ ] **[src/http/http-server.ts:146-156](src/http/http-server.ts#L146)** - Add query parameter sanitization

- [ ] **[src/http/default-impl.ts:19-23](src/http/default-impl.ts#L19)** - Add cookie validation and size limits

### 9.4 Environment Variable Exposure

- [ ] Add runtime validation to block non-`PEAQUE_PUBLIC_*` vars on client
  - Pattern mentioned in CLAUDE.md but not enforced

---

## 10. TECHNICAL DEBT

### 10.1 Deprecated Code

- [ ] **[src/compiler/frontend-bundler.ts:357-433](src/compiler/frontend-bundler.ts#L357)** - Remove 76 lines of deprecated functions
  - Create migration guide first

- [ ] **[src/cli/fast-refresh-server.ts](src/cli/fast-refresh-server.ts)** - Verify if superseded by dev-server.ts
  - Remove if not needed (325 lines)

### 10.2 Console Statements (11 files)

Replace with proper logging framework (winston/pino):

- [ ] [src/cli/main.ts:22-35,51-76](src/cli/main.ts#L22)
- [ ] [src/server/dev-server.ts:164,168,184-190,205,213-214](src/server/dev-server.ts#L164)
- [ ] [src/cli/prod-builder.ts:397-400,420-505](src/cli/prod-builder.ts#L397)
- [ ] [src/cli/fast-refresh-server.ts:56,124,126,272-278](src/cli/fast-refresh-server.ts#L56)

### 10.3 Hard-Coded Values

- [ ] **[src/server/dev-server.ts:468](src/server/dev-server.ts#L468)** - Make WebSocket port configurable

- [ ] **[src/client/client-router.tsx:318](src/client/client-router.tsx#L318)** - Make page title configurable

- [ ] **[src/compiler/bundle.ts:60](src/compiler/bundle.ts#L60)** - Use dynamic NODE_ENV

### 10.4 Code Comments Cleanup

- [ ] **[src/server/dev-server.ts:110](src/server/dev-server.ts#L110)** - Replace "fifteenth attempt" comment

- [ ] **[src/http/default-impl.ts:207](src/http/default-impl.ts#L207)** - Clarify "Optional body for redirect?!" comment

- [ ] **[src/server/dev-server.ts:219,478](src/server/dev-server.ts#L219)** - Remove commented-out console.logs

---

## PRIORITY LEVELS

### 🔴 Critical (Fix Immediately)

1. Fix path traversal vulnerabilities in file serving (Section 9.1)
2. Remove `any` types from public API surfaces (Section 3.1)
3. Add proper error handling for all async operations (Section 5.2)

### 🟠 High Priority (Fix Soon)

4. Split DevServer into smaller, testable services (Section 4.2)
5. Increase test coverage to >80% (Section 8.3)
6. Fix TypeScript config conflicts (Section 7.1)
7. Implement caching for file system operations (Section 2.2)

### 🟡 Medium Priority (Next Release)

8. Add comprehensive JSDoc comments (Section 6.1)
9. Remove code duplication (Section 1.3)
10. Replace console statements with proper logging (Section 10.2)
11. Add and enforce ESLint rules (Section 7.2)

### 🟢 Low Priority (Technical Debt)

12. Remove deprecated code (Section 10.1)
13. Clean up unprofessional comments (Section 10.4)
14. Make hard-coded values configurable (Section 10.3)

---

## ESTIMATED EFFORT

- **Critical fixes**: 2-3 days
- **High priority**: 1-2 weeks
- **Medium priority**: 2-3 weeks
- **Low priority**: 1 week

**Total**: 5-7 weeks for comprehensive improvements

---

## TRACKING

- [ ] Create GitHub issues for all critical items
- [ ] Add project board for tracking progress
- [ ] Schedule refactoring sprints
- [ ] Document migration paths for breaking changes
