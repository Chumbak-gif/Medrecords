/**
 * Retry strategy with exponential backoff for transient API failures.
 *
 * Retries on: network errors, timeouts, HTTP 5xx (server errors).
 * Immediately propagates: HTTP 4xx (except 401 which is handled by the auth interceptor).
 *
 * Delay formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 */

import { ErrorCategory } from '@/shared/types';
import type { AppError } from '@/shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryConfig {
  /** Maximum number of attempts (including the initial request). Default: 3 */
  maxAttempts: number;
  /** Base delay in milliseconds before first retry. Default: 1000 */
  baseDelay: number;
  /** Maximum delay cap in milliseconds. Default: 10000 */
  maxDelay: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines if an error is transient and safe to retry.
 *
 * Retryable categories: NETWORK, TIMEOUT, SERVER (HTTP 5xx).
 * Non-retryable: all 4xx (except 401 which is handled upstream by the auth interceptor).
 */
export function isRetryableError(error: AppError): boolean {
  const retryableCategories: ErrorCategory[] = [
    ErrorCategory.NETWORK,
    ErrorCategory.TIMEOUT,
    ErrorCategory.SERVER,
  ];

  if (!retryableCategories.includes(error.category)) {
    return false;
  }

  // If we have a status code, only retry on 5xx or undefined (network/timeout)
  if (error.statusCode !== undefined && error.statusCode < 500) {
    return false;
  }

  return true;
}

/**
 * Calculate the delay for a given retry attempt using exponential backoff with jitter.
 *
 * delay = min(baseDelay * 2^attempt + jitter, maxDelay)
 * where jitter is a random value between 0 and 1000ms
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig,
): number {
  const jitter = Math.random() * 1000;
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt) + jitter;
  return Math.min(exponentialDelay, config.maxDelay);
}

/**
 * Sleep for the specified duration in milliseconds.
 * Exported for testing purposes.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Error classification (lightweight, for retry decisions only)
// ---------------------------------------------------------------------------

/**
 * Classifies a raw error into an AppError for retry decision-making.
 * This is a minimal classifier focused on retry logic. The full error
 * classifier (errorClassifier.ts) provides complete classification.
 */
export function classifyForRetry(error: unknown): AppError {
  const timestamp = new Date().toISOString();

  // Axios-like error with response
  if (isAxiosError(error)) {
    const status = error.response?.status;

    if (!error.response && !error.code) {
      return {
        category: ErrorCategory.NETWORK,
        message: error.message || 'Network error',
        statusCode: undefined,
        timestamp,
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        category: ErrorCategory.TIMEOUT,
        message: error.message || 'Request timeout',
        statusCode: undefined,
        timestamp,
      };
    }

    if (!error.response) {
      return {
        category: ErrorCategory.NETWORK,
        message: error.message || 'Network error',
        statusCode: undefined,
        timestamp,
      };
    }

    if (status !== undefined) {
      if (status >= 500) {
        return {
          category: ErrorCategory.SERVER,
          message: error.message || `Server error (${status})`,
          statusCode: status,
          timestamp,
        };
      }
      if (status === 401) {
        return {
          category: ErrorCategory.AUTHENTICATION,
          message: 'Authentication required',
          statusCode: status,
          timestamp,
        };
      }
      if (status === 403) {
        return {
          category: ErrorCategory.AUTHORIZATION,
          message: 'Access denied',
          statusCode: status,
          timestamp,
        };
      }
      if (status === 404) {
        return {
          category: ErrorCategory.NOT_FOUND,
          message: 'Resource not found',
          statusCode: status,
          timestamp,
        };
      }
      if (status === 400 || status === 422) {
        return {
          category: ErrorCategory.VALIDATION,
          message: error.message || 'Validation error',
          statusCode: status,
          timestamp,
        };
      }
      // Other 4xx
      return {
        category: ErrorCategory.UNKNOWN,
        message: error.message || `HTTP error (${status})`,
        statusCode: status,
        timestamp,
      };
    }
  }

  // Generic error
  if (error instanceof Error) {
    // Check for timeout-related error messages
    if (error.message.toLowerCase().includes('timeout')) {
      return {
        category: ErrorCategory.TIMEOUT,
        message: error.message,
        timestamp,
      };
    }
    // Check for network-related error messages
    if (
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('econnrefused')
    ) {
      return {
        category: ErrorCategory.NETWORK,
        message: error.message,
        timestamp,
      };
    }
  }

  return {
    category: ErrorCategory.UNKNOWN,
    message: error instanceof Error ? error.message : 'Unknown error',
    timestamp,
  };
}

// ---------------------------------------------------------------------------
// Type guard for Axios-like errors
// ---------------------------------------------------------------------------

interface AxiosLikeError {
  response?: { status?: number; data?: unknown };
  code?: string;
  message: string;
  isAxiosError?: boolean;
  config?: unknown;
}

function isAxiosError(error: unknown): error is AxiosLikeError {
  if (error === null || error === undefined) return false;
  if (typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  return (
    err.isAxiosError === true ||
    ('response' in err && 'config' in err) ||
    ('code' in err && 'message' in err && typeof err.message === 'string')
  );
}

// ---------------------------------------------------------------------------
// Core retry function
// ---------------------------------------------------------------------------

/**
 * Executes a request function with configurable retry behavior using
 * exponential backoff with jitter.
 *
 * @param requestFn - The async function to execute (must be idempotent for safe retry)
 * @param config - Retry configuration (maxAttempts, baseDelay, maxDelay)
 * @returns The result of the request function on success
 * @throws The last error after all attempts are exhausted, or immediately for non-retryable errors
 */
export async function executeWithRetry<T>(
  requestFn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      const appError = classifyForRetry(error);

      // Immediately propagate non-retryable errors
      if (!isRetryableError(appError)) {
        throw error;
      }

      // If this was the last attempt, don't sleep — just throw
      if (attempt === config.maxAttempts - 1) {
        throw error;
      }

      // Exponential backoff with jitter before next attempt
      const delay = calculateBackoffDelay(attempt, config);
      await sleep(delay);
    }
  }

  // Should not reach here, but safety net
  throw lastError;
}
