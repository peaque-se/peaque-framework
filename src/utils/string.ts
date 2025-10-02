/**
 * String manipulation and formatting utilities.
 *
 * This module provides utilities for string operations including case conversion,
 * formatting, validation, truncation, and template processing.
 *
 * @module utils/string
 */

/**
 * Convert string to camelCase.
 *
 * @param str - String to convert
 * @returns camelCase string
 *
 * @example
 * ```typescript
 * camelCase('hello world'); // 'helloWorld'
 * camelCase('hello-world'); // 'helloWorld'
 * camelCase('hello_world'); // 'helloWorld'
 * ```
 */
export function camelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, char => char.toLowerCase());
}

/**
 * Convert string to PascalCase.
 *
 * @param str - String to convert
 * @returns PascalCase string
 *
 * @example
 * ```typescript
 * pascalCase('hello world'); // 'HelloWorld'
 * pascalCase('hello-world'); // 'HelloWorld'
 * ```
 */
export function pascalCase(str: string): string {
  const camel = camelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert string to snake_case.
 *
 * @param str - String to convert
 * @returns snake_case string
 *
 * @example
 * ```typescript
 * snakeCase('helloWorld'); // 'hello_world'
 * snakeCase('HelloWorld'); // 'hello_world'
 * ```
 */
export function snakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/**
 * Convert string to kebab-case.
 *
 * @param str - String to convert
 * @returns kebab-case string
 *
 * @example
 * ```typescript
 * kebabCase('helloWorld'); // 'hello-world'
 * kebabCase('HelloWorld'); // 'hello-world'
 * ```
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Convert string to Title Case.
 *
 * @param str - String to convert
 * @returns Title Case string
 *
 * @example
 * ```typescript
 * titleCase('hello world'); // 'Hello World'
 * titleCase('hello-world'); // 'Hello World'
 * ```
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

/**
 * Capitalize the first letter of a string.
 *
 * @param str - String to capitalize
 * @returns Capitalized string
 *
 * @example
 * ```typescript
 * capitalize('hello'); // 'Hello'
 * capitalize('HELLO'); // 'HELLO'
 * ```
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Uncapitalize the first letter of a string.
 *
 * @param str - String to uncapitalize
 * @returns Uncapitalized string
 *
 * @example
 * ```typescript
 * uncapitalize('Hello'); // 'hello'
 * uncapitalize('HELLO'); // 'hELLO'
 * ```
 */
export function uncapitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Truncate a string to a maximum length with ellipsis.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length (including ellipsis)
 * @param ellipsis - Ellipsis string (default: '...')
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncate('Hello World', 8); // 'Hello...'
 * truncate('Hello World', 8, '…'); // 'Hello W…'
 * ```
 */
export function truncate(str: string, maxLength: number, ellipsis = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Truncate a string at word boundaries.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length (including ellipsis)
 * @param ellipsis - Ellipsis string (default: '...')
 * @returns Truncated string at word boundary
 *
 * @example
 * ```typescript
 * truncateWords('Hello beautiful world', 15);
 * // 'Hello beautiful...'
 * ```
 */
export function truncateWords(str: string, maxLength: number, ellipsis = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }

  const truncated = str.slice(0, maxLength - ellipsis.length);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + ellipsis;
  }

  return truncated + ellipsis;
}

/**
 * Pad a string to a specified length.
 *
 * @param str - String to pad
 * @param length - Target length
 * @param char - Character to pad with (default: ' ')
 * @param direction - Padding direction ('left', 'right', or 'both')
 * @returns Padded string
 *
 * @example
 * ```typescript
 * pad('5', 3, '0', 'left'); // '005'
 * pad('hello', 10, '-', 'right'); // 'hello-----'
 * pad('hi', 6, '-', 'both'); // '--hi--'
 * ```
 */
export function pad(
  str: string,
  length: number,
  char = ' ',
  direction: 'left' | 'right' | 'both' = 'left'
): string {
  if (str.length >= length) {
    return str;
  }

  const padLength = length - str.length;

  if (direction === 'left') {
    return char.repeat(padLength) + str;
  } else if (direction === 'right') {
    return str + char.repeat(padLength);
  } else {
    const leftPad = Math.floor(padLength / 2);
    const rightPad = padLength - leftPad;
    return char.repeat(leftPad) + str + char.repeat(rightPad);
  }
}

/**
 * Replace all occurrences of a substring.
 *
 * @param str - Source string
 * @param search - String to search for
 * @param replacement - Replacement string
 * @returns String with replacements
 *
 * @example
 * ```typescript
 * replaceAll('hello world hello', 'hello', 'hi');
 * // 'hi world hi'
 * ```
 */
export function replaceAll(str: string, search: string, replacement: string): string {
  return str.split(search).join(replacement);
}

/**
 * Remove all whitespace from a string.
 *
 * @param str - String to process
 * @returns String without whitespace
 *
 * @example
 * ```typescript
 * removeWhitespace('hello world'); // 'helloworld'
 * removeWhitespace('  a  b  c  '); // 'abc'
 * ```
 */
export function removeWhitespace(str: string): string {
  return str.replace(/\s+/g, '');
}

/**
 * Normalize whitespace (trim and collapse multiple spaces).
 *
 * @param str - String to normalize
 * @returns Normalized string
 *
 * @example
 * ```typescript
 * normalizeWhitespace('  hello   world  '); // 'hello world'
 * ```
 */
export function normalizeWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Count occurrences of a substring.
 *
 * @param str - String to search in
 * @param search - Substring to count
 * @returns Number of occurrences
 *
 * @example
 * ```typescript
 * count('hello world hello', 'hello'); // 2
 * count('aaa', 'aa'); // 2 (overlapping matches counted)
 * ```
 */
export function count(str: string, search: string): number {
  if (!search) return 0;
  return (str.match(new RegExp(escapeRegex(search), 'g')) || []).length;
}

/**
 * Escape special regex characters in a string.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 *
 * @example
 * ```typescript
 * escapeRegex('hello (world)'); // 'hello \\(world\\)'
 * ```
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if string starts with any of the given prefixes.
 *
 * @param str - String to check
 * @param prefixes - Array of prefixes
 * @returns True if string starts with any prefix
 *
 * @example
 * ```typescript
 * startsWithAny('hello world', ['hi', 'hello']); // true
 * startsWithAny('hello world', ['hi', 'bye']); // false
 * ```
 */
export function startsWithAny(str: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => str.startsWith(prefix));
}

/**
 * Check if string ends with any of the given suffixes.
 *
 * @param str - String to check
 * @param suffixes - Array of suffixes
 * @returns True if string ends with any suffix
 *
 * @example
 * ```typescript
 * endsWithAny('hello world', ['world', 'earth']); // true
 * endsWithAny('hello world', ['earth', 'mars']); // false
 * ```
 */
export function endsWithAny(str: string, suffixes: string[]): boolean {
  return suffixes.some(suffix => str.endsWith(suffix));
}

/**
 * Check if string contains any of the given substrings.
 *
 * @param str - String to check
 * @param substrings - Array of substrings
 * @returns True if string contains any substring
 *
 * @example
 * ```typescript
 * containsAny('hello world', ['world', 'earth']); // true
 * containsAny('hello world', ['earth', 'mars']); // false
 * ```
 */
export function containsAny(str: string, substrings: string[]): boolean {
  return substrings.some(substring => str.includes(substring));
}

/**
 * Simple template string replacement.
 *
 * @param template - Template string with {{key}} placeholders
 * @param values - Object with replacement values
 * @returns String with replacements
 *
 * @example
 * ```typescript
 * template('Hello {{name}}, you are {{age}} years old', {
 *   name: 'John',
 *   age: 30
 * });
 * // 'Hello John, you are 30 years old'
 * ```
 */
export function template(template: string, values: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return values[key] !== undefined ? String(values[key]) : '';
  });
}

/**
 * Extract all matches of a regex pattern.
 *
 * @param str - String to search
 * @param pattern - Regex pattern
 * @returns Array of matches
 *
 * @example
 * ```typescript
 * extractMatches('Price: $10, $20, $30', /\$(\d+)/g);
 * // ['$10', '$20', '$30']
 * ```
 */
export function extractMatches(str: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  // Ensure pattern has global flag
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

  while ((match = globalPattern.exec(str)) !== null) {
    matches.push(match[0]);
  }

  return matches;
}

/**
 * Parse a query string into an object.
 *
 * @param queryString - Query string (with or without leading '?')
 * @returns Object with query parameters
 *
 * @example
 * ```typescript
 * parseQueryString('?a=1&b=2&c=3'); // { a: '1', b: '2', c: '3' }
 * parseQueryString('a=1&a=2&b=3'); // { a: ['1', '2'], b: '3' }
 * ```
 */
export function parseQueryString(queryString: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  const search = queryString.startsWith('?') ? queryString.slice(1) : queryString;

  if (!search) return params;

  for (const pair of search.split('&')) {
    const [key, value] = pair.split('=').map(decodeURIComponent);
    if (!key) continue;

    if (params[key]) {
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value || '');
      } else {
        params[key] = [params[key] as string, value || ''];
      }
    } else {
      params[key] = value || '';
    }
  }

  return params;
}

/**
 * Build a query string from an object.
 *
 * @param params - Object with query parameters
 * @returns Query string (without leading '?')
 *
 * @example
 * ```typescript
 * buildQueryString({ a: '1', b: '2' }); // 'a=1&b=2'
 * buildQueryString({ a: ['1', '2'], b: '3' }); // 'a=1&a=2&b=3'
 * ```
 */
export function buildQueryString(params: Record<string, string | string[] | undefined>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  return parts.join('&');
}

/**
 * Slugify a string (convert to URL-friendly format).
 *
 * @param str - String to slugify
 * @returns Slugified string
 *
 * @example
 * ```typescript
 * slugify('Hello World!'); // 'hello-world'
 * slugify('TypeScript & Node.js'); // 'typescript-and-nodejs'
 * ```
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/[^\w\-]+/g, '') // Remove non-word chars except hyphens
    .replace(/\-\-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end
}

/**
 * Generate a random string.
 *
 * @param length - Length of string
 * @param charset - Character set to use
 * @returns Random string
 *
 * @example
 * ```typescript
 * randomString(10); // 'aB3xY9zM2Q'
 * randomString(8, 'numeric'); // '12345678'
 * randomString(6, 'alpha'); // 'aBcDeF'
 * ```
 */
export function randomString(
  length: number,
  charset: 'alphanumeric' | 'alpha' | 'numeric' | 'lowercase' | 'uppercase' = 'alphanumeric'
): string {
  const charsets = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numeric: '0123456789',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  };

  const chars = charsets[charset];
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Check if a string is empty or contains only whitespace.
 *
 * @param str - String to check
 * @returns True if string is blank
 *
 * @example
 * ```typescript
 * isBlank(''); // true
 * isBlank('   '); // true
 * isBlank('hello'); // false
 * ```
 */
export function isBlank(str: string | undefined | null): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Reverse a string.
 *
 * @param str - String to reverse
 * @returns Reversed string
 *
 * @example
 * ```typescript
 * reverse('hello'); // 'olleh'
 * ```
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

/**
 * Check if a string is a palindrome.
 *
 * @param str - String to check
 * @param caseSensitive - Whether to be case sensitive
 * @returns True if string is a palindrome
 *
 * @example
 * ```typescript
 * isPalindrome('racecar'); // true
 * isPalindrome('hello'); // false
 * isPalindrome('A man a plan a canal Panama', false); // true
 * ```
 */
export function isPalindrome(str: string, caseSensitive = false): boolean {
  const normalized = caseSensitive ? str : str.toLowerCase();
  const cleaned = removeWhitespace(normalized);
  return cleaned === reverse(cleaned);
}

/**
 * Calculate Levenshtein distance between two strings.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance
 *
 * @example
 * ```typescript
 * levenshteinDistance('kitten', 'sitting'); // 3
 * levenshteinDistance('hello', 'hello'); // 0
 * ```
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
