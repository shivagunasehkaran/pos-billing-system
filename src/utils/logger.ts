/**
 * Simple logger utility
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private log(level: LogLevel, ...args: any[]): void {
    if (!this.isDevelopment && level === 'debug') {
      return;
    }
    console[level](`[${level.toUpperCase()}]`, ...args);
  }

  debug(...args: any[]): void {
    this.log('debug', ...args);
  }

  info(...args: any[]): void {
    this.log('info', ...args);
  }

  warn(...args: any[]): void {
    this.log('warn', ...args);
  }

  error(...args: any[]): void {
    this.log('error', ...args);
  }
}

export const logger = new Logger();

