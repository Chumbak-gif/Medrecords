/**
 * Unit tests for the error classifier.
 *
 * Tests classify() and isRetryable() across all error categories
 * and input types (null, undefined, Error, AxiosError, arbitrary values).
 */

import { describe, it, expect } from 'vitest';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { ErrorCategory } from '@/shared/types';
import { classify, isRetryable } from './errorClassifier';

// ---------------------------------------------------------------------------
// Helpers to create mock AxiosErrors
// ---------------------------------------------------------------------------

function createAxiosError(options: {
  status?: number;
  code?: string;
  message?: string;
  responseData?: unknown;
  hasResponse?: boolean;
}): AxiosError {
  const config = {
    url: '/test',
    headers: {},
  } as InternalAxiosRequestConfig;

  const response =
    options.hasResponse !== false && options.status != null
      ? ({
          status: options.status,
          statusText: 'Error',
          headers: {},
          config,
          data: options.responseData ?? {},
        } as AxiosResponse)
      : undefined;

  const error = new AxiosError(
    options.message ?? 'Request failed',
    options.code,
    config,
    {},
    response,
  );

  return error;
}

// ---------------------------------------------------------------------------
// classify() tests
// ---------------------------------------------------------------------------

describe('classify', () => {
  describe('null and undefined inputs', () => {
    it('classifies null as UNKNOWN', () => {
      const result = classify(null);
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBeTruthy();
      expect(result.timestamp).toBeTruthy();
    });

    it('classifies undefined as UNKNOWN', () => {
      const result = classify(undefined);
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBeTruthy();
      expect(result.timestamp).toBeTruthy();
    });
  });

  describe('standard Error objects', () => {
    it('classifies Error as UNKNOWN with its message', () => {
      const result = classify(new Error('Something went wrong'));
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBe('Something went wrong');
      expect(result.timestamp).toBeTruthy();
    });

    it('handles Error with empty message', () => {
      const result = classify(new Error(''));
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBeTruthy(); // fallback message
      expect(result.timestamp).toBeTruthy();
    });
  });

  describe('arbitrary values', () => {
    it('classifies string as UNKNOWN', () => {
      const result = classify('some error string');
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBe('some error string');
      expect(result.timestamp).toBeTruthy();
    });

    it('classifies number as UNKNOWN', () => {
      const result = classify(42);
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBeTruthy();
      expect(result.timestamp).toBeTruthy();
    });

    it('classifies empty object as UNKNOWN', () => {
      const result = classify({});
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBeTruthy();
      expect(result.timestamp).toBeTruthy();
    });
  });

  describe('AxiosError — timeout', () => {
    it('classifies ECONNABORTED as TIMEOUT', () => {
      const error = createAxiosError({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
        hasResponse: false,
      });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.TIMEOUT);
      expect(result.message).toContain('timeout');
    });

    it('classifies ERR_CANCELED with timeout message as TIMEOUT', () => {
      const error = createAxiosError({
        code: 'ERR_CANCELED',
        message: 'Request timeout aborted',
        hasResponse: false,
      });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.TIMEOUT);
    });
  });

  describe('AxiosError — no response (NETWORK)', () => {
    it('classifies AxiosError without response as NETWORK', () => {
      const error = createAxiosError({
        code: 'ERR_NETWORK',
        message: 'Network Error',
        hasResponse: false,
      });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.message).toContain('Network');
    });
  });

  describe('AxiosError — HTTP status codes', () => {
    it('classifies 401 as AUTHENTICATION', () => {
      const error = createAxiosError({ status: 401 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(result.statusCode).toBe(401);
    });

    it('classifies 403 as AUTHORIZATION', () => {
      const error = createAxiosError({ status: 403 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(result.statusCode).toBe(403);
    });

    it('classifies 400 as VALIDATION', () => {
      const error = createAxiosError({ status: 400 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.statusCode).toBe(400);
    });

    it('classifies 422 as VALIDATION', () => {
      const error = createAxiosError({
        status: 422,
        responseData: {
          detail: [{ loc: ['body', 'email'], msg: 'invalid email', type: 'value_error' }],
        },
      });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.statusCode).toBe(422);
      expect(result.context?.validationErrors).toBeDefined();
    });

    it('classifies 404 as NOT_FOUND', () => {
      const error = createAxiosError({ status: 404 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.NOT_FOUND);
      expect(result.statusCode).toBe(404);
    });

    it('classifies 500 as SERVER', () => {
      const error = createAxiosError({ status: 500 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.SERVER);
      expect(result.statusCode).toBe(500);
    });

    it('classifies 502 as SERVER', () => {
      const error = createAxiosError({ status: 502 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.SERVER);
      expect(result.statusCode).toBe(502);
    });

    it('classifies 503 as SERVER', () => {
      const error = createAxiosError({ status: 503 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.SERVER);
      expect(result.statusCode).toBe(503);
    });

    it('classifies unknown status (e.g. 418) as UNKNOWN', () => {
      const error = createAxiosError({ status: 418 });
      const result = classify(error);
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.statusCode).toBe(418);
    });
  });

  describe('message extraction', () => {
    it('extracts message from response data.message', () => {
      const error = createAxiosError({
        status: 400,
        responseData: { message: 'Invalid input' },
      });
      const result = classify(error);
      expect(result.message).toBe('Invalid input');
    });

    it('extracts message from response data.detail', () => {
      const error = createAxiosError({
        status: 403,
        responseData: { detail: 'Not allowed' },
      });
      const result = classify(error);
      expect(result.message).toBe('Not allowed');
    });

    it('extracts message from response data.error', () => {
      const error = createAxiosError({
        status: 500,
        responseData: { error: 'Server failure' },
      });
      const result = classify(error);
      expect(result.message).toBe('Server failure');
    });
  });

  describe('ISO 8601 timestamp', () => {
    it('always produces a valid ISO 8601 timestamp', () => {
      const result = classify(null);
      const date = new Date(result.timestamp);
      expect(date.toISOString()).toBe(result.timestamp);
      expect(Number.isNaN(date.getTime())).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isRetryable() tests
// ---------------------------------------------------------------------------

describe('isRetryable', () => {
  it('returns true for NETWORK errors', () => {
    const error = classify(
      createAxiosError({ code: 'ERR_NETWORK', message: 'Network Error', hasResponse: false }),
    );
    expect(isRetryable(error)).toBe(true);
  });

  it('returns true for TIMEOUT errors', () => {
    const error = classify(
      createAxiosError({ code: 'ECONNABORTED', message: 'timeout', hasResponse: false }),
    );
    expect(isRetryable(error)).toBe(true);
  });

  it('returns true for SERVER errors', () => {
    const error = classify(createAxiosError({ status: 500 }));
    expect(isRetryable(error)).toBe(true);
  });

  it('returns false for AUTHENTICATION errors', () => {
    const error = classify(createAxiosError({ status: 401 }));
    expect(isRetryable(error)).toBe(false);
  });

  it('returns false for AUTHORIZATION errors', () => {
    const error = classify(createAxiosError({ status: 403 }));
    expect(isRetryable(error)).toBe(false);
  });

  it('returns false for VALIDATION errors', () => {
    const error = classify(createAxiosError({ status: 422 }));
    expect(isRetryable(error)).toBe(false);
  });

  it('returns false for NOT_FOUND errors', () => {
    const error = classify(createAxiosError({ status: 404 }));
    expect(isRetryable(error)).toBe(false);
  });

  it('returns false for UNKNOWN errors', () => {
    const error = classify(null);
    expect(isRetryable(error)).toBe(false);
  });
});
