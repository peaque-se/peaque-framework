/**
 * Data transformation and manipulation utilities.
 *
 * This module provides utilities for working with objects, arrays, and data structures.
 * Includes functions for object manipulation, array operations, type conversion,
 * and data normalization.
 *
 * @module utils/data
 */

/**
 * Pick specific properties from an object.
 *
 * @param obj - The source object
 * @param keys - Array of keys to pick
 * @returns New object with only the specified keys
 *
 * @example
 * ```typescript
 * const user = { id: 1, name: 'John', email: 'john@example.com', password: 'secret' };
 * const publicUser = pick(user, ['id', 'name', 'email']);
 * // { id: 1, name: 'John', email: 'john@example.com' }
 * ```
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific properties from an object.
 *
 * @param obj - The source object
 * @param keys - Array of keys to omit
 * @returns New object without the specified keys
 *
 * @example
 * ```typescript
 * const user = { id: 1, name: 'John', password: 'secret' };
 * const publicUser = omit(user, ['password']);
 * // { id: 1, name: 'John' }
 * ```
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Deep merge multiple objects.
 *
 * @param target - The target object to merge into
 * @param sources - Source objects to merge from
 * @returns Merged object
 *
 * @example
 * ```typescript
 * const defaults = { a: 1, b: { x: 10 } };
 * const config = { b: { y: 20 }, c: 3 };
 * const result = merge(defaults, config);
 * // { a: 1, b: { x: 10, y: 20 }, c: 3 }
 * ```
 */
export function merge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;

  const result = { ...target };

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = merge(targetValue as any, sourceValue as any);
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Deep clone an object.
 *
 * @param obj - The object to clone
 * @returns Deep copy of the object
 *
 * @example
 * ```typescript
 * const original = { a: 1, b: { c: 2 } };
 * const copy = clone(original);
 * copy.b.c = 3;
 * console.log(original.b.c); // 2
 * ```
 */
export function clone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map(item => clone(item)) as any;
  }

  if (obj instanceof Set) {
    return new Set([...obj].map(item => clone(item))) as any;
  }

  if (obj instanceof Map) {
    return new Map([...obj].map(([key, value]) => [clone(key), clone(value)])) as any;
  }

  if (typeof obj === 'object') {
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = clone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Check if a value is a plain object.
 *
 * @param value - The value to check
 * @returns True if the value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, any> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Flatten a nested object into a single-level object with dot notation keys.
 *
 * @param obj - The object to flatten
 * @param prefix - Optional prefix for keys
 * @returns Flattened object
 *
 * @example
 * ```typescript
 * const nested = { a: { b: { c: 1 } }, d: 2 };
 * const flat = flattenObject(nested);
 * // { 'a.b.c': 1, 'd': 2 }
 * ```
 */
export function flattenObject(
  obj: Record<string, any>,
  prefix = ''
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten a flat object with dot notation keys into a nested object.
 *
 * @param obj - The flattened object
 * @returns Nested object
 *
 * @example
 * ```typescript
 * const flat = { 'a.b.c': 1, 'd': 2 };
 * const nested = unflattenObject(flat);
 * // { a: { b: { c: 1 } }, d: 2 }
 * ```
 */
export function unflattenObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const keys = key.split('.');
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = obj[key];
  }

  return result;
}

/**
 * Chunk an array into smaller arrays of a specified size.
 *
 * @param array - The array to chunk
 * @param size - The size of each chunk
 * @returns Array of chunks
 *
 * @example
 * ```typescript
 * const items = [1, 2, 3, 4, 5];
 * const chunks = chunk(items, 2);
 * // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than 0');
  }

  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Flatten a nested array to a single level.
 *
 * @param array - The array to flatten
 * @param depth - Maximum depth to flatten (default: Infinity)
 * @returns Flattened array
 *
 * @example
 * ```typescript
 * const nested = [1, [2, [3, [4]]]];
 * const flat = flatten(nested);
 * // [1, 2, 3, 4]
 * ```
 */
export function flatten<T>(array: any[], depth = Infinity): T[] {
  if (depth <= 0) {
    return array.slice();
  }

  const result: T[] = [];
  for (const item of array) {
    if (Array.isArray(item)) {
      result.push(...(flatten(item, depth - 1) as T[]));
    } else {
      result.push(item as T);
    }
  }
  return result;
}

/**
 * Get unique values from an array.
 *
 * @param array - The array to filter
 * @param keyFn - Optional function to extract comparison key
 * @returns Array with unique values
 *
 * @example
 * ```typescript
 * const numbers = [1, 2, 2, 3, 3, 3];
 * const unique = uniqueValues(numbers);
 * // [1, 2, 3]
 *
 * const users = [{ id: 1, name: 'John' }, { id: 1, name: 'Jane' }];
 * const uniqueUsers = uniqueValues(users, u => u.id);
 * // [{ id: 1, name: 'John' }]
 * ```
 */
