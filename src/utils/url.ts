/**
 * URL manipulation and parsing utilities.
 *
 * This module provides utilities for working with URLs, query strings,
 * and URL components.
 *
 * @module utils/url
 */

/**
 * Parse URL into components.
 *
 * @param url - URL string to parse
 * @returns Parsed URL components or null if invalid
 *
 * @example
 * ```typescript
 * const parsed = parseUrl('https://example.com:8080/path?a=1#hash');
 * // {
 * //   protocol: 'https:',
 * //   hostname: 'example.com',
 * //   port: '8080',
 * //   pathname: '/path',
 * //   search: '?a=1',
 * //   hash: '#hash',
 * //   ...
 * // }
 * ```
 */
export function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Build URL from components.
 *
 * @param options - URL components
 * @returns Constructed URL string
 *
 * @example
 * ```typescript
 * const url = buildUrl({
 *   protocol: 'https',
 *   hostname: 'api.example.com',
 *   pathname: '/users',
 *   params: { page: '1', limit: '10' }
 * });
 * // 'https://api.example.com/users?page=1&limit=10'
 * ```
 */
export function buildUrl(options: {
  protocol?: string;
  hostname?: string;
  port?: number | string;
  pathname?: string;
  params?: Record<string, string | number | boolean | string[]>;
  hash?: string;
}): string {
  const { protocol = 'https', hostname, port, pathname = '', params, hash } = options;

  if (!hostname) {
    throw new Error('hostname is required');
  }

  let url = `${protocol}://${hostname}`;

  if (port) {
    url += `:${port}`;
  }

  if (pathname) {
    url += pathname.startsWith('/') ? pathname : `/${pathname}`;
  }

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else {
        searchParams.append(key, String(value));
      }
    }
    url += `?${searchParams.toString()}`;
  }

  if (hash) {
    url += hash.startsWith('#') ? hash : `#${hash}`;
  }

  return url;
}

/**
 * Add or update query parameters in a URL.
 *
 * @param url - Base URL
 * @param params - Parameters to add/update
 * @returns URL with updated parameters
 *
 * @example
 * ```typescript
 * const url = addQueryParams('https://example.com/path', {
 *   page: 2,
 *   sort: 'name'
 * });
 * // 'https://example.com/path?page=2&sort=name'
 * ```
 */
export function addQueryParams(
  url: string,
  params: Record<string, string | number | boolean | string[]>
): string {
  const parsed = parseUrl(url);
  if (!parsed) {
    throw new Error(`Invalid URL: ${url}`);
  }

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      parsed.searchParams.delete(key);
      value.forEach(v => parsed.searchParams.append(key, String(v)));
    } else {
      parsed.searchParams.set(key, String(value));
    }
  }

  return parsed.toString();
}

/**
 * Remove query parameters from a URL.
 *
 * @param url - Base URL
 * @param keys - Parameter keys to remove
 * @returns URL without specified parameters
 *
 * @example
 * ```typescript
 * const url = removeQueryParams(
 *   'https://example.com/path?a=1&b=2&c=3',
 *   ['a', 'c']
 * );
 * // 'https://example.com/path?b=2'
 * ```
 */
export function removeQueryParams(url: string, keys: string[]): string {
  const parsed = parseUrl(url);
  if (!parsed) {
    throw new Error(`Invalid URL: ${url}`);
  }

  keys.forEach(key => parsed.searchParams.delete(key));
  return parsed.toString();
}

/**
 * Get query parameter value from URL.
 *
 * @param url - URL string
 * @param key - Parameter key
 * @returns Parameter value or null
 *
 * @example
 * ```typescript
 * const page = getQueryParam('https://example.com?page=2', 'page');
 * // '2'
 * ```
 */
export function getQueryParam(url: string, key: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  return parsed.searchParams.get(key);
}

/**
 * Get all values for a query parameter.
 *
 * @param url - URL string
 * @param key - Parameter key
 * @returns Array of parameter values
 *
 * @example
 * ```typescript
 * const tags = getQueryParamValues('https://example.com?tag=a&tag=b', 'tag');
 * // ['a', 'b']
 * ```
 */
