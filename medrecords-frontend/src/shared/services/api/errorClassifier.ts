/**
 * Error classifier for the API client layer.
 *
 * Classifies any error into exactly one ErrorCategory and produces
 * a well-formed AppError with a non-empty message and ISO 8601 timestamp.
 *
 * Also provides `isRetryable()` to determine if an error is transient
 * and can be retried (NETWORK, TIMEOUT, SERVER).
 */

import { type AxiosError } from 'axios';
import { ErrorCategory, type AppError } from '@/shared/types';

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

function isErrorInstance(error: unknown): error is Error {
  return error instanceof Error;
}

// ---------------------------------------------------------------------------
// Timeout detection
// ---------------------------------------------------------------------------

/**
 * Determines if an AxiosError represents a timeout.
 * Axios uses code 'ECONNABORTED' for timeouts, or 'ERR_CANCELED' when
 * an AbortSignal with a timeout triggered the cancellation.
 */
function isTimeoutError(error: AxiosError): boolean {
  if (error.code === 'ECONNABORTED') {
    return true;
  }

  // ERR_CANCELED with a timeout message indicates a timeout via AbortSignal
  if (error.code === 'ERR_CANCELED') {
    const message = error.message?.toLowerCase() ?? '';
    return message.includes('timeout') || message.includes('aborted');
  }

  return false;
}

// ---------------------------------------------------------------------------
// classify()
// ---------------------------------------------------------------------------

/**
 * Classifies an unknown error into exactly one ErrorCategory, producing
 * a valid AppError with non-empty message and ISO 8601 timestamp.
 */
export function classify(error: unknown): AppError {
  const timestamp = new Date().toISOString();

  // Handle null/undefined
  if (error == null) {
    return {
      category: ErrorCategory.UNKNOWN,
      message: 'An unknown error occurred',
      timestamp,
    };
  }

  // Handle AxiosError
  if (isAxiosError(error)) {
    return classifyAxiosError(error, timestamp);
  }

  // Handle standard Error objects
  if (isErrorInstance(error)) {
    return {
      category: ErrorCategory.UNKNOWN,
      message: error.message || 'An unexpected error occurred',
      timestamp,
    };
  }

  // Handle any other type (string, number, object, etc.)
  const message =
    typeof error === 'string' && error.length > 0
      ? error
      : 'An unknown error occurred';

  return {
    category: ErrorCategory.UNKNOWN,
    message,
    timestamp,
  };
}

// ---------------------------------------------------------------------------
// Axios-specific classification
// ---------------------------------------------------------------------------

function classifyAxiosError(error: AxiosError, timestamp: string): AppError {
  // Check for timeout first (before response checks)
  if (isTimeoutError(error)) {
    return {
      category: ErrorCategory.TIMEOUT,
      message: error.message || 'Request timed out',
      code: error.code,
      timestamp,
      context: { url: error.config?.url },
    };
  }

  // No response received — network error
  if (!error.response) {
    return {
      category: ErrorCategory.NETWORK,
      message: error.message || 'Network error: no response received',
      code: error.code,
      timestamp,
      context: { url: error.config?.url },
    };
  }

  // Classify based on HTTP status code
  const status = error.response.status;
  const correlationId =
    (error.response.headers?.['x-correlation-id'] as string) ??
    (error.config?.headers?.['X-Correlation-ID'] as string | undefined);

  const baseError: Partial<AppError> = {
    statusCode: status,
    correlationId,
    timestamp,
    code: error.code,
    context: { url: error.config?.url },
  };

  switch (true) {
    case status === 401:
      return {
        ...baseError,
        category: ErrorCategory.AUTHENTICATION,
        message: extractMessage(error) || 'Authentication required',
      } as AppError;

    case status === 403:
      return {
        ...baseError,
        category: ErrorCategory.AUTHORIZATION,
        message: extractMessage(error) || 'Access denied',
      } as AppError;

    case status === 400 || status === 422:
      return {
        ...baseError,
        category: ErrorCategory.VALIDATION,
        message: extractMessage(error) || 'Validation error',
        context: {
          ...baseError.context,
          validationErrors: extractValidationErrors(error),
        },
      } as AppError;

    case status === 404:
      return {
        ...baseError,
        category: ErrorCategory.NOT_FOUND,
        message: extractMessage(error) || 'Resource not found',
      } as AppError;

    case status >= 500 && status < 600:
      return {
        ...baseError,
        category: ErrorCategory.SERVER,
        message: extractMessage(error) || 'Internal server error',
      } as AppError;

    default:
      return {
        ...baseError,
        category: ErrorCategory.UNKNOWN,
        message: extractMessage(error) || 'An unexpected error occurred',
      } as AppError;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a human-readable message from an AxiosError response body.
 */
function extractMessage(error: AxiosError): string {
  const data = error.response?.data as Record<string, unknown> | undefined;

  if (data) {
    if (typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }
    if (typeof data.detail === 'string' && data.detail.length > 0) {
      return data.detail;
    }
    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  }

  return error.message || '';
}

/**
 * Extracts field-level validation errors from a 400/422 response.
 */
function extractValidationErrors(
  error: AxiosError,
): Record<string, string[]> | undefined {
  const data = error.response?.data as Record<string, unknown> | undefined;

  if (!data) return undefined;

  // FastAPI-style: { detail: [{ loc: [...], msg: string, type: string }] }
  if (Array.isArray(data.detail)) {
    const errors: Record<string, string[]> = {};
    for (const item of data.detail) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'loc' in item &&
        'msg' in item
      ) {
        const loc = (item as { loc: string[]; msg: string }).loc;
        const field = loc[loc.length - 1] ?? 'general';
        if (!errors[field]) errors[field] = [];
        errors[field].push((item as { msg: string }).msg);
      }
    }
    return Object.keys(errors).length > 0 ? errors : undefined;
  }

  // Generic: { errors: { field: string[] } }
  if (typeof data.errors === 'object' && data.errors !== null) {
    return data.errors as Record<string, string[]>;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// isRetryable()
// ---------------------------------------------------------------------------

/**
 * Determines if an error is retryable (transient failure).
 * Retryable categories: NETWORK, TIMEOUT, SERVER.
 */
export function isRetryable(error: AppError): boolean {
  return (
    error.category === ErrorCategory.NETWORK ||
    error.category === ErrorCategory.TIMEOUT ||
    error.category === ErrorCategory.SERVER
  );
}
