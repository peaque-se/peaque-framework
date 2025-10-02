/**
 * Configuration management utilities.
 *
 * This module provides utilities for loading, merging, and validating
 * application configuration from multiple sources (files, environment, defaults).
 *
 * @module utils/config
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { parseJSON } from './data.js';

/**
 * Configuration schema for validation.
 */
export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    validate?: (value: any) => boolean;
    transform?: (value: any) => any;
  };
}

/**
 * Configuration loader options.
 */
export interface ConfigLoaderOptions {
  /** Base directory for config files */
  basePath?: string;
  /** Environment name (development, production, etc.) */
  environment?: string;
  /** Whether to load environment variables */
  loadEnv?: boolean;
  /** Environment variable prefix (e.g., 'APP_') */
  envPrefix?: string;
  /** Configuration schema for validation */
  schema?: ConfigSchema;
  /** Whether to throw on validation errors */
  strict?: boolean;
}

/**
 * Configuration manager class.
 *
 * @example
 * ```typescript
 * const config = new ConfigManager({
 *   basePath: './config',
 *   environment: 'production'
 * });
 *
 * await config.load();
 * const dbHost = config.get('database.host');
 * ```
 */
export class ConfigManager {
  private config: Record<string, any> = {};
  private options: Required<ConfigLoaderOptions>;

  constructor(options: ConfigLoaderOptions = {}) {
    this.options = {
      basePath: options.basePath || process.cwd(),
      environment: options.environment || process.env.NODE_ENV || 'development',
      loadEnv: options.loadEnv ?? true,
      envPrefix: options.envPrefix || '',
      schema: options.schema || {},
      strict: options.strict ?? false
    };
  }

  /**
   * Load configuration from all sources.
   *
   * Priority (lowest to highest):
   * 1. Default values from schema
   * 2. config/default.json
   * 3. config/{environment}.json
   * 4. config/local.json (not committed to git)
   * 5. Environment variables
   */
  async load(): Promise<void> {
    // Load defaults from schema
    this.loadSchemaDefaults();

    // Load config files
    this.loadConfigFile('default.json');
    this.loadConfigFile(`${this.options.environment}.json`);
    this.loadConfigFile('local.json');

    // Load environment variables
    if (this.options.loadEnv) {
      this.loadEnvironmentVariables();
    }

    // Validate configuration
    if (Object.keys(this.options.schema).length > 0) {
      this.validate();
    }
  }

