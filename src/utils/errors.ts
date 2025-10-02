/**
 * Error handling utilities and custom error classes.
 *
 * This module provides custom error classes for common scenarios,
 * error formatting utilities, and error handling patterns.
 *
 * @module utils/errors
 */

/**
 * Base application error class with additional context.
 *
 * @example
 * ```typescript
 * throw new AppError('User not found', 'USER_NOT_FOUND', { userId: 123 });
 * ```
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON representation.
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      statusCode: this.statusCode,
      stack: this.stack
    };
  }
}

/**
 * Validation error for input validation failures.
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid email format', {
 *   email: ['Must be a valid email address']
 * });
 * ```
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public errors: Record<string, string[]> = {}
  ) {
    super(message, 'VALIDATION_ERROR', { errors }, 400);
    this.name = 'ValidationError';
  }

  /**
   * Add a validation error for a field.
   */
  addError(field: string, error: string): void {
    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field].push(error);
  }

  /**
   * Check if there are any validation errors.
   */
  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }
}

/**
 * Not found error (404).
 *
 * @example
 * ```typescript
 * throw new NotFoundError('User not found', { userId: 123 });
 * ```
 */
export class NotFoundError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NOT_FOUND', context, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized error (401).
 *
 * @example
 * ```typescript
 * throw new UnauthorizedError('Invalid credentials');
 * ```
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', context?: Record<string, any>) {
    super(message, 'UNAUTHORIZED', context, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error (403).
 *
 * @example
 * ```typescript
 * throw new ForbiddenError('Access denied to this resource');
 * ```
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', context?: Record<string, any>) {
    super(message, 'FORBIDDEN', context, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Bad request error (400).
 *
 * @example
 * ```typescript
 * throw new BadRequestError('Invalid request body');
 * ```
 */
export class BadRequestError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'BAD_REQUEST', context, 400);
    this.name = 'BadRequestError';
  }
}

/**
 * Conflict error (409).
 *
 * @example
 * ```typescript
 * throw new ConflictError('Email already exists', { email: 'user@example.com' });
 * ```
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFLICT', context, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429).
 *
 * @example
 * ```typescript
 * throw new RateLimitError('Too many requests', { retryAfter: 60 });
 * ```
 */
export class RateLimitError extends AppError {
  constructor(
    message = 'Too many requests',
    public retryAfter?: number,
    context?: Record<string, any>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', { ...context, retryAfter }, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Internal server error (500).
 *
 * @example
 * ```typescript
 * throw new InternalServerError('Database connection failed', { error: err });
 * ```
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', context?: Record<string, any>) {
    super(message, 'INTERNAL_SERVER_ERROR', context, 500);
    this.name = 'InternalServerError';
  }
}

/**
 * Service unavailable error (503).
 *
 * @example
 * ```typescript
 * throw new ServiceUnavailableError('Service is temporarily unavailable');
 * ```
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', context?: Record<string, any>) {
    super(message, 'SERVICE_UNAVAILABLE', context, 503);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Timeout error.
 *
 * @example
 * ```typescript
 * throw new TimeoutError('Request timeout', { timeoutMs: 5000 });
 * ```
 */
export class TimeoutError extends AppError {
  constructor(message = 'Operation timed out', context?: Record<string, any>) {
    super(message, 'TIMEOUT', context, 408);
    this.name = 'TimeoutError';
  }
}

/**
 * Check if an error is an instance of AppError or a subclass.
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if an error is a validation error.
 */
