/**
 * Performance monitoring and profiling utilities.
 *
 * This module provides tools for measuring and tracking performance metrics
 * in your application.
 *
 * @module utils/performance
 */

/**
 * Performance metrics for a timed operation
 */
export interface PerformanceMetrics {
  /** Operation name */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Start time (timestamp) */
  startTime: number;
  /** End time (timestamp) */
  endTime: number;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Performance tracker for collecting metrics
 */
class PerformanceTracker {
  private metrics: PerformanceMetrics[] = [];
  private listeners: Array<(metric: PerformanceMetrics) => void> = [];

  /**
   * Record a performance metric
   */
  record(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    this.listeners.forEach(listener => listener(metric));
  }

  /**
   * Subscribe to performance metrics
   */
  subscribe(listener: (metric: PerformanceMetrics) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.name === name);
  }

  /**
   * Get average duration for a named operation
   */
  getAverageDuration(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

/**
 * Global performance tracker instance
 */
export const performanceTracker = new PerformanceTracker();

/**
 * Time an async function and record the duration
 *
 * @param name - Name of the operation
 * @param fn - Async function to time
 * @param metadata - Optional metadata to attach
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await time('fetchUser', async () => {
 *   return await api.getUser(id);
 * });
 * ```
 */
export async function time<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const endTime = Date.now();

    performanceTracker.record({
      name,
      duration: endTime - startTime,
      startTime,
      endTime,
      metadata
    });

    return result;
  } catch (error) {
    const endTime = Date.now();

    performanceTracker.record({
      name,
      duration: endTime - startTime,
      startTime,
      endTime,
      metadata: {
        ...metadata,
        error: error instanceof Error ? error.message : String(error)
      }
    });

    throw error;
  }
}

/**
 * Create a timer that can be stopped manually
 *
 * @param name - Name of the operation
 * @param metadata - Optional metadata
 * @returns Timer object with stop method
 *
 * @example
 * ```typescript
 * const timer = startTimer('processData');
 * // ... do work ...
 * timer.stop();
 * ```
 */
export function startTimer(
  name: string,
  metadata?: Record<string, any>
): {
  stop: () => number;
  getElapsed: () => number;
} {
  const startTime = Date.now();

  return {
    stop: () => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceTracker.record({
        name,
        duration,
        startTime,
        endTime,
        metadata
      });

      return duration;
    },
    getElapsed: () => {
      return Date.now() - startTime;
    }
  };
}

/**
 * Measure function execution time (decorator-style)
 *
 * @param name - Name of the operation
 * @returns Decorator function
 *
 * @example
 * ```typescript
 * const fetchUser = measure('fetchUser')(async (id: string) => {
 *   return await api.getUser(id);
 * });
 * ```
 */
export function measure<T extends (...args: any[]) => Promise<any>>(
  name: string
): (fn: T) => T {
  return (fn: T): T => {
    return (async (...args: any[]) => {
      return await time(name, () => fn(...args));
    }) as T;
  };
}

/**
 * Performance profiler for tracking multiple metrics
 */
export class Profiler {
  private timers: Map<string, number> = new Map();
  private metrics: PerformanceMetrics[] = [];

  /**
   * Start profiling an operation
   */
  start(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * Stop profiling an operation
   */
  stop(name: string, metadata?: Record<string, any>): number | null {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`No timer found for: ${name}`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.metrics.push({
      name,
      duration,
      startTime,
      endTime,
      metadata
    });

    this.timers.delete(name);
    return duration;
  }

  /**
   * Get profiling results
   */
  getResults(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get summary statistics
   */
  getSummary(): Record<string, {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  }> {
    const summary: Record<string, {
      count: number;
      total: number;
      average: number;
      min: number;
      max: number;
    }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          total: 0,
          average: 0,
          min: Infinity,
          max: -Infinity
        };
      }

      const s = summary[metric.name];
      s.count++;
      s.total += metric.duration;
      s.min = Math.min(s.min, metric.duration);
      s.max = Math.max(s.max, metric.duration);
      s.average = s.total / s.count;
    }

    return summary;
  }

  /**
   * Clear profiler data
   */
  clear(): void {
    this.timers.clear();
    this.metrics = [];
  }
}

/**
 * Check if code is running in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Log performance metrics (only in development)
 *
 * @param name - Metric name
 * @param duration - Duration in ms
 */
export function logPerformance(name: string, duration: number): void {
  if (!isProduction()) {
    console.log(`⏱️  ${name}: ${duration.toFixed(2)}ms`);
  }
}

/**
 * Warn about slow operations (only in development)
 *
 * @param name - Operation name
 * @param duration - Duration in ms
 * @param threshold - Threshold in ms (default: 1000)
 */
export function warnSlowOperation(name: string, duration: number, threshold = 1000): void {
  if (!isProduction() && duration > threshold) {
    console.warn(`⚠️  Slow operation detected: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
  }
}
