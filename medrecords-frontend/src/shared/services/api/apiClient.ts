/**
 * Core Axios API client with request/response interceptors.
 *
 * Handles:
 * - Bearer token attachment from in-memory store
 * - UUID v4 correlation ID generation (X-Correlation-ID)
 * - Token refresh on 401 with singleton lock pattern (retry once)
 * - skipAuth config option to omit Authorization header
 * - AUTHENTICATION error propagation when no token is available
 */

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from 'axios';
import { ErrorCategory } from '@/shared/types';
import type { ApiClientConfig, ApiResponse, RequestConfig } from '@/shared/types';
import { apiConfig } from './apiConfig';
import { executeWithRetry, DEFAULT_RETRY_CONFIG } from './retryStrategy';
import type { RetryConfig } from './retryStrategy';

// ---------------------------------------------------------------------------
// In-memory token store
// ---------------------------------------------------------------------------

let accessToken: string | null = null;

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string | null): void {
  accessToken = token;
}

// The backend currently exposes no /auth/refresh endpoint, so token refresh is
// disabled. Set to true if/when a refresh endpoint is added.
const AUTH_REFRESH_ENABLED = false;

// Guards against multiple concurrent 401s all triggering a redirect.
let sessionExpiredHandled = false;

/**
 * Clear the in-memory session and redirect to the login page. Called when a
 * request returns 401 and the session cannot be refreshed.
 */
function handleSessionExpired(): void {
  setToken(null);
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem('medrecords_session');
    } catch {
      /* ignore storage errors */
    }
    const path = window.location.pathname;
    if (path !== '/login') {
      const returnUrl = encodeURIComponent(path + window.location.search);
      window.location.assign(`/login?returnUrl=${returnUrl}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Correlation ID generation (UUID v4)
// ---------------------------------------------------------------------------

export function generateCorrelationId(): string {
  // Use crypto.randomUUID when available, fallback to manual generation
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Manual UUID v4 generation fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Singleton token refresh lock
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string> | null = null;

async function refreshTokenWithLock(instance: AxiosInstance): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await instance.post(
        '/auth/refresh',
        {},
        {
          headers: { 'X-Skip-Auth': 'true' },
          _skipAuth: true,
          _retried: true, // Prevent infinite loop if refresh itself gets 401
        } as unknown as InternalAxiosRequestConfig,
      );
      const newToken: string = response.data.access_token;
      setToken(newToken);
      return newToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Custom Axios config extension
// ---------------------------------------------------------------------------

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retried?: boolean;
    _skipAuth?: boolean;
  }
}

// ---------------------------------------------------------------------------
// API Client factory
// ---------------------------------------------------------------------------

export function createApiClient(config: ApiClientConfig = apiConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  // -------------------------------------------------------------------------
  // Request interceptor
  // -------------------------------------------------------------------------
  instance.interceptors.request.use(
    (reqConfig: InternalAxiosRequestConfig) => {
      const skipAuth = reqConfig._skipAuth === true;

      if (!skipAuth) {
        const token = getToken();
        if (!token) {
          // Propagate AUTHENTICATION error without sending request
          const error = new axios.Cancel('No authentication token available');
          (error as unknown as Record<string, unknown>).__errorCategory =
            ErrorCategory.AUTHENTICATION;
          return Promise.reject(error);
        }
        reqConfig.headers.set('Authorization', `Bearer ${token}`);
      }

      // Always attach correlation ID
      reqConfig.headers.set('X-Correlation-ID', generateCorrelationId());

      return reqConfig;
    },
    (error) => Promise.reject(error),
  );

  // -------------------------------------------------------------------------
  // Response interceptor: handle 401 with token refresh + retry once
  // -------------------------------------------------------------------------
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalConfig = error.config as InternalAxiosRequestConfig | undefined;

      if (
        error.response?.status === 401 &&
        originalConfig &&
        !originalConfig._retried &&
        !originalConfig._skipAuth
      ) {
        originalConfig._retried = true;

        // Only attempt a token refresh if the backend exposes a refresh
        // endpoint. When it doesn't (401 → expired/invalid session), fall
        // through to session cleanup + redirect instead of hammering a 404.
        if (AUTH_REFRESH_ENABLED) {
          try {
            const newToken = await refreshTokenWithLock(instance);
            originalConfig.headers.set('Authorization', `Bearer ${newToken}`);
            return instance(originalConfig);
          } catch {
            handleSessionExpired();
            return Promise.reject(error);
          }
        }

        // No refresh capability: the session is over. Clear it and send the
        // user back to login so they can re-authenticate.
        handleSessionExpired();
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

// ---------------------------------------------------------------------------
// Typed API wrapper helpers
// ---------------------------------------------------------------------------

function buildRequestConfig(config?: RequestConfig): InternalAxiosRequestConfig {
  const axiosConfig: Record<string, unknown> = {};

  if (config?.params) {
    axiosConfig.params = config.params;
  }
  if (config?.headers) {
    axiosConfig.headers = config.headers;
  }
  if (config?.signal) {
    axiosConfig.signal = config.signal;
  }
  if (config?.skipAuth) {
    axiosConfig._skipAuth = true;
  }

  return axiosConfig as unknown as InternalAxiosRequestConfig;
}

/**
 * Creates a typed API client wrapper that returns ApiResponse<T> objects.
 * Integrates the retry strategy for transient failures (network, timeout, 5xx).
 * Requests configured with `skipRetry: true` bypass the retry mechanism.
 */
export function createTypedApiClient(clientConfig: ApiClientConfig = apiConfig) {
  const instance = createApiClient(clientConfig);

  const retryConfig: RetryConfig = {
    maxAttempts: clientConfig.retryAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts,
    baseDelay: clientConfig.retryDelay ?? DEFAULT_RETRY_CONFIG.baseDelay,
    maxDelay: DEFAULT_RETRY_CONFIG.maxDelay,
  };

  function extractApiResponse<T>(response: import('axios').AxiosResponse<T>): ApiResponse<T> {
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as unknown as Record<string, string>,
      correlationId:
        (response.config.headers?.get?.('X-Correlation-ID') as string) ??
        response.headers['x-correlation-id'] ??
        '',
    };
  }

  function withRetry<T>(requestFn: () => Promise<T>, config?: RequestConfig): Promise<T> {
    if (config?.skipRetry) {
      return requestFn();
    }
    return executeWithRetry(requestFn, retryConfig);
  }

  return {
    async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
      return withRetry(
        async () => extractApiResponse(await instance.get<T>(url, buildRequestConfig(config))),
        config,
      );
    },

    async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
      return withRetry(
        async () => extractApiResponse(await instance.post<T>(url, data, buildRequestConfig(config))),
        config,
      );
    },

    async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
      return withRetry(
        async () => extractApiResponse(await instance.put<T>(url, data, buildRequestConfig(config))),
        config,
      );
    },

    async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
      return withRetry(
        async () => extractApiResponse(await instance.patch<T>(url, data, buildRequestConfig(config))),
        config,
      );
    },

    async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
      return withRetry(
        async () => extractApiResponse(await instance.delete<T>(url, buildRequestConfig(config))),
        config,
      );
    },

    /** Expose the raw Axios instance for advanced use cases */
    instance,
  };
}
