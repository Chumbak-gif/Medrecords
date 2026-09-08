/**
 * Structured JSON logger.
 *
 * Emits structured JSON logs with:
 * - level: one of debug, info, warn, error
 * - message: human-readable log message
 * - timestamp: ISO 8601 format
 * - correlationId: trace correlation ID
 * - userId: current user's ID
 * - feature: originating feature module name
 *
 * In production: exports to collector endpoint (via custom event for telemetry system)
 * In development: outputs to browser console
 *
 * Requirements: 6.3, 6.8
 */

import { LogLevel, shouldLog } from './logLevels';
import type { LogContext } from '@/shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StructuredLogEntry {
  level: string;
  message: string;
  timestamp: string;
  correlationId?: string;
  userId?: number;
  feature?: string;
  [key: string]: unknown;
}

export interface LoggerConfig {
  /** Minimum log level to emit */
  minLevel?: LogLevel;
  /** Service name for log entries */
  serviceName?: string;
  /** Default feature context */
  defaultFeature?: string;
}

// ---------------------------------------------------------------------------
// Logger buffer for production export
// ---------------------------------------------------------------------------

const logBuffer: StructuredLogEntry[] = [];
const MAX_BUFFER_SIZE = 500;
const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_BATCH_SIZE = 50;

let flushTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

function isProduction(): boolean {
  return import.meta.env.VITE_ENV === 'production';
}

// ---------------------------------------------------------------------------
// Log entry creation
// ---------------------------------------------------------------------------

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (context?.correlationId) {
    entry.correlationId = context.correlationId;
  }
  if (context?.userId) {
    entry.userId = context.userId;
  }
  if (context?.feature) {
    entry.feature = context.feature;
  }

  // Spread any additional context properties
  if (context) {
    const { correlationId, userId, feature, action, ...rest } = context;
    if (action) {
      entry.action = action;
    }
    for (const [key, value] of Object.entries(rest)) {
      entry[key] = value;
    }
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Output: console (development)
// ---------------------------------------------------------------------------

function outputToConsole(entry: StructuredLogEntry): void {
  const { level, message, ...meta } = entry;
  const metaStr = Object.keys(meta).length > 0 ? meta : undefined;

  switch (level) {
    case LogLevel.ERROR:
      metaStr ? console.error(`[${level.toUpperCase()}] ${message}`, metaStr) : console.error(`[${level.toUpperCase()}] ${message}`);
      break;
    case LogLevel.WARN:
      metaStr ? console.warn(`[${level.toUpperCase()}] ${message}`, metaStr) : console.warn(`[${level.toUpperCase()}] ${message}`);
      break;
    case LogLevel.INFO:
      metaStr ? console.info(`[${level.toUpperCase()}] ${message}`, metaStr) : console.info(`[${level.toUpperCase()}] ${message}`);
      break;
    case LogLevel.DEBUG:
    default:
      metaStr ? console.debug(`[${level.toUpperCase()}] ${message}`, metaStr) : console.debug(`[${level.toUpperCase()}] ${message}`);
      break;
  }
}

// ---------------------------------------------------------------------------
// Output: buffer for production export
// ---------------------------------------------------------------------------

function bufferForExport(entry: StructuredLogEntry): void {
  logBuffer.push(entry);

  // Flush if batch size reached
  if (logBuffer.length >= FLUSH_BATCH_SIZE) {
    flushLogBuffer();
  }

  // Discard oldest entries if buffer exceeds max
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.splice(0, logBuffer.length - MAX_BUFFER_SIZE);
  }
}

/**
 * Flush the log buffer by emitting a custom event for the telemetry
 * system to pick up and export to the collector endpoint.
 */
function flushLogBuffer(): void {
  if (logBuffer.length === 0) return;

  const entries = logBuffer.splice(0, logBuffer.length);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('log-export', { detail: { entries } }),
    );
  }
}

// ---------------------------------------------------------------------------
// Start/stop periodic flush (production only)
// ---------------------------------------------------------------------------

function startPeriodicFlush(): void {
  if (flushTimer) return;
  flushTimer = setInterval(flushLogBuffer, FLUSH_INTERVAL_MS);
}

function stopPeriodicFlush(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry = createLogEntry(level, message, context);

  if (isProduction()) {
    bufferForExport(entry);
  } else {
    outputToConsole(entry);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const logger = {
  debug(message: string, context?: LogContext): void {
    emit(LogLevel.DEBUG, message, context);
  },

  info(message: string, context?: LogContext): void {
    emit(LogLevel.INFO, message, context);
  },

  warn(message: string, context?: LogContext): void {
    emit(LogLevel.WARN, message, context);
  },

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
      }),
    };
    emit(LogLevel.ERROR, message, errorContext);
  },

  /**
   * Initialize the logger (start periodic flush in production).
   */
  init(): void {
    if (isProduction()) {
      startPeriodicFlush();
    }
  },

  /**
   * Shutdown the logger (flush remaining entries, stop timer).
   */
  shutdown(): void {
    flushLogBuffer();
    stopPeriodicFlush();
  },

  /**
   * Force flush any buffered log entries.
   */
  flush(): void {
    flushLogBuffer();
  },
};

export default logger;
