/**
 * Logging utilities for the Peaque framework.
 *
 * Provides structured logging with color-coded output and log levels.
 *
 * @module utils/logger
 */

import colors from "yoctocolors";

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Minimum log level to display */
  level?: LogLevel;
  /** Prefix to prepend to all log messages */
  prefix?: string;
  /** Whether to include timestamps */
  timestamps?: boolean;
  /** Whether to enable colors (default: true) */
  colors?: boolean;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamps: boolean;
  private colorsEnabled: boolean;

  /**
   * Create a new logger instance
   * @param options - Logger configuration options
   */
  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? "";
    this.timestamps = options.timestamps ?? false;
    this.colorsEnabled = options.colors ?? true;
  }

  /**
   * Set the minimum log level
   * @param level - The new log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level
   * @returns The current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Format a log message with timestamp and prefix
   */
  private format(level: string, message: string, color?: (str: string) => string): string {
    const parts: string[] = [];

    if (this.timestamps) {
      const timestamp = new Date().toISOString();
      parts.push(this.colorsEnabled && colors.gray ? colors.gray(`[${timestamp}]`) : `[${timestamp}]`);
    }

    if (this.prefix) {
      parts.push(this.colorsEnabled && colors.cyan ? colors.cyan(`[${this.prefix}]`) : `[${this.prefix}]`);
    }

    const levelStr = this.colorsEnabled && color ? color(`[${level}]`) : `[${level}]`;
    parts.push(levelStr);
    parts.push(message);

    return parts.join(" ");
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.format("DEBUG", message, colors.gray), ...args);
    }
  }

  /**
   * Log an info message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.format("INFO", message, colors.blue), ...args);
    }
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.format("WARN", message, colors.yellow), ...args);
    }
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.format("ERROR", message, colors.red), ...args);
    }
  }

  /**
   * Log a success message (info level with green color)
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  success(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.format("SUCCESS", message, colors.green), ...args);
    }
  }

  /**
   * Create a child logger with a new prefix
   * @param prefix - The prefix for the child logger
   * @returns A new logger instance
   */
  child(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({
      level: this.level,
      prefix: childPrefix,
      timestamps: this.timestamps,
      colors: this.colorsEnabled,
    });
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
  timestamps: process.env.LOG_TIMESTAMPS === "true",
});

/**
 * Create a new logger instance
 * @param options - Logger configuration options
 * @returns A new logger instance
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}
