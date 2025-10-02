/**
 * Collection utilities for Set and Map operations.
 *
 * This module provides helper functions for working with JavaScript
 * Set and Map collections, including set operations and map transformations.
 *
 * @module utils/collections
 */

/**
 * Create a Set from an array with optional transform function.
 *
 * @param array - Array to convert
 * @param transform - Optional transform function
 * @returns Set with unique values
 *
 * @example
 * ```typescript
 * const set = toSet([1, 2, 2, 3]); // Set(1, 2, 3)
 * const idSet = toSet(users, u => u.id); // Set of user IDs
 * ```
 */
export function toSet<T, U = T>(
  array: T[],
  transform?: (item: T) => U
): Set<U> {
  if (transform) {
    return new Set(array.map(transform));
  }
  return new Set(array as any);
}

/**
 * Convert Set to Array.
 *
 * @param set - Set to convert
 * @returns Array with set values
 *
 * @example
 * ```typescript
 * const arr = toArray(new Set([1, 2, 3])); // [1, 2, 3]
 * ```
 */
export function toArray<T>(set: Set<T>): T[] {
  return Array.from(set);
}

/**
 * Union of two or more sets.
 *
 * @param sets - Sets to union
 * @returns New set with all unique values
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2, 3]);
 * const set2 = new Set([3, 4, 5]);
 * const result = union(set1, set2); // Set(1, 2, 3, 4, 5)
 * ```
 */
export function union<T>(...sets: Set<T>[]): Set<T> {
  const result = new Set<T>();
  for (const set of sets) {
    for (const item of set) {
      result.add(item);
    }
  }
  return result;
}

/**
 * Intersection of two or more sets.
 *
 * @param sets - Sets to intersect
 * @returns New set with common values
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2, 3]);
 * const set2 = new Set([2, 3, 4]);
 * const result = intersection(set1, set2); // Set(2, 3)
 * ```
 */
export function intersection<T>(...sets: Set<T>[]): Set<T> {
  if (sets.length === 0) return new Set();
  if (sets.length === 1) return new Set(sets[0]);

  const result = new Set<T>();
  const [first, ...rest] = sets;

  for (const item of first) {
    if (rest.every(set => set.has(item))) {
      result.add(item);
    }
  }

  return result;
}

/**
 * Difference of two sets (items in first set but not in second).
 *
 * @param set1 - First set
 * @param set2 - Second set
 * @returns New set with difference
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2, 3]);
 * const set2 = new Set([2, 3, 4]);
 * const result = difference(set1, set2); // Set(1)
 * ```
 */
export function difference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const item of set1) {
    if (!set2.has(item)) {
      result.add(item);
    }
  }
  return result;
}

/**
 * Symmetric difference of two sets (items in either set but not in both).
 *
 * @param set1 - First set
 * @param set2 - Second set
 * @returns New set with symmetric difference
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2, 3]);
 * const set2 = new Set([2, 3, 4]);
 * const result = symmetricDifference(set1, set2); // Set(1, 4)
 * ```
 */
export function symmetricDifference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const result = new Set<T>();

  for (const item of set1) {
    if (!set2.has(item)) {
      result.add(item);
    }
  }

  for (const item of set2) {
    if (!set1.has(item)) {
      result.add(item);
    }
  }

  return result;
}

/**
 * Check if set is a subset of another set.
 *
 * @param subset - Potential subset
 * @param superset - Potential superset
 * @returns True if subset is a subset of superset
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2]);
 * const set2 = new Set([1, 2, 3, 4]);
 * isSubset(set1, set2); // true
 * ```
 */
