/**
 * Log level definitions for the structured logger.
 *
 * Defines the severity levels and their numeric priority for filtering.
 * Lower numbers = higher severity.
 *
 * Requirements: 6.3
 */

// ---------------------------------------------------------------------------
// Log Level Enum
// ---------------------------------------------------------------------------

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// ---------------------------------------------------------------------------
// Numeric priority (lower = more severe)
// ---------------------------------------------------------------------------

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
};

// ---------------------------------------------------------------------------
// Minimum log level configuration
// ---------------------------------------------------------------------------

/**
 * Get the minimum log level for the current environment.
 * - Production: WARN (only warn and error)
 * - Development: DEBUG (all levels)
 */
export function getMinLogLevel(): LogLevel {
  const env = import.meta.env.VITE_ENV ?? 'development';
  if (env === 'production') {
    return LogLevel.WARN;
  }
  return LogLevel.DEBUG;
}

/**
 * Check if a given log level should be emitted based on the minimum level.
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel = getMinLogLevel()): boolean {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[minLevel];
}
