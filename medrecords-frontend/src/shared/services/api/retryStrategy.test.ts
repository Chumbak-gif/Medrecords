/**
 * Unit tests for the retry strategy with exponential backoff.
 *
 * Tests cover:
 * - isRetryableError: correctly identifies retryable vs non-retryable errors
 * - calculateBackoffDelay: exponential growth capped by maxDelay
 * - executeWithRetry: retries transient failures, propagates non-retryable errors immediately
 * - classifyForRetry: lightweight error classification for retry decisions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCategory } from '@/shared/types';
import type { AppError } from '@/shared/types';
import {
  isRetryableError,
  calculateBackoffDelay,
  executeWithRetry,
  classifyForRetry,
  sleep,
  DEFAULT_RETRY_CONFIG,
} from './retryStrategy';
import type { RetryConfig } from './retryStrategy';

describe('isRetryableError', () => {
  it('returns true for NETWORK errors', () => {
    const error: AppError = {
      category: ErrorCategory.NETWORK,
      message: 'Network error',
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(true);
  });

  it('returns true for TIMEOUT errors', () => {
    const error: AppError = {
      category: ErrorCategory.TIMEOUT,
      message: 'Timeout',
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(true);
  });

  it('returns true for SERVER errors with 5xx status', () => {
    const error: AppError = {
      category: ErrorCategory.SERVER,
      message: 'Internal Server Error',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(true);
  });

  it('returns true for SERVER errors with 503 status', () => {
    const error: AppError = {
      category: ErrorCategory.SERVER,
      message: 'Service Unavailable',
      statusCode: 503,
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(true);
  });

  it('returns false for VALIDATION errors (4xx)', () => {
    const error: AppError = {
      category: ErrorCategory.VALIDATION,
      message: 'Validation failed',
      statusCode: 422,
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(false);
  });

  it('returns false for AUTHENTICATION errors', () => {
    const error: AppError = {
      category: ErrorCategory.AUTHENTICATION,
      message: 'Unauthorized',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(false);
  });

  it('returns false for AUTHORIZATION errors', () => {
    const error: AppError = {
      category: ErrorCategory.AUTHORIZATION,
      message: 'Forbidden',
      statusCode: 403,
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(false);
  });

  it('returns false for NOT_FOUND errors', () => {
    const error: AppError = {
      category: ErrorCategory.NOT_FOUND,
      message: 'Not Found',
      statusCode: 404,
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(false);
  });

  it('returns false for UNKNOWN errors', () => {
    const error: AppError = {
      category: ErrorCategory.UNKNOWN,
      message: 'Unknown error',
      timestamp: new Date().toISOString(),
    };
    expect(isRetryableError(error)).toBe(false);
  });
});

describe('calculateBackoffDelay', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter = 500ms
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const config: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  };

  it('returns baseDelay * 2^0 + jitter for attempt 0', () => {
    const delay = calculateBackoffDelay(0, config);
    // 1000 * 2^0 + 500 = 1500
    expect(delay).toBe(1500);
  });

  it('returns baseDelay * 2^1 + jitter for attempt 1', () => {
    const delay = calculateBackoffDelay(1, config);
    // 1000 * 2^1 + 500 = 2500
    expect(delay).toBe(2500);
  });

  it('returns baseDelay * 2^2 + jitter for attempt 2', () => {
    const delay = calculateBackoffDelay(2, config);
    // 1000 * 2^2 + 500 = 4500
    expect(delay).toBe(4500);
  });

  it('caps delay at maxDelay', () => {
    const smallMaxConfig: RetryConfig = {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 3000,
    };
    const delay = calculateBackoffDelay(3, smallMaxConfig);
    // 1000 * 2^3 + 500 = 8500, but capped at 3000
    expect(delay).toBe(3000);
  });
});

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fastConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 10,
    maxDelay: 100,
  };

  it('returns result on first success without retry', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const promise = executeWithRetry(fn, fastConfig);
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error and succeeds on second attempt', async () => {
    const networkError = {
      isAxiosError: true,
      message: 'Network Error',
      code: 'ERR_NETWORK',
      config: {},
    };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce('recovered');

    // Use real timers for simple async test
    vi.useRealTimers();
    const result = await executeWithRetry(fn, fastConfig);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 server error', async () => {
    const serverError = {
      isAxiosError: true,
      message: 'Internal Server Error',
      code: 'ERR_BAD_RESPONSE',
      config: {},
      response: { status: 500, data: {} },
    };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce('recovered');

    vi.useRealTimers();
    const result = await executeWithRetry(fn, fastConfig);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all attempts on persistent failure', async () => {
    const networkError = {
      isAxiosError: true,
      message: 'Network Error',
      code: 'ERR_NETWORK',
      config: {},
    };
    const fn = vi.fn().mockRejectedValue(networkError);

    vi.useRealTimers();
    await expect(executeWithRetry(fn, fastConfig)).rejects.toMatchObject({
      message: 'Network Error',
    });

    expect(fn).toHaveBeenCalledTimes(3); // maxAttempts = 3
  });

  it('immediately propagates 400 validation error without retry', async () => {
    const validationError = {
      isAxiosError: true,
      message: 'Bad Request',
      code: 'ERR_BAD_REQUEST',
      config: {},
      response: { status: 400, data: { detail: 'Invalid data' } },
    };
    const fn = vi.fn().mockRejectedValue(validationError);

    vi.useRealTimers();
    await expect(executeWithRetry(fn, fastConfig)).rejects.toMatchObject({
      message: 'Bad Request',
    });

    expect(fn).toHaveBeenCalledTimes(1); // No retry
  });

  it('immediately propagates 422 validation error without retry', async () => {
    const validationError = {
      isAxiosError: true,
      message: 'Unprocessable Entity',
      code: 'ERR_BAD_REQUEST',
      config: {},
      response: { status: 422, data: {} },
    };
    const fn = vi.fn().mockRejectedValue(validationError);

    vi.useRealTimers();
    await expect(executeWithRetry(fn, fastConfig)).rejects.toMatchObject({
      message: 'Unprocessable Entity',
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('immediately propagates 403 authorization error without retry', async () => {
    const authzError = {
      isAxiosError: true,
      message: 'Forbidden',
      code: 'ERR_BAD_REQUEST',
      config: {},
      response: { status: 403, data: {} },
    };
    const fn = vi.fn().mockRejectedValue(authzError);

    vi.useRealTimers();
    await expect(executeWithRetry(fn, fastConfig)).rejects.toMatchObject({
      message: 'Forbidden',
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('immediately propagates 404 not found error without retry', async () => {
    const notFoundError = {
      isAxiosError: true,
      message: 'Not Found',
      code: 'ERR_BAD_REQUEST',
      config: {},
      response: { status: 404, data: {} },
    };
    const fn = vi.fn().mockRejectedValue(notFoundError);

    vi.useRealTimers();
    await expect(executeWithRetry(fn, fastConfig)).rejects.toMatchObject({
      message: 'Not Found',
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on timeout error', async () => {
    const timeoutError = {
      isAxiosError: true,
      message: 'timeout of 30000ms exceeded',
      code: 'ECONNABORTED',
      config: {},
    };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce('recovered');

    vi.useRealTimers();
    const result = await executeWithRetry(fn, fastConfig);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses default config when no config is provided', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    vi.useRealTimers();
    const result = await executeWithRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('classifyForRetry', () => {
  it('classifies axios network error (no response)', () => {
    const error = {
      isAxiosError: true,
      message: 'Network Error',
      code: 'ERR_NETWORK',
      config: {},
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.NETWORK);
  });

  it('classifies axios timeout error', () => {
    const error = {
      isAxiosError: true,
      message: 'timeout of 30000ms exceeded',
      code: 'ECONNABORTED',
      config: {},
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.TIMEOUT);
  });

  it('classifies 500 as SERVER', () => {
    const error = {
      isAxiosError: true,
      message: 'Internal Server Error',
      config: {},
      response: { status: 500, data: {} },
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.SERVER);
    expect(classified.statusCode).toBe(500);
  });

  it('classifies 401 as AUTHENTICATION', () => {
    const error = {
      isAxiosError: true,
      message: 'Unauthorized',
      config: {},
      response: { status: 401, data: {} },
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.AUTHENTICATION);
  });

  it('classifies 403 as AUTHORIZATION', () => {
    const error = {
      isAxiosError: true,
      message: 'Forbidden',
      config: {},
      response: { status: 403, data: {} },
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.AUTHORIZATION);
  });

  it('classifies 404 as NOT_FOUND', () => {
    const error = {
      isAxiosError: true,
      message: 'Not Found',
      config: {},
      response: { status: 404, data: {} },
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.NOT_FOUND);
  });

  it('classifies 400 as VALIDATION', () => {
    const error = {
      isAxiosError: true,
      message: 'Bad Request',
      config: {},
      response: { status: 400, data: {} },
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.VALIDATION);
  });

  it('classifies 422 as VALIDATION', () => {
    const error = {
      isAxiosError: true,
      message: 'Unprocessable Entity',
      config: {},
      response: { status: 422, data: {} },
    };
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.VALIDATION);
  });

  it('classifies generic Error with "timeout" in message as TIMEOUT', () => {
    const error = new Error('Request timeout occurred');
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.TIMEOUT);
  });

  it('classifies generic Error with "network" in message as NETWORK', () => {
    const error = new Error('Network connection failed');
    const classified = classifyForRetry(error);
    expect(classified.category).toBe(ErrorCategory.NETWORK);
  });

  it('classifies unknown/non-Error values as UNKNOWN', () => {
    const classified = classifyForRetry('string error');
    expect(classified.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('classifies null as UNKNOWN', () => {
    const classified = classifyForRetry(null);
    expect(classified.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('classifies undefined as UNKNOWN', () => {
    const classified = classifyForRetry(undefined);
    expect(classified.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('always includes a timestamp in ISO 8601 format', () => {
    const classified = classifyForRetry(new Error('test'));
    expect(classified.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('always includes a non-empty message', () => {
    const classified = classifyForRetry(new Error('test error'));
    expect(classified.message).toBeTruthy();
    expect(classified.message.length).toBeGreaterThan(0);
  });
});