export function isSubset<T>(subset: Set<T>, superset: Set<T>): boolean {
  for (const item of subset) {
    if (!superset.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if set is a superset of another set.
 *
 * @param superset - Potential superset
 * @param subset - Potential subset
 * @returns True if superset is a superset of subset
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2, 3, 4]);
 * const set2 = new Set([1, 2]);
 * isSuperset(set1, set2); // true
 * ```
 */
export function isSuperset<T>(superset: Set<T>, subset: Set<T>): boolean {
  return isSubset(subset, superset);
}

/**
 * Check if two sets are disjoint (have no common elements).
 *
 * @param set1 - First set
 * @param set2 - Second set
 * @returns True if sets are disjoint
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2]);
 * const set2 = new Set([3, 4]);
 * isDisjoint(set1, set2); // true
 * ```
 */
export function isDisjoint<T>(set1: Set<T>, set2: Set<T>): boolean {
  for (const item of set1) {
    if (set2.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if two sets are equal (have the same elements).
 *
 * @param set1 - First set
 * @param set2 - Second set
 * @returns True if sets are equal
 *
 * @example
 * ```typescript
 * const set1 = new Set([1, 2, 3]);
 * const set2 = new Set([3, 2, 1]);
 * isSetEqual(set1, set2); // true
 * ```
 */
export function isSetEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) {
    return false;
  }
  for (const item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Filter a set by a predicate.
 *
 * @param set - Set to filter
 * @param predicate - Filter function
 * @returns New set with filtered values
 *
 * @example
 * ```typescript
 * const set = new Set([1, 2, 3, 4, 5]);
 * const even = filterSet(set, n => n % 2 === 0); // Set(2, 4)
 * ```
 */
export function filterSet<T>(set: Set<T>, predicate: (item: T) => boolean): Set<T> {
  const result = new Set<T>();
  for (const item of set) {
    if (predicate(item)) {
      result.add(item);
    }
  }
  return result;
}

/**
 * Map a set to a new set.
 *
 * @param set - Set to map
 * @param mapper - Transform function
 * @returns New set with transformed values
 *
 * @example
 * ```typescript
 * const set = new Set([1, 2, 3]);
 * const doubled = mapSet(set, n => n * 2); // Set(2, 4, 6)
 * ```
 */
export function mapSet<T, U>(set: Set<T>, mapper: (item: T) => U): Set<U> {
  const result = new Set<U>();
  for (const item of set) {
    result.add(mapper(item));
  }
  return result;
}

/**
 * Get keys from a Map as an array.
 *
 * @param map - Map to get keys from
 * @returns Array of keys
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * const keys = mapKeys(map); // ['a', 'b']
 * ```
 */
export function mapKeys<K, V>(map: Map<K, V>): K[] {
  return Array.from(map.keys());
}

/**
 * Get values from a Map as an array.
 *
 * @param map - Map to get values from
 * @returns Array of values
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * const values = mapValues(map); // [1, 2]
 * ```
 */
export function mapValues<K, V>(map: Map<K, V>): V[] {
  return Array.from(map.values());
}

/**
 * Get entries from a Map as an array of tuples.
 *
 * @param map - Map to get entries from
 * @returns Array of [key, value] tuples
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * const entries = mapEntries(map); // [['a', 1], ['b', 2]]
 * ```
 */
export function mapEntries<K, V>(map: Map<K, V>): [K, V][] {
  return Array.from(map.entries());
}

/**
 * Convert Map to object.
 *
 * @param map - Map to convert
 * @returns Plain object
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * const obj = mapToObject(map); // { a: 1, b: 2 }
 * ```
 */
export function mapToObject<V>(map: Map<string, V>): Record<string, V> {
  const obj: Record<string, V> = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Convert object to Map.
 *
 * @param obj - Object to convert
 * @returns Map
 *
 * @example
 * ```typescript
 * const obj = { a: 1, b: 2 };
 * const map = objectToMap(obj); // Map([['a', 1], ['b', 2]])
 * ```
 */
export function objectToMap<V>(obj: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(obj));
}

/**
 * Filter a Map by predicate.
 *
 * @param map - Map to filter
 * @param predicate - Filter function
 * @returns New map with filtered entries
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * const filtered = filterMap(map, (k, v) => v > 1);
 * // Map([['b', 2], ['c', 3]])
 * ```
 */
export function filterMap<K, V>(
  map: Map<K, V>,
  predicate: (key: K, value: V) => boolean
): Map<K, V> {
  const result = new Map<K, V>();
  for (const [key, value] of map) {
    if (predicate(key, value)) {
      result.set(key, value);
    }
  }
  return result;
}

/**
 * Transform Map values.
 *
 * @param map - Map to transform
 * @param mapper - Transform function
 * @returns New map with transformed values
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * const doubled = mapMapValues(map, v => v * 2);
 * // Map([['a', 2], ['b', 4]])
 * ```
 */
export function mapMapValues<K, V, U>(
  map: Map<K, V>,
  mapper: (value: V, key: K) => U
): Map<K, U> {
  const result = new Map<K, U>();
  for (const [key, value] of map) {
    result.set(key, mapper(value, key));
  }
  return result;
}

/**
 * Transform Map keys.
 *
 * @param map - Map to transform
 * @param mapper - Transform function
 * @returns New map with transformed keys
 *
 * @example
 * ```typescript
 * const map = new Map([[1, 'a'], [2, 'b']]);
 * const prefixed = mapMapKeys(map, k => `key_${k}`);
 * // Map([['key_1', 'a'], ['key_2', 'b']])
 * ```
 */
export function mapMapKeys<K, V, U>(
  map: Map<K, V>,
  mapper: (key: K, value: V) => U
): Map<U, V> {
  const result = new Map<U, V>();
  for (const [key, value] of map) {
    result.set(mapper(key, value), value);
  }
  return result;
}

/**
 * Merge multiple Maps (later maps override earlier ones).
 *
 * @param maps - Maps to merge
 * @returns Merged map
 *
 * @example
 * ```typescript
 * const map1 = new Map([['a', 1], ['b', 2]]);
 * const map2 = new Map([['b', 3], ['c', 4]]);
 * const merged = mergeMaps(map1, map2);
 * // Map([['a', 1], ['b', 3], ['c', 4]])
 * ```
 */
export function mergeMaps<K, V>(...maps: Map<K, V>[]): Map<K, V> {
  const result = new Map<K, V>();
  for (const map of maps) {
    for (const [key, value] of map) {
      result.set(key, value);
    }
  }
  return result;
}

/**
 * Group array items into a Map by key function.
 *
 * @param array - Array to group
 * @param keyFn - Function to extract key
 * @returns Map with grouped items
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: 1, role: 'admin' },
 *   { id: 2, role: 'user' },
 *   { id: 3, role: 'admin' }
 * ];
 * const grouped = groupByToMap(users, u => u.role);
 * // Map([
 * //   ['admin', [{ id: 1, ... }, { id: 3, ... }]],
 * //   ['user', [{ id: 2, ... }]]
 * // ])
 * ```
 */
export function groupByToMap<T, K>(
  array: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const result = new Map<K, T[]>();

  for (const item of array) {
    const key = keyFn(item);
    const group = result.get(key);

    if (group) {
      group.push(item);
    } else {
      result.set(key, [item]);
    }
  }

  return result;
}

/**
 * Create an index Map from array (one value per key).
 *
 * @param array - Array to index
 * @param keyFn - Function to extract key
 * @returns Map with indexed items
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' }
 * ];
 * const index = indexByToMap(users, u => u.id);
 * // Map([[1, { id: 1, ... }], [2, { id: 2, ... }]])
 * ```
 */
export function indexByToMap<T, K>(
  array: T[],
  keyFn: (item: T) => K
): Map<K, T> {
  const result = new Map<K, T>();

  for (const item of array) {
    result.set(keyFn(item), item);
  }

  return result;
}

/**
 * Check if Map has all specified keys.
 *
 * @param map - Map to check
 * @param keys - Keys to check for
 * @returns True if map has all keys
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * hasAllKeys(map, ['a', 'b']); // true
 * hasAllKeys(map, ['a', 'c']); // false
 * ```
 */
export function hasAllKeys<K, V>(map: Map<K, V>, keys: K[]): boolean {
  return keys.every(key => map.has(key));
}

/**
 * Check if Map has any of the specified keys.
 *
 * @param map - Map to check
 * @param keys - Keys to check for
 * @returns True if map has any of the keys
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * hasAnyKey(map, ['a', 'c']); // true
 * hasAnyKey(map, ['c', 'd']); // false
 * ```
 */
export function hasAnyKey<K, V>(map: Map<K, V>, keys: K[]): boolean {
  return keys.some(key => map.has(key));
}

/**
 * Pick specific keys from a Map.
 *
 * @param map - Map to pick from
 * @param keys - Keys to pick
 * @returns New map with only picked keys
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * const picked = pickKeys(map, ['a', 'c']);
 * // Map([['a', 1], ['c', 3]])
 * ```
 */
export function pickKeys<K, V>(map: Map<K, V>, keys: K[]): Map<K, V> {
  const result = new Map<K, V>();
  for (const key of keys) {
    if (map.has(key)) {
      result.set(key, map.get(key)!);
    }
  }
  return result;
}

/**
 * Omit specific keys from a Map.
 *
 * @param map - Map to omit from
 * @param keys - Keys to omit
 * @returns New map without omitted keys
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * const omitted = omitKeys(map, ['b']);
 * // Map([['a', 1], ['c', 3]])
 * ```
 */
export function omitKeys<K, V>(map: Map<K, V>, keys: K[]): Map<K, V> {
  const keysSet = new Set(keys);
  const result = new Map<K, V>();

  for (const [key, value] of map) {
    if (!keysSet.has(key)) {
      result.set(key, value);
    }
  }

  return result;
}

/**
 * Invert a Map (swap keys and values).
 *
 * @param map - Map to invert
 * @returns New map with inverted keys and values
 *
 * @example
 * ```typescript
 * const map = new Map([['a', 1], ['b', 2]]);
 * const inverted = invertMap(map);
 * // Map([[1, 'a'], [2, 'b']])
 * ```
 */
export function invertMap<K, V>(map: Map<K, V>): Map<V, K> {
  const result = new Map<V, K>();
  for (const [key, value] of map) {
    result.set(value, key);
  }
  return result;
}
