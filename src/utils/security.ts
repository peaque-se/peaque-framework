/**
 * Security and cryptography utilities.
 *
 * This module provides utilities for hashing, encryption, token generation,
 * and security-related operations. Uses Node.js crypto module for cryptographic operations.
 *
 * @module utils/security
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hash a password using scrypt (recommended for passwords).
 *
 * @param password - The password to hash
 * @param salt - Optional salt (will be generated if not provided)
 * @returns Object with hash and salt
 *
 * @example
 * ```typescript
 * const { hash, salt } = hashPassword('mypassword');
 * // Store hash and salt in database
 * ```
 */
export function hashPassword(
  password: string,
  salt?: string
): { hash: string; salt: string } {
  const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(16);
  const hash = scryptSync(password, saltBuffer, 64);

  return {
    hash: hash.toString('hex'),
    salt: saltBuffer.toString('hex')
  };
}

/**
 * Verify a password against a hash using constant-time comparison.
 *
 * @param password - The password to verify
 * @param hash - The stored hash
 * @param salt - The stored salt
 * @returns True if password matches
 *
 * @example
 * ```typescript
 * const isValid = verifyPassword(inputPassword, storedHash, storedSalt);
 * if (isValid) {
 *   // Password is correct
 * }
 * ```
 */
export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  try {
    const { hash: newHash } = hashPassword(password, salt);
    const hashBuffer = Buffer.from(hash, 'hex');
    const newHashBuffer = Buffer.from(newHash, 'hex');

    if (hashBuffer.length !== newHashBuffer.length) {
      return false;
    }

    return timingSafeEqual(hashBuffer, newHashBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token.
 *
 * @param length - Length of token in bytes (default: 32)
 * @returns Hex-encoded random token
 *
 * @example
 * ```typescript
 * const sessionId = generateToken(); // 64-character hex string
 * const apiKey = generateToken(48); // 96-character hex string
 * ```
 */
export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a URL-safe random token (base64url encoding).
 *
 * @param length - Length of token in bytes (default: 32)
 * @returns URL-safe base64 encoded token
 *
 * @example
 * ```typescript
 * const resetToken = generateUrlSafeToken();
 * // Can be safely used in URLs without encoding
 * ```
 */
export function generateUrlSafeToken(length = 32): string {
  return randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hash data using SHA-256.
 *
 * @param data - Data to hash
 * @returns Hex-encoded hash
 *
 * @example
 * ```typescript
 * const hash = sha256('hello world');
 * const fileHash = sha256(fileBuffer);
 * ```
 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Hash data using SHA-512.
 *
 * @param data - Data to hash
 * @returns Hex-encoded hash
 *
 * @example
 * ```typescript
 * const hash = sha512('hello world');
 * ```
 */
export function sha512(data: string | Buffer): string {
  return createHash('sha512').update(data).digest('hex');
}

/**
 * Create an HMAC (Hash-based Message Authentication Code).
 *
 * @param data - Data to sign
 * @param secret - Secret key
 * @param algorithm - Hash algorithm (default: 'sha256')
 * @returns Hex-encoded HMAC
 *
 * @example
 * ```typescript
 * const signature = hmac('message', 'secret-key');
 * // Use for API request signing, webhook verification, etc.
 * ```
 */
export function hmac(
  data: string | Buffer,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  return createHash(algorithm).update(secret).update(data).digest('hex');
}

/**
 * Verify an HMAC signature using constant-time comparison.
 *
 * @param data - Original data
 * @param signature - HMAC signature to verify
 * @param secret - Secret key
 * @param algorithm - Hash algorithm (default: 'sha256')
 * @returns True if signature is valid
 *
 * @example
 * ```typescript
 * const isValid = verifyHmac(webhookData, signature, secret);
 * if (!isValid) {
 *   throw new Error('Invalid signature');
 * }
 * ```
 */
export function verifyHmac(
  data: string | Buffer,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  try {
    const expectedSignature = hmac(data, secret, algorithm);
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Options for encryption/decryption.
 */
export interface EncryptionOptions {
  /** Encryption algorithm (default: 'aes-256-gcm') */
  algorithm?: 'aes-256-gcm' | 'aes-256-cbc';
  /** Encoding for output (default: 'hex') */
  encoding?: 'hex' | 'base64';
}

/**
 * Result of encryption operation.
 */
export interface EncryptionResult {
  /** Encrypted data */
  encrypted: string;
  /** Initialization vector */
  iv: string;
  /** Authentication tag (GCM mode only) */
  authTag?: string;
}

/**
 * Encrypt data using AES-256.
 *
 * @param data - Data to encrypt
 * @param key - Encryption key (must be 32 bytes for AES-256)
 * @param options - Encryption options
 * @returns Encryption result with encrypted data, IV, and auth tag
 *
 * @example
 * ```typescript
 * const key = generateToken(32); // 32-byte key
 * const result = encrypt('sensitive data', key);
 * // Store result.encrypted, result.iv, result.authTag
 * ```
 */
export function encrypt(
  data: string | Buffer,
  key: string | Buffer,
  options: EncryptionOptions = {}
): EncryptionResult {
  const { algorithm = 'aes-256-gcm', encoding = 'hex' } = options;

  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
  if (keyBuffer.length !== 32) {
    throw new Error('Key must be 32 bytes for AES-256');
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, keyBuffer, iv);

  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);

  const result: EncryptionResult = {
    encrypted: encrypted.toString(encoding),
    iv: iv.toString(encoding)
  };

  if (algorithm === 'aes-256-gcm') {
    result.authTag = (cipher as any).getAuthTag().toString(encoding);
  }

  return result;
}

/**
 * Decrypt data using AES-256.
 *
 * @param encrypted - Encrypted data
 * @param key - Decryption key (must be 32 bytes for AES-256)
 * @param iv - Initialization vector
 * @param authTag - Authentication tag (required for GCM mode)
 * @param options - Decryption options
 * @returns Decrypted data as string
 *
 * @example
 * ```typescript
 * const decrypted = decrypt(
 *   result.encrypted,
 *   key,
 *   result.iv,
 *   result.authTag
 * );
 * ```
 */
export function decrypt(
  encrypted: string,
  key: string | Buffer,
  iv: string,
  authTag?: string,
  options: EncryptionOptions = {}
): string {
  const { algorithm = 'aes-256-gcm', encoding = 'hex' } = options;

  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
  if (keyBuffer.length !== 32) {
    throw new Error('Key must be 32 bytes for AES-256');
  }

  const ivBuffer = Buffer.from(iv, encoding);
  const decipher = createDecipheriv(algorithm, keyBuffer, ivBuffer);

  if (algorithm === 'aes-256-gcm' && authTag) {
    (decipher as any).setAuthTag(Buffer.from(authTag, encoding));
  }

  const encryptedBuffer = Buffer.from(encrypted, encoding);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate a random UUID v4.
 *
 * @returns UUID string
 *
 * @example
 * ```typescript
 * const id = uuid(); // 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6'
 * ```
 */
export function uuid(): string {
  const bytes = randomBytes(16);

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generate a nanoid-style short unique ID.
 *
 * @param length - Length of ID (default: 21)
 * @returns Short unique ID
 *
 * @example
 * ```typescript
 * const id = nanoid(); // 'V1StGXR8_Z5jdHi6B-myT'
 * const shortId = nanoid(12); // 'V1StGXR8_Z5j'
 * ```
 */
export function nanoid(length = 21): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = randomBytes(length);
  let id = '';

  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }

  return id;
}

/**
 * Rate limit key generator for IP-based rate limiting.
 *
 * @param ip - Client IP address
 * @param prefix - Optional prefix for the key
 * @returns Rate limit key
 *
 * @example
 * ```typescript
 * const key = rateLimitKey(req.ip(), 'api');
 * // Use key for rate limiting: 'api:192.168.1.1'
 * ```
 */
export function rateLimitKey(ip: string, prefix = 'ratelimit'): string {
  return `${prefix}:${ip}`;
}

/**
 * Sanitize a string to prevent XSS attacks.
 * Note: For HTML content, use a dedicated library like DOMPurify.
 *
 * @param value - String to sanitize
 * @returns Sanitized string
 *
 * @example
 * ```typescript
 * const safe = sanitizeXss('<script>alert("xss")</script>');
 * // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 */
export function sanitizeXss(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize a redirect URL to prevent open redirects.
 *
 * @param url - URL to validate
 * @param allowedDomains - List of allowed domains
 * @returns Sanitized URL or null if invalid
 *
 * @example
 * ```typescript
 * const safe = sanitizeRedirectUrl(
 *   req.queryParam('returnUrl'),
 *   ['example.com', 'app.example.com']
 * );
 * if (safe) {
 *   req.redirect(safe);
 * }
 * ```
 */
export function sanitizeRedirectUrl(
  url: string,
  allowedDomains: string[]
): string | null {
  try {
    // Allow relative URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }

    const parsed = new URL(url);

    // Check if domain is allowed
    if (allowedDomains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))) {
      return url;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a Content Security Policy (CSP) header value.
 *
 * @param policy - CSP policy configuration
 * @returns CSP header value
 *
 * @example
 * ```typescript
 * const csp = generateCSP({
 *   'default-src': ["'self'"],
 *   'script-src': ["'self'", "'unsafe-inline'"],
 *   'style-src': ["'self'", 'https://fonts.googleapis.com']
 * });
 * req.header('Content-Security-Policy', csp);
 * ```
 */
export function generateCSP(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Check if a password meets complexity requirements.
 *
 * @param password - Password to check
 * @param options - Password requirements
 * @returns Object with isValid flag and list of failed requirements
 *
 * @example
 * ```typescript
 * const result = checkPasswordStrength('Abc123!@#', {
 *   minLength: 8,
 *   requireUppercase: true,
 *   requireLowercase: true,
 *   requireNumbers: true,
 *   requireSpecialChars: true
 * });
 * if (!result.isValid) {
 *   console.log('Password fails:', result.failures);
 * }
 * ```
 */
export function checkPasswordStrength(
  password: string,
  options: {
    minLength?: number;
    maxLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  } = {}
): { isValid: boolean; failures: string[] } {
  const {
    minLength = 8,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = false
  } = options;

  const failures: string[] = [];

  if (password.length < minLength) {
    failures.push(`Must be at least ${minLength} characters`);
  }

  if (password.length > maxLength) {
    failures.push(`Must be at most ${maxLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    failures.push('Must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    failures.push('Must contain at least one lowercase letter');
  }

  if (requireNumbers && !/\d/.test(password)) {
    failures.push('Must contain at least one number');
  }

  if (requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    failures.push('Must contain at least one special character');
  }

  return {
    isValid: failures.length === 0,
    failures
  };
}
