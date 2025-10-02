/**
 * Validation utilities for common input validation tasks.
 *
 * This module provides helper functions for validating user input,
 * preventing common security issues like XSS and injection attacks.
 *
 * @module utils/validation
 */

/**
 * Validation result object
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Email validation regex (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * URL validation regex
 */
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

/**
 * Alphanumeric validation regex
 */
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]+$/;

/**
 * Check if a value is a non-empty string
 *
 * @param value - The value to check
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = isNonEmptyString(req.queryParam('name'));
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 *   return;
 * }
 * ```
 */
export function isNonEmptyString(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, error: 'Value must be a string' };
  }
  if (value.trim().length === 0) {
    return { valid: false, error: 'Value cannot be empty' };
  }
  return { valid: true };
}

/**
 * Check if a string is a valid email address
 *
 * @param email - The email address to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = isValidEmail(req.body().email);
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 * }
 * ```
 */
export function isValidEmail(email: unknown): ValidationResult {
  const stringCheck = isNonEmptyString(email);
  if (!stringCheck.valid) {
    return stringCheck;
  }

  if (!EMAIL_REGEX.test(email as string)) {
    return { valid: false, error: 'Invalid email address format' };
  }

  return { valid: true };
}

/**
 * Check if a string is a valid URL
 *
 * @param url - The URL to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = isValidUrl(req.queryParam('redirect'));
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 * }
 * ```
 */
export function isValidUrl(url: unknown): ValidationResult {
  const stringCheck = isNonEmptyString(url);
  if (!stringCheck.valid) {
    return stringCheck;
  }

  if (!URL_REGEX.test(url as string)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  return { valid: true };
}

/**
 * Check if a value is a number within a range
 *
 * @param value - The value to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const age = parseInt(req.queryParam('age') || '0');
 * const result = isNumberInRange(age, 0, 120);
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 * }
 * ```
 */
export function isNumberInRange(value: unknown, min: number, max: number): ValidationResult {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: 'Value must be a number' };
  }

  if (value < min || value > max) {
    return { valid: false, error: `Value must be between ${min} and ${max}` };
  }

  return { valid: true };
}

/**
 * Check if a string length is within a range
 *
 * @param value - The string to check
 * @param minLength - Minimum length (inclusive)
 * @param maxLength - Maximum length (inclusive)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = isStringLength(req.body().username, 3, 20);
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 * }
 * ```
 */
export function isStringLength(value: unknown, minLength: number, maxLength: number): ValidationResult {
  const stringCheck = isNonEmptyString(value);
  if (!stringCheck.valid) {
    return stringCheck;
  }

  const str = value as string;
  if (str.length < minLength || str.length > maxLength) {
    return { valid: false, error: `Length must be between ${minLength} and ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Check if a string contains only alphanumeric characters
 *
 * @param value - The string to check
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = isAlphanumeric(req.pathParam('id'));
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 * }
 * ```
 */
export function isAlphanumeric(value: unknown): ValidationResult {
  const stringCheck = isNonEmptyString(value);
  if (!stringCheck.valid) {
    return stringCheck;
  }

  if (!ALPHANUMERIC_REGEX.test(value as string)) {
    return { valid: false, error: 'Value must contain only letters and numbers' };
  }

  return { valid: true };
}

/**
 * Check if a value is one of the allowed values
 *
 * @param value - The value to check
 * @param allowedValues - Array of allowed values
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = isOneOf(req.queryParam('sort'), ['asc', 'desc']);
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 * }
 * ```
 */
export function isOneOf<T>(value: unknown, allowedValues: T[]): ValidationResult {
  if (!allowedValues.includes(value as T)) {
    return { valid: false, error: `Value must be one of: ${allowedValues.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Sanitize a string for safe HTML output (prevent XSS)
 *
 * @param value - The string to sanitize
 * @returns The sanitized string
 *
 * @example
 * ```typescript
 * const safeName = sanitizeHtml(req.queryParam('name'));
 * req.send({ message: `Hello, ${safeName}` });
 * ```
 */
export function sanitizeHtml(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and parse an integer from a string
 *
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns The parsed integer or default value
 *
 * @example
 * ```typescript
 * const page = parseIntSafe(req.queryParam('page'), 1);
 * const limit = parseIntSafe(req.queryParam('limit'), 10);
 * ```
 */
export function parseIntSafe(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number') {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
}

/**
 * Validate and parse a float from a string
 *
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns The parsed float or default value
 *
 * @example
 * ```typescript
 * const price = parseFloatSafe(req.queryParam('price'), 0.0);
 * ```
 */
export function parseFloatSafe(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
}

/**
 * Validate and parse a boolean from various input types
 *
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns The parsed boolean or default value
 *
 * @example
 * ```typescript
 * const isActive = parseBooleanSafe(req.queryParam('active'), false);
 * ```
 */
export function parseBooleanSafe(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return defaultValue;
}

/**
 * Check if an object has all required properties
 *
 * @param obj - The object to check
 * @param requiredProps - Array of required property names
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = hasRequiredProperties(req.body(), ['username', 'email', 'password']);
 * if (!result.valid) {
 *   req.code(400).send({ error: result.error });
 * }
 * ```
 */
export function hasRequiredProperties(obj: unknown, requiredProps: string[]): ValidationResult {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: 'Input must be an object' };
  }

  const missing: string[] = [];
  for (const prop of requiredProps) {
    if (!(prop in obj) || (obj as any)[prop] === undefined || (obj as any)[prop] === null) {
      missing.push(prop);
    }
  }

  if (missing.length > 0) {
    return { valid: false, error: `Missing required properties: ${missing.join(', ')}` };
  }

  return { valid: true };
}