export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Extract error message from various error types.
 *
 * @param error - Error object or message
 * @returns Error message string
 *
 * @example
 * ```typescript
 * const message = getErrorMessage(error);
 * console.error(message);
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'An unknown error occurred';
}

/**
 * Extract error stack trace from various error types.
 *
 * @param error - Error object
 * @returns Stack trace string or undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }

  if (error && typeof error === 'object' && 'stack' in error) {
    return String(error.stack);
  }

  return undefined;
}

/**
 * Format error for logging with context.
 *
 * @param error - Error to format
 * @param additionalContext - Additional context to include
 * @returns Formatted error object
 *
 * @example
 * ```typescript
 * const formatted = formatError(error, { userId: req.userId });
 * logger.error('Request failed', formatted);
 * ```
 */
export function formatError(
  error: unknown,
  additionalContext?: Record<string, any>
): Record<string, any> {
  const formatted: Record<string, any> = {
    message: getErrorMessage(error),
    stack: getErrorStack(error),
    timestamp: new Date().toISOString()
  };

  if (isAppError(error)) {
    formatted.name = error.name;
    formatted.code = error.code;
    formatted.statusCode = error.statusCode;
    formatted.context = { ...error.context, ...additionalContext };
  } else if (error instanceof Error) {
    formatted.name = error.name;
  }

  if (additionalContext) {
    formatted.additionalContext = additionalContext;
  }

  return formatted;
}

/**
 * Create error response object for HTTP responses.
 *
 * @param error - Error to convert
 * @param includeStack - Include stack trace (default: false, only in development)
 * @returns Error response object
 *
 * @example
 * ```typescript
 * const response = toErrorResponse(error, isDevelopment);
 * req.code(response.statusCode).send(response);
 * ```
 */
export function toErrorResponse(
  error: unknown,
  includeStack = false
): {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  stack?: string;
} {
  const message = getErrorMessage(error);

  if (isAppError(error)) {
    const response: any = {
      statusCode: error.statusCode || 500,
      error: error.name,
      message: error.message,
      code: error.code
    };

    if (isValidationError(error) && error.errors) {
      response.errors = error.errors;
    }

    if (includeStack) {
      response.stack = error.stack;
    }

    return response;
  }

  return {
    statusCode: 500,
    error: error instanceof Error ? error.name : 'Error',
    message,
    stack: includeStack ? getErrorStack(error) : undefined
  };
}

/**
 * Wrap a function to catch and handle errors.
 *
 * @param fn - Function to wrap
 * @param errorHandler - Error handler function
 * @returns Wrapped function
 *
 * @example
 * ```typescript
 * const safeFn = catchErrors(riskyFunction, (error) => {
 *   console.error('Error caught:', error);
 *   return defaultValue;
 * });
 * ```
 */
export function catchErrors<T extends (...args: any[]) => any>(
  fn: T,
  errorHandler: (error: unknown) => ReturnType<T>
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch(errorHandler);
      }
      return result;
    } catch (error) {
      return errorHandler(error);
    }
  }) as T;
}

/**
 * Wrap an async function to catch and handle errors.
 *
 * @param fn - Async function to wrap
 * @param errorHandler - Error handler function
 * @returns Wrapped async function
 *
 * @example
 * ```typescript
 * const safeAsyncFn = catchAsyncErrors(asyncFunction, async (error) => {
 *   await logError(error);
 *   throw new AppError('Operation failed', 'OPERATION_FAILED');
 * });
 * ```
 */
export function catchAsyncErrors<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler: (error: unknown) => Promise<ReturnType<T>>
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      return await errorHandler(error);
    }
  }) as T;
}

/**
 * Assert a condition and throw an error if it fails.
 *
 * @param condition - Condition to check
 * @param error - Error to throw (string, Error, or Error factory)
 *
 * @example
 * ```typescript
 * assert(user !== null, 'User not found');
 * assert(isValid, new ValidationError('Invalid input'));
 * assert(hasPermission, () => new ForbiddenError('Access denied'));
 * ```
 */
export function assert(
  condition: boolean,
  error: string | Error | (() => Error)
): asserts condition {
  if (!condition) {
    if (typeof error === 'string') {
      throw new AppError(error, 'ASSERTION_FAILED');
    } else if (typeof error === 'function') {
      throw error();
    } else {
      throw error;
    }
  }
}

/**
 * Assert that a value is defined (not null or undefined).
 *
 * @param value - Value to check
 * @param error - Error message or error to throw
 * @returns The value (typed as non-nullable)
 *
 * @example
 * ```typescript
 * const user = assertDefined(await getUser(id), 'User not found');
 * // user is now typed as non-nullable
 * ```
 */
export function assertDefined<T>(
  value: T | null | undefined,
  error: string | Error = 'Value is null or undefined'
): T {
  if (value === null || value === undefined) {
    if (typeof error === 'string') {
      throw new AppError(error, 'VALUE_NOT_DEFINED');
    } else {
      throw error;
    }
  }
  return value;
}

/**
 * Execute a function and return [data, error] tuple.
 *
 * @param fn - Function to execute
 * @returns Tuple of [data, null] on success or [null, error] on failure
 *
 * @example
 * ```typescript
 * const [user, error] = await tryCatch(() => getUser(id));
 * if (error) {
 *   console.error('Failed to get user:', error);
 *   return;
 * }
 * console.log('User:', user);
 * ```
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<[T, null] | [null, Error]> {
  try {
    const data = await fn();
    return [data, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Execute a synchronous function and return [data, error] tuple.
 *
 * @param fn - Function to execute
 * @returns Tuple of [data, null] on success or [null, error] on failure
 */
export function tryCatchSync<T>(
  fn: () => T
): [T, null] | [null, Error] {
  try {
    const data = fn();
    return [data, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Aggregate multiple errors into a single error.
 *
 * @param errors - Array of errors
 * @param message - Error message
 * @returns Aggregated error or null if no errors
 *
 * @example
 * ```typescript
 * const errors: Error[] = [];
 * for (const item of items) {
 *   try {
 *     await processItem(item);
 *   } catch (error) {
 *     errors.push(error);
 *   }
 * }
 * const aggregated = aggregateErrors(errors, 'Failed to process items');
 * if (aggregated) throw aggregated;
 * ```
 */
export function aggregateErrors(
  errors: Error[],
  message = 'Multiple errors occurred'
): AppError | null {
  if (errors.length === 0) {
    return null;
  }

  if (errors.length === 1) {
    const error = errors[0];
    if (isAppError(error)) {
      return error;
    }
    return new AppError(error.message, 'ERROR', { originalError: error });
  }

  return new AppError(
    message,
    'MULTIPLE_ERRORS',
    {
      errors: errors.map(e => ({
        message: e.message,
        name: e.name,
        ...(isAppError(e) ? { code: e.code, context: e.context } : {})
      }))
    }
  );
}

/**
 * Retry a function on error with exponential backoff.
 *
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of function
 *
 * @example
 * ```typescript
 * const data = await retryOnError(
 *   () => fetchData(),
 *   { maxAttempts: 3, delayMs: 1000, exponentialBackoff: true }
 * );
 * ```
 */
export async function retryOnError<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    exponentialBackoff?: boolean;
    shouldRetry?: (error: Error, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    exponentialBackoff = false,
    shouldRetry = () => true
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
