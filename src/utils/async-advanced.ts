/**
 * Advanced async utilities for specialized use cases.
 *
 * This module provides advanced async patterns including memoization,
 * rate limiting, batching, and queue management.
 *
 * @module utils/async-advanced
 */

import { sleep } from './async.js';

/**
 * Create a memoized version of an async function that caches results
 *
 * @param fn - The async function to memoize
 * @param options - Memoization options
 * @returns Memoized function
 *
 * @example
 * ```typescript
 * const fetchUser = memoize(
 *   async (id: string) => {
 *     return await api.getUser(id);
 *   },
 *   { ttl: 60000 } // Cache for 1 minute
 * );
 *
 * await fetchUser('123'); // Makes API call
 * await fetchUser('123'); // Returns cached result
 * ```
 */
export function memoize<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    /** Time to live in milliseconds (optional) */
    ttl?: number;
    /** Custom key function (default: JSON.stringify) */
    keyFn?: (...args: Parameters<T>) => string;
  } = {}
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  const { ttl, keyFn = (...args) => JSON.stringify(args) } = options;

  return (...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args);
    const cached = cache.get(key);

    if (cached) {
      if (!ttl || Date.now() - cached.timestamp < ttl) {
        return cached.value;
      }
      cache.delete(key);
    }

    const promise = fn(...args) as ReturnType<T>;
    cache.set(key, { value: promise, timestamp: Date.now() });

    // Remove from cache if promise fails
    (promise as Promise<any>).catch(() => cache.delete(key));

    return promise;
  };
}

/**
 * Race multiple promises and return the first one that resolves successfully.
 * Unlike Promise.race, this ignores rejections until all promises fail.
 *
 * @param promises - Array of promises to race
 * @returns Promise that resolves with the first successful result
 * @throws {Error} If all promises fail
 *
 * @example
 * ```typescript
 * const result = await raceSuccessful([
 *   fetch('https://api1.example.com/data'),
 *   fetch('https://api2.example.com/data'),
 *   fetch('https://api3.example.com/data')
 * ]);
 * // Returns first successful response, ignores failures
 * ```
 */
export async function raceSuccessful<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectionCount = 0;
    const errors: any[] = [];

    for (const promise of promises) {
      promise
        .then(resolve)
        .catch((error) => {
          errors.push(error);
          rejectionCount++;
          if (rejectionCount === promises.length) {
            reject(new Error(`All promises failed: ${errors.map(e => e.message).join(', ')}`));
          }
        });
    }
  });
}

/**
 * Execute async tasks with a rate limit (max N per time window)
 *
 * @param fn - The async function to rate limit
 * @param maxCalls - Maximum calls per window
 * @param windowMs - Time window in milliseconds
 * @returns Rate-limited function
 *
 * @example
 * ```typescript
 * const rateLimitedFetch = rateLimit(
 *   async (url: string) => fetch(url),
 *   10,  // Max 10 calls
 *   1000 // Per 1 second
 * );
 * ```
 */
export function rateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxCalls: number,
  windowMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const calls: number[] = [];

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const now = Date.now();

    // Remove old calls outside the window
    while (calls.length > 0 && calls[0] <= now - windowMs) {
      calls.shift();
    }

    if (calls.length >= maxCalls) {
      const oldestCall = calls[0];
      const waitTime = windowMs - (now - oldestCall);
      await sleep(waitTime);
      return rateLimit(fn, maxCalls, windowMs)(...args);
    }

    calls.push(now);
    return fn(...args);
  };
}

/**
 * Create a queue that processes items one at a time
 *
 * @param processor - Function to process each item
 * @returns Queue with enqueue method
 *
 * @example
 * ```typescript
 * const queue = createQueue(async (task: Task) => {
 *   await processTask(task);
 * });
 *
 * queue.enqueue(task1);
 * queue.enqueue(task2); // Will wait for task1 to complete
 * ```
 */
export function createQueue<T>(processor: (item: T) => Promise<void>): {
  enqueue: (item: T) => Promise<void>;
  size: () => number;
} {
  const queue: T[] = [];
  let processing = false;

  async function processQueue() {
    if (processing || queue.length === 0) return;

    processing = true;
    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        await processor(item);
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }
    processing = false;
  }

  return {
    enqueue: async (item: T) => {
      queue.push(item);
      await processQueue();
    },
    size: () => queue.length
  };
}

/**
 * Batch function calls and execute them together
 *
 * @param fn - Function to batch
 * @param options - Batching options
 * @returns Batched function
 *
 * @example
 * ```typescript
 * const batchedFetch = batch(
 *   async (ids: string[]) => {
 *     return await api.getUsers(ids);
 *   },
 *   { maxBatchSize: 10, maxWaitMs: 100 }
 * );
 *
 * // These will be batched together
 * const user1 = await batchedFetch('1');
 * const user2 = await batchedFetch('2');
 * const user3 = await batchedFetch('3');
 * ```
 */
export function batch<TInput, TOutput>(
  fn: (inputs: TInput[]) => Promise<TOutput[]>,
  options: {
    maxBatchSize?: number;
    maxWaitMs?: number;
  } = {}
): (input: TInput) => Promise<TOutput> {
  const { maxBatchSize = 100, maxWaitMs = 10 } = options;
  let batch: Array<{
    input: TInput;
    resolve: (value: TOutput) => void;
    reject: (error: any) => void;
  }> = [];
  let timeoutId: NodeJS.Timeout | null = null;

  async function executeBatch() {
    if (batch.length === 0) return;

    const currentBatch = batch;
    batch = [];

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    try {
      const inputs = currentBatch.map(item => item.input);
      const results = await fn(inputs);

      for (let i = 0; i < currentBatch.length; i++) {
        currentBatch[i].resolve(results[i]);
      }
    } catch (error) {
      for (const item of currentBatch) {
        item.reject(error);
      }
    }
  }

  return (input: TInput): Promise<TOutput> => {
    return new Promise((resolve, reject) => {
      batch.push({ input, resolve, reject });

      if (batch.length >= maxBatchSize) {
        executeBatch();
      } else if (!timeoutId) {
        timeoutId = setTimeout(executeBatch, maxWaitMs);
      }
    });
  };
}
