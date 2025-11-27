/**
 * Performance utilities for benchmarking and monitoring
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 100;

  /**
   * Measure execution time of a function
   */
  async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name} (error)`, duration);
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, duration: number): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (duration > 100) {
      console.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get average duration for a metric
   */
  getAverage(name: string): number {
    const matching = this.metrics.filter((m) => m.name === name);
    if (matching.length === 0) return 0;
    const sum = matching.reduce((acc, m) => acc + m.duration, 0);
    return sum / matching.length;
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get performance report
   */
  getReport(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = {
          count: 0,
          total: 0,
          min: Infinity,
          max: -Infinity,
        };
      }
      acc[metric.name].count++;
      acc[metric.name].total += metric.duration;
      acc[metric.name].min = Math.min(acc[metric.name].min, metric.duration);
      acc[metric.name].max = Math.max(acc[metric.name].max, metric.duration);
      return acc;
    }, {} as Record<string, { count: number; total: number; min: number; max: number }>);

    return Object.entries(grouped).reduce((acc, [name, stats]) => {
      acc[name] = {
        count: stats.count,
        avg: stats.total / stats.count,
        min: stats.min,
        max: stats.max,
      };
      return acc;
    }, {} as Record<string, { count: number; avg: number; min: number; max: number }>);
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Benchmark cart operations
 */
export async function benchmarkCartOperation<T>(
  operation: string,
  fn: () => Promise<T> | T
): Promise<T> {
  return performanceMonitor.measure(`cart:${operation}`, fn);
}

/**
 * Check if operation meets performance target
 */
export function checkPerformanceTarget(metricName: string, targetMs: number = 100): boolean {
  const avg = performanceMonitor.getAverage(metricName);
  return avg <= targetMs;
}

/**
 * Get performance report (for debugging)
 */
export function getPerformanceReport() {
  return performanceMonitor.getReport();
}