  /**
   * Get a configuration value by path.
   *
   * @param path - Dot-separated path (e.g., 'database.host')
   * @param defaultValue - Default value if not found
   * @returns Configuration value
   */
  get<T = any>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue as T;
      }
    }

    return value;
  }

  /**
   * Set a configuration value by path.
   *
   * @param path - Dot-separated path
   * @param value - Value to set
   */
  set(path: string, value: any): void {
    const keys = path.split('.');
    let current: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Check if a configuration key exists.
   *
   * @param path - Dot-separated path
   * @returns True if key exists
   */
  has(path: string): boolean {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all configuration as an object.
   *
   * @returns Configuration object
   */
  getAll(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * Merge additional configuration.
   *
   * @param config - Configuration object to merge
   */
  merge(config: Record<string, any>): void {
    this.config = this.deepMerge(this.config, config);
  }

  /**
   * Load defaults from schema.
   */
  private loadSchemaDefaults(): void {
    for (const [key, schema] of Object.entries(this.options.schema)) {
      if (schema.default !== undefined) {
        this.set(key, schema.default);
      }
    }
  }

  /**
   * Load configuration from a JSON file.
   */
  private loadConfigFile(filename: string): void {
    const filePath = resolve(this.options.basePath, filename);

    if (!existsSync(filePath)) {
      return;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const config = parseJSON(content, {});
      this.merge(config);
    } catch (error) {
      if (this.options.strict) {
        throw new Error(`Failed to load config file ${filename}: ${error}`);
      }
    }
  }

  /**
   * Load configuration from environment variables.
   */
  private loadEnvironmentVariables(): void {
    const prefix = this.options.envPrefix;

    for (const [key, value] of Object.entries(process.env)) {
      if (prefix && !key.startsWith(prefix)) {
        continue;
      }

      const configKey = prefix
        ? key.slice(prefix.length).toLowerCase().replace(/_/g, '.')
        : key.toLowerCase().replace(/_/g, '.');

      // Try to parse as JSON, fallback to string
      const parsedValue = this.parseEnvValue(value || '');
      this.set(configKey, parsedValue);
    }
  }

  /**
   * Parse environment variable value.
   */
  private parseEnvValue(value: string): any {
    // Try boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Try number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }

    // Try JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      const parsed = parseJSON(value, null);
      if (parsed !== null) {
        return parsed;
      }
    }

    return value;
  }

  /**
   * Validate configuration against schema.
   */
  private validate(): void {
    const errors: string[] = [];

    for (const [path, schema] of Object.entries(this.options.schema)) {
      const value = this.get(path);

      // Check required
      if (schema.required && value === undefined) {
        errors.push(`Missing required configuration: ${path}`);
        continue;
      }

      if (value === undefined) {
        continue;
      }

      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        errors.push(
          `Invalid type for ${path}: expected ${schema.type}, got ${actualType}`
        );
        continue;
      }

      // Custom validation
      if (schema.validate && !schema.validate(value)) {
        errors.push(`Validation failed for ${path}`);
        continue;
      }

      // Transform value
      if (schema.transform) {
        this.set(path, schema.transform(value));
      }
    }

    if (errors.length > 0) {
      const message = `Configuration validation failed:\n${errors.join('\n')}`;
      if (this.options.strict) {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }

  /**
   * Deep merge two objects.
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}

/**
 * Create and load a configuration manager.
 *
 * @param options - Configuration loader options
 * @returns Loaded configuration manager
 *
 * @example
 * ```typescript
 * const config = await loadConfig({
 *   basePath: './config',
 *   schema: {
 *     'port': { type: 'number', default: 3000 },
 *     'database.host': { type: 'string', required: true }
 *   }
 * });
 *
 * const port = config.get('port');
 * ```
 */
export async function loadConfig(
  options?: ConfigLoaderOptions
): Promise<ConfigManager> {
  const config = new ConfigManager(options);
  await config.load();
  return config;
}

/**
 * Load configuration from a specific file.
 *
 * @param filePath - Path to configuration file
 * @param format - File format (json, json5)
 * @returns Parsed configuration
 *
 * @example
 * ```typescript
 * const config = loadConfigFile('./config.json');
 * ```
 */
export function loadConfigFile(
  filePath: string,
  format: 'json' = 'json'
): Record<string, any> {
  if (!existsSync(filePath)) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');

  if (format === 'json') {
    const config = parseJSON(content, null);
    if (config === null) {
      throw new Error(`Invalid JSON in configuration file: ${filePath}`);
    }
    return config;
  }

  throw new Error(`Unsupported configuration format: ${format}`);
}

/**
 * Merge multiple configuration objects.
 *
 * @param configs - Array of configuration objects
 * @returns Merged configuration
 *
 * @example
 * ```typescript
 * const config = mergeConfigs(defaults, envConfig, localConfig);
 * ```
 */
export function mergeConfigs(...configs: Record<string, any>[]): Record<string, any> {
  let result = {};

  for (const config of configs) {
    result = deepMerge(result, config);
  }

  return result;
}

/**
 * Deep merge helper.
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Validate configuration against schema.
 *
 * @param config - Configuration object
 * @param schema - Configuration schema
 * @returns Validation result with errors
 *
 * @example
 * ```typescript
 * const result = validateConfig(config, schema);
 * if (!result.valid) {
 *   console.error('Config errors:', result.errors);
 * }
 * ```
 */
export function validateConfig(
  config: Record<string, any>,
  schema: ConfigSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [path, fieldSchema] of Object.entries(schema)) {
    const value = getValueByPath(config, path);

    // Check required
    if (fieldSchema.required && value === undefined) {
      errors.push(`Missing required field: ${path}`);
      continue;
    }

    if (value === undefined) {
      continue;
    }

    // Check type
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== fieldSchema.type) {
      errors.push(
        `Invalid type for ${path}: expected ${fieldSchema.type}, got ${actualType}`
      );
      continue;
    }

    // Custom validation
    if (fieldSchema.validate && !fieldSchema.validate(value)) {
      errors.push(`Validation failed for ${path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get value from object by dot-separated path.
 */
function getValueByPath(obj: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let value: any = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Create configuration schema helper.
 *
 * @example
 * ```typescript
 * const schema = createSchema({
 *   port: { type: 'number', default: 3000, validate: (v) => v > 0 && v < 65536 },
 *   'database.host': { type: 'string', required: true },
 *   'database.port': { type: 'number', default: 5432 }
 * });
 * ```
 */
export function createSchema(schema: ConfigSchema): ConfigSchema {
  return schema;
}
