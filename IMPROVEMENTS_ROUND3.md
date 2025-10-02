# Improvements Round 3

## Overview

Round 3 focused on creating a comprehensive utility library for the Peaque Framework. Six new utility modules were added, each providing essential functionality for production applications.

## New Utility Modules Created

### 1. Testing Utilities (`src/utils/testing.ts`)

Complete testing framework for API routes and request handlers.

**Key Features:**
- `MockRequest` class for building test requests with fluent API
- `testHandler()` function for testing request handlers
- Assertion helpers: `assertStatus()`, `assertBody()`, `assertResponded()`
- `createSpy()` for tracking function calls
- `waitFor()` for async condition testing
- `fixture()` factory for creating test data

**Example Usage:**
```typescript
import { mockRequest, testHandler, assertStatus } from '@peaque/framework/utils/testing';

const req = mockRequest()
  .method('POST')
  .path('/api/users')
  .body({ name: 'John' })
  .build();

const result = await testHandler(myHandler, req);
assertStatus(result, 201);
```

**Exports Added:**
- `./utils/testing`

### 2. Data Transformation Utilities (`src/utils/data.ts`)

Comprehensive data manipulation functions for objects and arrays.

**Object Manipulation:**
- `pick()` - Select specific properties
- `omit()` - Remove specific properties
- `merge()` - Deep merge objects
- `clone()` - Deep clone objects
- `flattenObject()` / `unflattenObject()` - Convert between nested and flat objects

**Array Operations:**
- `chunk()` - Split array into chunks
- `flatten()` - Flatten nested arrays
- `uniqueValues()` - Get unique values with optional key function
- `groupBy()` - Group items by key
- `sortBy()` - Sort with custom key function

**Type Conversion:**
- `toNumber()` - Safe number conversion
- `toBoolean()` - Safe boolean conversion
- `parseJSON()` / `stringifyJSON()` - Safe JSON operations

**Data Validation:**
- `normalizeString()` - Trim and normalize whitespace
- `normalizeObject()` - Remove undefined/null values
- `isEqual()` - Deep equality comparison

**Example Usage:**
```typescript
import { pick, groupBy, chunk } from '@peaque/framework/utils/data';

const publicUser = pick(user, ['id', 'name', 'email']);
const usersByRole = groupBy(users, u => u.role);
const pages = chunk(items, 10);
```

**Exports Added:**
- `./utils/data`

### 3. Security Utilities (`src/utils/security.ts`)

Cryptographic and security-related functions using Node.js crypto module.

**Password Hashing:**
- `hashPassword()` - Scrypt-based password hashing
- `verifyPassword()` - Constant-time password verification
- `checkPasswordStrength()` - Password complexity validation

**Token Generation:**
- `generateToken()` - Cryptographically secure random tokens
- `generateUrlSafeToken()` - URL-safe base64url tokens
- `uuid()` - UUID v4 generation
- `nanoid()` - Short unique IDs

**Hashing & HMAC:**
- `sha256()` / `sha512()` - Cryptographic hashing
- `hmac()` - HMAC signature generation
- `verifyHmac()` - Constant-time HMAC verification

**Encryption:**
- `encrypt()` - AES-256 encryption (GCM/CBC modes)
- `decrypt()` - AES-256 decryption with authentication

**Web Security:**
- `sanitizeXss()` - Basic XSS prevention
- `sanitizeRedirectUrl()` - Prevent open redirect vulnerabilities
- `generateCSP()` - Content Security Policy header generation
- `rateLimitKey()` - Generate rate limiting keys

**Example Usage:**
```typescript
import { hashPassword, verifyPassword, generateToken } from '@peaque/framework/utils/security';

// Password hashing
const { hash, salt } = hashPassword('mypassword');
const isValid = verifyPassword(inputPassword, hash, salt);

// Token generation
const sessionId = generateToken();
const apiKey = generateToken(48);
```

**Exports Added:**
- `./utils/security`

### 4. String Utilities (`src/utils/string.ts`)

Comprehensive string manipulation and formatting functions.

**Case Conversion:**
- `camelCase()` - Convert to camelCase
- `pascalCase()` - Convert to PascalCase
- `snakeCase()` - Convert to snake_case
- `kebabCase()` - Convert to kebab-case
- `titleCase()` - Convert to Title Case
- `capitalize()` / `uncapitalize()` - First letter manipulation

**String Manipulation:**
- `truncate()` / `truncateWords()` - Truncate with ellipsis
- `pad()` - Pad to specified length (left/right/both)
- `replaceAll()` - Replace all occurrences
- `removeWhitespace()` / `normalizeWhitespace()` - Whitespace handling
- `reverse()` - Reverse string
- `slugify()` - Convert to URL-friendly slug

**String Analysis:**
- `count()` - Count substring occurrences
- `isBlank()` - Check if empty or whitespace
- `isPalindrome()` - Check if palindrome
- `levenshteinDistance()` - Calculate edit distance
- `startsWithAny()` / `endsWithAny()` / `containsAny()` - Multiple match checking

**Template & Parsing:**
- `template()` - Simple {{key}} template replacement
- `extractMatches()` - Extract regex matches
- `parseQueryString()` / `buildQueryString()` - Query string handling

**Utilities:**
- `escapeRegex()` - Escape regex special characters
- `randomString()` - Generate random strings with charset options

**Example Usage:**
```typescript
import { camelCase, slugify, truncate } from '@peaque/framework/utils/string';

const varName = camelCase('hello world'); // 'helloWorld'
const url = slugify('Hello World!'); // 'hello-world'
const short = truncate('Long text here', 10); // 'Long te...'
```

**Exports Added:**
- `./utils/string`

### 5. File Utilities (`src/utils/file.ts`)

