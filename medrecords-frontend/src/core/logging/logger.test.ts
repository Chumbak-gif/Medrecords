/**
 * Tests for the structured logger.
 *
 * Requirements: 6.3, 6.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock import.meta.env before importing the logger
vi.stubEnv('VITE_ENV', 'development');

import { logger } from './logger';
import { LogLevel, shouldLog, LOG_LEVEL_PRIORITY, getMinLogLevel } from './logLevels';

describe('logLevels', () => {
  it('defines correct priority order (lower = more severe)', () => {
    expect(LOG_LEVEL_PRIORITY[LogLevel.ERROR]).toBeLessThan(LOG_LEVEL_PRIORITY[LogLevel.WARN]);
    expect(LOG_LEVEL_PRIORITY[LogLevel.WARN]).toBeLessThan(LOG_LEVEL_PRIORITY[LogLevel.INFO]);
    expect(LOG_LEVEL_PRIORITY[LogLevel.INFO]).toBeLessThan(LOG_LEVEL_PRIORITY[LogLevel.DEBUG]);
  });

  it('shouldLog returns true when level is at or above minimum', () => {
    expect(shouldLog(LogLevel.ERROR, LogLevel.WARN)).toBe(true);
    expect(shouldLog(LogLevel.WARN, LogLevel.WARN)).toBe(true);
    expect(shouldLog(LogLevel.INFO, LogLevel.WARN)).toBe(false);
    expect(shouldLog(LogLevel.DEBUG, LogLevel.WARN)).toBe(false);
  });

  it('shouldLog allows all levels when minimum is DEBUG', () => {
    expect(shouldLog(LogLevel.ERROR, LogLevel.DEBUG)).toBe(true);
    expect(shouldLog(LogLevel.WARN, LogLevel.DEBUG)).toBe(true);
    expect(shouldLog(LogLevel.INFO, LogLevel.DEBUG)).toBe(true);
    expect(shouldLog(LogLevel.DEBUG, LogLevel.DEBUG)).toBe(true);
  });

  it('getMinLogLevel returns DEBUG in development', () => {
    expect(getMinLogLevel()).toBe(LogLevel.DEBUG);
  });
});

describe('logger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger.debug', () => {
    it('outputs to console.debug in development', () => {
      logger.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Debug message',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });

    it('includes context in output', () => {
      logger.debug('Test message', {
        correlationId: 'corr-123',
        userId: 42,
        feature: 'patients',
      });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Test message',
        expect.objectContaining({
          correlationId: 'corr-123',
          userId: 42,
          feature: 'patients',
        }),
      );
    });
  });

  describe('logger.info', () => {
    it('outputs to console.info in development', () => {
      logger.info('Info message');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Info message',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });
  });

  describe('logger.warn', () => {
    it('outputs to console.warn in development', () => {
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] Warning message',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });
  });

  describe('logger.error', () => {
    it('outputs to console.error in development', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Error message',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });

    it('includes error details in context', () => {
      const error = new Error('Test error');
      logger.error('Something failed', error, { feature: 'auth' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Something failed',
        expect.objectContaining({
          feature: 'auth',
          errorName: 'Error',
          errorMessage: 'Test error',
          stack: expect.any(String),
        }),
      );
    });
  });

  describe('structured log entry format', () => {
    it('includes ISO 8601 timestamp', () => {
      logger.info('Timestamp test');

      const callArgs = consoleInfoSpy.mock.calls[0];
      const meta = callArgs[1] as Record<string, unknown>;
      const timestamp = meta.timestamp as string;

      // Verify ISO 8601 format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('includes correlationId when provided', () => {
      logger.info('Correlation test', { correlationId: 'abc-def-123' });

      const callArgs = consoleInfoSpy.mock.calls[0];
      const meta = callArgs[1] as Record<string, unknown>;
      expect(meta.correlationId).toBe('abc-def-123');
    });

    it('includes userId when provided', () => {
      logger.info('User test', { userId: 7 });

      const callArgs = consoleInfoSpy.mock.calls[0];
      const meta = callArgs[1] as Record<string, unknown>;
      expect(meta.userId).toBe(7);
    });

    it('includes feature when provided', () => {
      logger.info('Feature test', { feature: 'assessments' });

      const callArgs = consoleInfoSpy.mock.calls[0];
      const meta = callArgs[1] as Record<string, unknown>;
      expect(meta.feature).toBe('assessments');
    });
  });
});
