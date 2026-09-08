/**
 * API services barrel export.
 */

export {
  createApiClient,
  createTypedApiClient,
  getToken,
  setToken,
  generateCorrelationId,
} from './apiClient';

export { apiConfig } from './apiConfig';

export {
  executeWithRetry,
  isRetryableError,
  calculateBackoffDelay,
  classifyForRetry,
  sleep,
  DEFAULT_RETRY_CONFIG,
} from './retryStrategy';
export type { RetryConfig } from './retryStrategy';

export { classify, isRetryable } from './errorClassifier';

export {
  createQueryClient,
  getQueryClient,
  resetQueryClient,
  setBackgroundRefetchErrorHandler,
} from './queryClient';
export type { OnBackgroundRefetchError } from './queryClient';
