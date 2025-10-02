/**
 * Async utilities for common asynchronous patterns.
 *
 * This module provides helper functions for working with promises,
 * timeouts, retries, and other async patterns.
 *
 * @module utils/async
 */

/**
 * Sleep for a specified number of milliseconds
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 *
 * @example
 * ```typescript
 * await sleep(1000); // Wait 1 second
 * console.log('Done waiting');
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Options for retry function
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Delay between attempts in milliseconds (default: 1000) */
  delay?: number;
  /** Exponential backoff multiplier (default: 1, no backoff) */
  backoff?: number;
  /** Function to determine if error should trigger retry */
  shouldRetry?: (error: any) => boolean;
}

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry options
 * @returns Promise that resolves with the function result
 * @throws {Error} If all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     return response.json();
 *   },
 *   { maxAttempts: 3, delay: 1000, backoff: 2 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 1,
    shouldRetry = () => true
  } = options;

  let lastError: any;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      await sleep(currentDelay);
      currentDelay *= backoff;
    }
  }

  throw lastError;
}

/**
 * Execute an async function with a timeout
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves with the function result or rejects on timeout
 * @throws {Error} If the function times out
 *
 * @example
 * ```typescript
 * try {
 *   const result = await timeout(
 *     async () => await fetch('https://api.example.com/data'),
 *     5000
 *   );
 * } catch (error) {
 *   console.error('Request timed out');
 * }
 * ```
 */
export async function timeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Debounce an async function
 *
 * @param fn - The async function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce(async (query: string) => {
 *   return await searchAPI(query);
 * }, 300);
 *
 * debouncedSearch('hello'); // Will only execute after 300ms of no calls
 * ```
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout | null = null;
  let resolves: Array<(value: any) => void> = [];
  let rejects: Array<(error: any) => void> = [];

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolves.push(resolve);
      rejects.push(reject);

      timeoutId = setTimeout(async () => {
        const currentResolves = resolves;
        const currentRejects = rejects;
        resolves = [];
        rejects = [];

        try {
          const result = await fn(...args);
          currentResolves.forEach(r => r(result));
        } catch (error) {
          currentRejects.forEach(r => r(error));
        }
      }, delayMs);
    });
  };
}

/**
 * Throttle an async function
 *
 * @param fn - The async function to throttle
 * @param limitMs - Minimum time between executions in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledSave = throttle(async (data: any) => {
 *   await saveToDatabase(data);
 * }, 1000);
 *
 * throttledSave(data1); // Executes immediately
 * throttledSave(data2); // Ignored (within 1000ms)
 * ```
 */
export function throttle<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> | null {
  let lastRun = 0;

  return (...args: Parameters<T>): Promise<ReturnType<T>> | null => {
    const now = Date.now();

    if (now - lastRun >= limitMs) {
      lastRun = now;
      return fn(...args);
    }

    return null;
  };
}

/**
 * Run multiple promises in parallel with a concurrency limit
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Maximum number of concurrent operations
 * @returns Promise that resolves with array of results
 *
 * @example
 * ```typescript
 * const urls = ['url1', 'url2', 'url3', ...];
 * const results = await parallel(
 *   urls,
 *   async (url) => await fetch(url).then(r => r.json()),
 *   3 // Max 3 concurrent requests
 * );
 * ```
 */
export async function parallel<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const promise = fn(item, i).then(result => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Run promises in sequence (one after another)
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @returns Promise that resolves with array of results
 *
 * @example
 * ```typescript
 * const results = await sequence(
 *   [1, 2, 3],
 *   async (num) => {
 *     await sleep(1000);
 *     return num * 2;
 *   }
 * );
 * ```
 */
export async function sequence<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i++) {
    results.push(await fn(items[i], i));
  }

  return results;
}

/**
 * Create a promise that can be resolved or rejected externally
 *
 * @returns Object with promise and resolve/reject functions
 *
 * @example
 * ```typescript
 * const deferred = defer<number>();
 *
 * setTimeout(() => deferred.resolve(42), 1000);
 *
 * const result = await deferred.promise; // 42
 * ```
 */
export function defer<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
