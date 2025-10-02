/**
 * Caching utilities for storing and retrieving data.
 *
 * This module provides various caching strategies including in-memory cache
 * with TTL support, LRU cache, and cache decorators.
 *
 * @module utils/cache
 */

/**
 * Cache entry with timestamp
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number;
}

/**
 * Simple in-memory cache with TTL support
 *
 * @example
 * ```typescript
 * const cache = new Cache<User>({ defaultTtl: 60000 });
 *
 * cache.set('user:123', user);
 * const user = cache.get('user:123'); // Returns user if not expired
 * ```
 */
export class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl?: number;

  constructor(options: { defaultTtl?: number } = {}) {
    this.defaultTtl = options.defaultTtl;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    this.store.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl
    });
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of entries
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Remove expired entries
   */
  prune(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * LRU (Least Recently Used) Cache
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string>(100); // Max 100 items
 *
 * cache.set('key1', 'value1');
 * const value = cache.get('key1'); // Marks as recently used
 * ```
 */
export class LRUCache<T> {
  private cache: Map<string, T>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value (marks as recently used)
   */
  get(key: string): T | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set a value (evicts oldest if at capacity)
   */
  set(key: string, value: T): void {
    // Delete if exists to update order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value as string;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Create a cached version of a function
 *
 * @param fn - Function to cache
 * @param options - Caching options
 * @returns Cached function
 *
 * @example
 * ```typescript
 * const expensiveOperation = cached(
 *   (id: string) => {
 *     // ... expensive computation ...
 *     return result;
 *   },
 *   { ttl: 60000 } // Cache for 1 minute
 * );
 * ```
 */
export function cached<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: {
    ttl?: number;
    keyFn?: (...args: TArgs) => string;
    maxSize?: number;
  } = {}
): (...args: TArgs) => TReturn {
  const { ttl, keyFn = (...args) => JSON.stringify(args), maxSize } = options;

  const cache = maxSize
    ? new LRUCache<TReturn>(maxSize)
    : new Cache<TReturn>({ defaultTtl: ttl });

  return (...args: TArgs): TReturn => {
    const key = keyFn(...args);

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result, ttl);

    return result;
  };
}

/**
 * Create a cached version of an async function
 *
 * @param fn - Async function to cache
 * @param options - Caching options
 * @returns Cached async function
 *
 * @example
 * ```typescript
 * const fetchUser = cachedAsync(
 *   async (id: string) => {
 *     return await api.getUser(id);
 *   },
 *   { ttl: 60000, maxSize: 100 }
 * );
 * ```
 */
export function cachedAsync<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: {
    ttl?: number;
    keyFn?: (...args: TArgs) => string;
    maxSize?: number;
    cacheErrors?: boolean;
  } = {}
): (...args: TArgs) => Promise<TReturn> {
  const {
    ttl,
    keyFn = (...args) => JSON.stringify(args),
    maxSize,
    cacheErrors = false
  } = options;

  const cache = maxSize
    ? new LRUCache<Promise<TReturn>>(maxSize)
    : new Cache<Promise<TReturn>>({ defaultTtl: ttl });

  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyFn(...args);

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const promise = fn(...args);
    cache.set(key, promise, ttl);

    // Remove from cache if promise fails (unless cacheErrors is true)
    if (!cacheErrors) {
      promise.catch(() => cache.delete(key));
    }

    return promise;
  };
}

/**
 * Cache warming utility
 *
 * @example
 * ```typescript
 * const warmer = new CacheWarmer(cache);
 * warmer.warm('user:123', async () => await api.getUser('123'));
 * ```
 */
export class CacheWarmer<T> {
  constructor(private cache: Cache<T> | LRUCache<T>) {}

  /**
   * Warm the cache with a value
   */
  async warm(key: string, fn: () => Promise<T>, ttl?: number): Promise<void> {
    try {
      const value = await fn();
      if (this.cache instanceof Cache) {
        this.cache.set(key, value, ttl);
      } else {
        this.cache.set(key, value);
      }
    } catch (error) {
      console.error(`Failed to warm cache for key ${key}:`, error);
    }
  }

  /**
   * Warm multiple cache entries
   */
  async warmMany(entries: Array<{ key: string; fn: () => Promise<T>; ttl?: number }>): Promise<void> {
    await Promise.all(
      entries.map(({ key, fn, ttl }) => this.warm(key, fn, ttl))
    );
  }
}