export function uniqueValues<T>(
  array: T[],
  keyFn?: (item: T) => any
): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }

  const seen = new Set();
  const result: T[] = [];

  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * Group array items by a key.
 *
 * @param array - The array to group
 * @param keyFn - Function to extract grouping key
 * @returns Object with grouped items
 *
 * @example
 * ```typescript
 * const users = [
 *   { name: 'John', role: 'admin' },
 *   { name: 'Jane', role: 'user' },
 *   { name: 'Bob', role: 'admin' }
 * ];
 * const grouped = groupBy(users, u => u.role);
 * // {
 * //   admin: [{ name: 'John', ... }, { name: 'Bob', ... }],
 * //   user: [{ name: 'Jane', ... }]
 * // }
 * ```
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string | number
): Record<string, T[]> {
  const result: Record<string, T[]> = {};

  for (const item of array) {
    const key = String(keyFn(item));
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }

  return result;
}

/**
 * Sort an array by a key or keys.
 *
 * @param array - The array to sort
 * @param keyFn - Function to extract sort key(s)
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted array
 *
 * @example
 * ```typescript
 * const users = [
 *   { name: 'John', age: 30 },
 *   { name: 'Jane', age: 25 },
 *   { name: 'Bob', age: 35 }
 * ];
 * const sorted = sortBy(users, u => u.age);
 * // [{ name: 'Jane', age: 25 }, ...]
 * ```
 */
export function sortBy<T>(
  array: T[],
  keyFn: (item: T) => any,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  const sorted = [...array].sort((a, b) => {
    const aKey = keyFn(a);
    const bKey = keyFn(b);

    if (aKey < bKey) return order === 'asc' ? -1 : 1;
    if (aKey > bKey) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Convert a string to a number safely.
 *
 * @param value - The value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns Number or default value
 *
 * @example
 * ```typescript
 * toNumber('123', 0); // 123
 * toNumber('abc', 0); // 0
 * toNumber(null, 0); // 0
 * ```
 */
export function toNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num)) {
      return num;
    }
  }

  return defaultValue;
}

/**
 * Convert a value to a boolean safely.
 *
 * @param value - The value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns Boolean or default value
 *
 * @example
 * ```typescript
 * toBoolean('true', false); // true
 * toBoolean('1', false); // true
 * toBoolean('false', true); // false
 * toBoolean('0', true); // false
 * toBoolean('abc', false); // false
 * ```
 */
export function toBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return defaultValue;
}

/**
 * Normalize a string (trim, lowercase, remove extra spaces).
 *
 * @param value - The string to normalize
 * @returns Normalized string
 *
 * @example
 * ```typescript
 * normalizeString('  Hello   World  '); // 'hello world'
 * ```
 */
export function normalizeString(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normalize an object by removing undefined/null values and empty strings.
 *
 * @param obj - The object to normalize
 * @param options - Normalization options
 * @returns Normalized object
 *
 * @example
 * ```typescript
 * const data = { a: 1, b: undefined, c: '', d: null, e: 0 };
 * const normalized = normalizeObject(data);
 * // { a: 1, e: 0 }
 * ```
 */
export function normalizeObject<T extends object>(
  obj: T,
  options: {
    removeUndefined?: boolean;
    removeNull?: boolean;
    removeEmptyStrings?: boolean;
  } = {}
): Partial<T> {
  const {
    removeUndefined = true,
    removeNull = true,
    removeEmptyStrings = true
  } = options;

  const result: any = {};

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const value = obj[key];

    if (removeUndefined && value === undefined) continue;
    if (removeNull && value === null) continue;
    if (removeEmptyStrings && value === '') continue;

    if (isPlainObject(value)) {
      result[key] = normalizeObject(value, options);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Safe JSON parse with default value.
 *
 * @param json - JSON string to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed object or default value
 *
 * @example
 * ```typescript
 * parseJSON('{"a":1}', {}); // { a: 1 }
 * parseJSON('invalid', {}); // {}
 * ```
 */
export function parseJSON<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * Safe JSON stringify with error handling.
 *
 * @param value - Value to stringify
 * @param defaultValue - Default string if stringify fails
 * @param pretty - Whether to pretty-print with indentation
 * @returns JSON string or default value
 *
 * @example
 * ```typescript
 * stringifyJSON({ a: 1 }, '{}'); // '{"a":1}'
 * stringifyJSON(circular, '{}'); // '{}'
 * ```
 */
export function stringifyJSON(
  value: any,
  defaultValue: string,
  pretty = false
): string {
  try {
    return JSON.stringify(value, null, pretty ? 2 : 0);
  } catch {
    return defaultValue;
  }
}

/**
 * Compare two values for deep equality.
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if values are deeply equal
 *
 * @example
 * ```typescript
 * isEqual({ a: 1 }, { a: 1 }); // true
 * isEqual([1, 2], [1, 2]); // true
 * isEqual({ a: 1 }, { a: 2 }); // false
 * ```
 */
export function isEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key) || !isEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}