export function getQueryParamValues(url: string, key: string): string[] {
  const parsed = parseUrl(url);
  if (!parsed) return [];
  return parsed.searchParams.getAll(key);
}

/**
 * Get all query parameters as an object.
 *
 * @param url - URL string
 * @returns Object with query parameters
 *
 * @example
 * ```typescript
 * const params = getQueryParams('https://example.com?a=1&b=2');
 * // { a: '1', b: '2' }
 * ```
 */
export function getQueryParams(url: string): Record<string, string | string[]> {
  const parsed = parseUrl(url);
  if (!parsed) return {};

  const params: Record<string, string | string[]> = {};
  parsed.searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  return params;
}

/**
 * Join URL path segments.
 *
 * @param segments - Path segments to join
 * @returns Joined path
 *
 * @example
 * ```typescript
 * joinUrlPath('api', 'v1', 'users'); // 'api/v1/users'
 * joinUrlPath('/api/', '/users/'); // '/api/users'
 * ```
 */
export function joinUrlPath(...segments: string[]): string {
  return segments
    .map(segment => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/**
 * Join base URL with path.
 *
 * @param baseUrl - Base URL
 * @param path - Path to join
 * @returns Complete URL
 *
 * @example
 * ```typescript
 * joinUrl('https://api.example.com', '/users');
 * // 'https://api.example.com/users'
 * ```
 */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const pathSegment = path.replace(/^\/+/, '');
  return `${base}/${pathSegment}`;
}

/**
 * Check if URL is absolute (has protocol).
 *
 * @param url - URL to check
 * @returns True if absolute URL
 *
 * @example
 * ```typescript
 * isAbsoluteUrl('https://example.com'); // true
 * isAbsoluteUrl('/path'); // false
 * isAbsoluteUrl('//example.com'); // true
 * ```
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}

/**
 * Check if URL is a data URL.
 *
 * @param url - URL to check
 * @returns True if data URL
 *
 * @example
 * ```typescript
 * isDataUrl('data:text/plain;base64,SGVsbG8='); // true
 * isDataUrl('https://example.com'); // false
 * ```
 */
export function isDataUrl(url: string): boolean {
  return /^data:/i.test(url);
}

/**
 * Get domain from URL.
 *
 * @param url - URL string
 * @returns Domain or null
 *
 * @example
 * ```typescript
 * getDomain('https://api.example.com:8080/path');
 * // 'example.com'
 * ```
 */
export function getDomain(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;

  const hostname = parsed.hostname;
  const parts = hostname.split('.');

  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }

  return hostname;
}

/**
 * Get subdomain from URL.
 *
 * @param url - URL string
 * @returns Subdomain or null
 *
 * @example
 * ```typescript
 * getSubdomain('https://api.example.com'); // 'api'
 * getSubdomain('https://example.com'); // null
 * ```
 */
export function getSubdomain(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;

  const parts = parsed.hostname.split('.');
  if (parts.length > 2) {
    return parts.slice(0, -2).join('.');
  }

  return null;
}

/**
 * Normalize URL (remove trailing slashes, default ports, etc.).
 *
 * @param url - URL to normalize
 * @returns Normalized URL
 *
 * @example
 * ```typescript
 * normalizeUrl('https://example.com:443/path/');
 * // 'https://example.com/path'
 * ```
 */
export function normalizeUrl(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed) return url;

  // Remove default ports
  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  // Remove trailing slash from pathname
  if (parsed.pathname !== '/') {
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
  }

  // Sort query parameters
  const params = Array.from(parsed.searchParams.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  parsed.search = '';
  params.forEach(([key, value]) => parsed.searchParams.append(key, value));

  return parsed.toString();
}

/**
 * Encode URL component safely.
 *
 * @param value - Value to encode
 * @returns Encoded value
 *
 * @example
 * ```typescript
 * encodeUrlComponent('hello world'); // 'hello%20world'
 * encodeUrlComponent('a&b=c'); // 'a%26b%3Dc'
 * ```
 */
