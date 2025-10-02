/**
 * Environment variable utilities with type-safe access and validation.
 *
 * This module provides helpers for reading and validating environment variables.
 *
 * @module utils/env
 */

/**
 * Get an environment variable as a string
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not found
 * @returns The environment variable value or default
 *
 * @example
 * ```typescript
 * const apiUrl = getEnvString('API_URL', 'http://localhost:3000');
 * ```
 */
export function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return defaultValue;
  }
  return value;
}

/**
 * Get an environment variable as a number
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not found
 * @returns The parsed number or default
 * @throws {Error} If value cannot be parsed as a number
 *
 * @example
 * ```typescript
 * const port = getEnvNumber('PORT', 3000);
 * ```
 */
export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return defaultValue;
  }

  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }

  return parsed;
}

/**
 * Get an environment variable as a boolean
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not found
 * @returns The parsed boolean or default
 *
 * Truthy values: 'true', '1', 'yes', 'on'
 * Falsy values: 'false', '0', 'no', 'off', undefined
 *
 * @example
 * ```typescript
 * const debug = getEnvBoolean('DEBUG', false);
 * ```
 */
export function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }

  const lower = value.toLowerCase().trim();
  if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off' || lower === '') {
    return false;
  }

  console.warn(`Environment variable ${key} has unexpected value: ${value}, defaulting to ${defaultValue}`);
  return defaultValue;
}

/**
 * Get an environment variable from a list of allowed values
 *
 * @param key - Environment variable name
 * @param allowedValues - Array of allowed values
 * @param defaultValue - Default value if not found
 * @returns The value or default
 * @throws {Error} If value is not in allowed list
 *
 * @example
 * ```typescript
 * const env = getEnvEnum('NODE_ENV', ['development', 'production'], 'development');
 * ```
 */
export function getEnvEnum<T extends string>(
  key: string,
  allowedValues: readonly T[],
  defaultValue?: T
): T {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return defaultValue;
  }

  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `Environment variable ${key} must be one of: ${allowedValues.join(', ')}, got: ${value}`
    );
  }

  return value as T;
}

/**
 * Get an environment variable as an array (comma-separated)
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not found
 * @returns Array of strings
 *
 * @example
 * ```typescript
 * const allowedOrigins = getEnvArray('ALLOWED_ORIGINS', ['http://localhost:3000']);
 * ```
 */
export function getEnvArray(key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  return value.split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * Get an environment variable as JSON
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not found
 * @returns Parsed JSON object
 * @throws {Error} If value is not valid JSON
 *
 * @example
 * ```typescript
 * const config = getEnvJSON<AppConfig>('APP_CONFIG', defaultConfig);
 * ```
 */
export function getEnvJSON<T>(key: string, defaultValue?: T): T {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return defaultValue;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Environment variable ${key} contains invalid JSON: ${value}`);
  }
}

/**
 * Check if running in production environment
 *
 * @returns true if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development environment
 *
 * @returns true if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test environment
 *
 * @returns true if NODE_ENV is 'test'
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get all environment variables with a specific prefix
 *
 * @param prefix - Prefix to filter by
 * @param stripPrefix - Whether to remove prefix from keys (default: true)
 * @returns Object with matching environment variables
 *
 * @example
 * ```typescript
 * // PEAQUE_API_KEY=xxx, PEAQUE_API_URL=yyy
 * const config = getEnvWithPrefix('PEAQUE_');
 * // Returns: { API_KEY: 'xxx', API_URL: 'yyy' }
 * ```
 */
export function getEnvWithPrefix(prefix: string, stripPrefix = true): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      const finalKey = stripPrefix ? key.slice(prefix.length) : key;
      result[finalKey] = value;
    }
  }

  return result;
}

/**
 * Require multiple environment variables
 *
 * @param keys - Array of required variable names
 * @throws {Error} If any variable is missing
 *
 * @example
 * ```typescript
 * requireEnv(['DATABASE_URL', 'API_KEY', 'SECRET']);
 * ```
 */
export function requireEnv(keys: string[]): void {
  const missing: string[] = [];

  for (const key of keys) {
    if (process.env[key] === undefined) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