File system operations and path manipulation helpers.

**Path Operations:**
- `getExtension()` - Get file extension
- `getFilenameWithoutExtension()` - Extract filename
- `changeExtension()` - Change file extension
- `normalizePath()` / `toPlatformPath()` - Path separator handling
- `joinPath()` - Cross-platform path joining
- `getRelativePath()` - Calculate relative paths
- `isAbsolutePath()` / `toAbsolutePath()` - Absolute path handling
- `getCommonPath()` - Find common base path

**File System Checks:**
- `fileExists()` - Check if path exists
- `isDirectory()` / `isFile()` - Check path type
- `getFileSize()` - Get file size in bytes
- `getFileModifiedTime()` - Get modification timestamp
- `formatFileSize()` - Human-readable file size

**Directory Operations:**
- `ensureDirectory()` - Create directory recursively
- `getFiles()` / `getDirectories()` - List directory contents
- `getFilesRecursive()` - Recursively list all files

**File I/O:**
- `readFileString()` / `writeFileString()` - Text file operations
- `readFileBuffer()` / `writeFileBuffer()` - Binary file operations
- `readJsonFile()` / `writeJsonFile()` - JSON file operations
- `copyFile()` - Copy files
- `deleteFile()` - Delete files

**Example Usage:**
```typescript
import { readJsonFile, writeJsonFile, getFilesRecursive } from '@peaque/framework/utils/file';

const config = readJsonFile<Config>('./config.json');
writeJsonFile('./output.json', data, true);

const tsFiles = getFilesRecursive('./src', f => f.endsWith('.ts'));
```

**Exports Added:**
- `./utils/file`

### 6. HTTP Client (`src/utils/http-client.ts`)

Type-safe HTTP client wrapper with interceptors, retries, and timeouts.

**Core Features:**
- Request/response interceptors for middleware-like functionality
- Automatic retry on failure with configurable attempts
- Request timeouts with AbortController
- Base URL support for API clients
- Automatic JSON parsing
- Query parameter handling
- Full TypeScript support with generics

**HttpClient Class:**
- `request()` - Generic request method
- `get()` / `post()` / `put()` / `patch()` / `delete()` - HTTP method shortcuts
- `requestWithResponse()` - Get full response object with headers
- `addRequestInterceptor()` - Add request middleware
- `addResponseInterceptor()` - Add response middleware

**Quick Request Functions:**
- `httpGet()` / `httpPost()` / `httpPut()` / `httpPatch()` / `httpDelete()` - One-off requests

**Configuration Options:**
- `baseURL` - API base URL
- `headers` - Default headers
- `timeout` - Request timeout (default: 30s)
- `retries` - Retry attempts (default: 0)
- `retryDelay` - Delay between retries (default: 1s)
- `throwOnError` - Throw on HTTP errors (default: true)

**Example Usage:**
```typescript
import { createHttpClient } from '@peaque/framework/utils/http-client';

// Create client with base configuration
const api = createHttpClient({
  baseURL: 'https://api.example.com',
  headers: { 'Authorization': 'Bearer token' },
  timeout: 10000,
  retries: 3
});

// Add interceptors
api.addRequestInterceptor(async (config) => {
  console.log('Request:', config.url);
  return config;
});

api.addResponseInterceptor(async (response) => {
  console.log('Response:', response.status);
  return response;
});

// Make requests
const users = await api.get<User[]>('/users');
const user = await api.post<User>('/users', { name: 'John' });

// Or use quick functions
import { httpGet, httpPost } from '@peaque/framework/utils/http-client';

const data = await httpGet<Data>('https://api.example.com/data');
const result = await httpPost<Result>('https://api.example.com/action', payload);
```

**Exports Added:**
- `./utils/http-client`

## Package.json Updates

Added 6 new exports to `package.json`:

```json
{
  "exports": {
    "./utils/testing": {
      "import": "./dist/utils/testing.js",
      "types": "./dist/utils/testing.d.ts"
    },
    "./utils/data": {
      "import": "./dist/utils/data.js",
      "types": "./dist/utils/data.d.ts"
    },
    "./utils/security": {
      "import": "./dist/utils/security.js",
      "types": "./dist/utils/security.d.ts"
    },
    "./utils/string": {
      "import": "./dist/utils/string.js",
      "types": "./dist/utils/string.d.ts"
    },
    "./utils/file": {
      "import": "./dist/utils/file.js",
      "types": "./dist/utils/file.d.ts"
    },
    "./utils/http-client": {
      "import": "./dist/utils/http-client.js",
      "types": "./dist/utils/http-client.d.ts"
    }
  }
}
```

## Bug Fixes

### Fixed TypeScript Error in data.ts

**Issue:** Type error in `flatten()` function when pushing items
```
error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'T'.
```

**Fix:** Added type assertions for both array and item cases
```typescript
result.push(...(flatten(item, depth - 1) as T[]));
result.push(item as T);
```

## Build Verification

All new modules compiled successfully with TypeScript strict mode enabled.

```bash
npm run build
# ✓ Build successful
```

## Summary

Round 3 added **6 new utility modules** with **150+ functions** covering:

1. **Testing** - Complete testing framework for API handlers
2. **Data** - Object/array manipulation and transformation
3. **Security** - Cryptography, hashing, encryption, and web security
4. **String** - Case conversion, formatting, parsing, and analysis
5. **File** - File system operations and path handling
6. **HTTP Client** - Type-safe HTTP requests with interceptors

All utilities:
- Have comprehensive JSDoc documentation
- Include usage examples
- Support TypeScript with full type safety
- Are individually importable from package exports
- Follow consistent API patterns
- Include error handling and validation

The framework now has a complete utility library suitable for production applications.