export function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Decode URL component safely.
 *
 * @param value - Value to decode
 * @returns Decoded value
 *
 * @example
 * ```typescript
 * decodeUrlComponent('hello%20world'); // 'hello world'
 * ```
 */
export function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Check if two URLs are the same (normalized comparison).
 *
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns True if URLs are the same
 *
 * @example
 * ```typescript
 * isSameUrl('https://example.com/path', 'https://example.com/path/');
 * // true (after normalization)
 * ```
 */
export function isSameUrl(url1: string, url2: string): boolean {
  try {
    return normalizeUrl(url1) === normalizeUrl(url2);
  } catch {
    return false;
  }
}

/**
 * Create a URL from a template with variables.
 *
 * @param template - URL template with {variable} placeholders
 * @param variables - Variable values
 * @returns URL with variables replaced
 *
 * @example
 * ```typescript
 * const url = createUrlFromTemplate(
 *   'https://api.example.com/users/{userId}/posts/{postId}',
 *   { userId: '123', postId: '456' }
 * );
 * // 'https://api.example.com/users/123/posts/456'
 * ```
 */
export function createUrlFromTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }

  return result;
}

/**
 * Extract path parameters from URL using a pattern.
 *
 * @param url - URL to parse
 * @param pattern - Pattern with {variable} placeholders
 * @returns Extracted parameters or null if no match
 *
 * @example
 * ```typescript
 * const params = extractPathParams(
 *   '/users/123/posts/456',
 *   '/users/{userId}/posts/{postId}'
 * );
 * // { userId: '123', postId: '456' }
 * ```
 */
export function extractPathParams(
  url: string,
  pattern: string
): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const urlParts = url.split('/').filter(Boolean);

  if (patternParts.length !== urlParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const urlPart = urlParts[i];

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      const paramName = patternPart.slice(1, -1);
      params[paramName] = urlPart;
    } else if (patternPart !== urlPart) {
      return null;
    }
  }

  return params;
}

/**
 * Get file extension from URL.
 *
 * @param url - URL string
 * @returns File extension (with dot) or null
 *
 * @example
 * ```typescript
 * getUrlExtension('https://example.com/image.png'); // '.png'
 * getUrlExtension('https://example.com/file.tar.gz'); // '.gz'
 * ```
 */
export function getUrlExtension(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) return null;

  const pathname = parsed.pathname;
  const lastDot = pathname.lastIndexOf('.');
  const lastSlash = pathname.lastIndexOf('/');

  if (lastDot > lastSlash && lastDot > 0) {
    return pathname.slice(lastDot);
  }

  return null;
}

/**
 * Check if URL has a specific extension.
 *
 * @param url - URL string
 * @param extensions - Array of extensions to check (without dot)
 * @returns True if URL has any of the extensions
 *
 * @example
 * ```typescript
 * hasUrlExtension('https://example.com/image.png', ['png', 'jpg']);
 * // true
 * ```
 */
export function hasUrlExtension(url: string, extensions: string[]): boolean {
  const ext = getUrlExtension(url);
  if (!ext) return false;

  const extWithoutDot = ext.slice(1).toLowerCase();
  return extensions.some(e => e.toLowerCase() === extWithoutDot);
}

/**
 * Strip protocol from URL.
 *
 * @param url - URL string
 * @returns URL without protocol
 *
 * @example
 * ```typescript
 * stripProtocol('https://example.com/path');
 * // 'example.com/path'
 * ```
 */
export function stripProtocol(url: string): string {
  return url.replace(/^[a-z]+:\/\//i, '');
}

/**
 * Get URL protocol.
 *
 * @param url - URL string
 * @returns Protocol (with colon) or null
 *
 * @example
 * ```typescript
 * getProtocol('https://example.com'); // 'https:'
 * getProtocol('ftp://example.com'); // 'ftp:'
 * ```
 */
export function getProtocol(url: string): string | null {
  const parsed = parseUrl(url);
  return parsed ? parsed.protocol : null;
}
