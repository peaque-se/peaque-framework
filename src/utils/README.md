# Peaque Framework Utilities

This directory contains utility modules that provide helpful functions for common development tasks.

## Available Utilities

### Logger (`logger.ts`)

Structured logging with color-coded output and configurable log levels.

```typescript
import { Logger, LogLevel, createLogger } from './utils/logger.js';

// Create a logger
const logger = createLogger({
  level: LogLevel.INFO,
  prefix: 'MyApp',
  timestamps: true
});

logger.info('Server started');
logger.error('Something went wrong', error);
logger.success('Operation completed');
```

### Validation (`validation.ts`)

Input validation helpers to prevent common security issues.

```typescript
import {
  isValidEmail,
  isNonEmptyString,
  isNumberInRange,
  sanitizeHtml,
  hasRequiredProperties
} from './utils/validation.js';

// Validate email
const emailResult = isValidEmail(req.body().email);
if (!emailResult.valid) {
  req.code(400).send({ error: emailResult.error });
  return;
}

// Sanitize user input to prevent XSS
const safeName = sanitizeHtml(req.queryParam('name'));

// Parse with defaults
const page = parseIntSafe(req.queryParam('page'), 1);
const limit = parseIntSafe(req.queryParam('limit'), 10);
```

### Async Utilities (`async.ts`)

Helper functions for common asynchronous patterns.

```typescript
import {
  sleep,
  retry,
  timeout,
  parallel,
  debounce
} from './utils/async.js';

// Sleep
await sleep(1000);

// Retry with exponential backoff
const result = await retry(
  async () => await fetchData(),
  { maxAttempts: 3, delay: 1000, backoff: 2 }
);

// Timeout
const data = await timeout(
  async () => await slowOperation(),
  5000 // 5 second timeout
);

// Parallel with concurrency limit
const results = await parallel(
  urls,
  async (url) => await fetch(url),
  3 // Max 3 concurrent requests
);

// Debounce
const debouncedSearch = debounce(searchAPI, 300);
```

## Best Practices

### Validation

Always validate user input before processing:

```typescript
// In API routes
export const POST: RequestHandler = async (req) => {
  const body = req.body();

  // Validate required fields
  const fieldsValid = hasRequiredProperties(body, ['username', 'email']);
  if (!fieldsValid.valid) {
    req.code(400).send({ error: fieldsValid.error });
    return;
  }

  // Validate email format
  const emailValid = isValidEmail(body.email);
  if (!emailValid.valid) {
    req.code(400).send({ error: emailValid.error });
    return;
  }

  // Process request...
};
```

### Logging

Use structured logging for better debugging:

```typescript
import { createLogger } from '@peaque/framework/utils/logger';

const logger = createLogger({ prefix: 'Auth' });

export const POST: RequestHandler = async (req) => {
  logger.info('Login attempt', { email: req.body().email });

  try {
    const user = await authenticateUser(req.body());
    logger.success('Login successful', { userId: user.id });
    req.send({ success: true });
  } catch (error) {
    logger.error('Login failed', error);
    req.code(401).send({ error: 'Invalid credentials' });
  }
};
```

### Error Handling

Use retry for resilient operations:

```typescript
import { retry } from '@peaque/framework/utils/async';

export const GET: RequestHandler = async (req) => {
  try {
    // Retry database query on failure
    const data = await retry(
      async () => await db.query('SELECT * FROM users'),
      {
        maxAttempts: 3,
        delay: 500,
        backoff: 2,
        shouldRetry: (error) => {
          // Only retry on connection errors
          return error.code === 'ECONNREFUSED';
        }
      }
    );

    req.send(data);
  } catch (error) {
    req.code(500).send({ error: 'Database unavailable' });
  }
};
```

## Security Considerations

1. **Always validate user input** - Never trust data from users
2. **Sanitize HTML output** - Prevent XSS attacks using `sanitizeHtml()`
3. **Use type-safe parsing** - Use `parseIntSafe()` instead of `parseInt()`
4. **Validate ranges** - Use `isNumberInRange()` to prevent overflow attacks
5. **Check string lengths** - Use `isStringLength()` to prevent DOS attacks

## Performance Tips

1. **Use debouncing** for expensive operations triggered by user input
2. **Use throttling** to limit API calls
3. **Use parallel() with limits** to prevent overwhelming external services
4. **Use timeouts** to prevent hanging requests
5. **Use sequence()** when order matters or for rate-limited APIs
