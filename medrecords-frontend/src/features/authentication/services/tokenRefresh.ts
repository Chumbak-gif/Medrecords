/**
 * Token refresh service with race condition prevention.
 *
 * Implements a singleton refresh pattern — only one refresh request can be
 * in-flight at a time. Concurrent callers are queued and all resolve with
 * the single response from the active refresh request.
 *
 * On refresh failure: clears auth state and redirects to login with returnUrl.
 *
 * Requirements: 2.5, 2.8
 */

import { createTypedApiClient } from '@/shared/services/api/apiClient';
import { setToken } from '@/shared/services/api/apiClient';
import type { TokenResponse } from '@/shared/types';
import { setAuthToken, clearAuthToken } from '../store/authSlice';
import { ROUTES } from '@/shared/constants';

// ---------------------------------------------------------------------------
// Singleton refresh state
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string> | null = null;

/**
 * Maximum time (ms) to wait for a token refresh before timing out.
 * Requirement 2.5: resolve all waiting callers within 10 seconds or fail them all.
 */
const REFRESH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// API client (without auth to avoid circular refresh)
// ---------------------------------------------------------------------------

const apiClient = createTypedApiClient();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Refresh the access token with race condition prevention.
 *
 * If a refresh is already in-flight, all concurrent callers receive the same
 * promise (singleton pattern). Only one HTTP request is made regardless of how
 * many callers invoke this function concurrently.
 *
 * On success: stores new token in memory, returns the new access token string.
 * On failure: clears auth state, redirects to login with the current URL as returnUrl.
 *
 * @returns The new access token string.
 * @throws If the refresh request fails or times out.
 */
export function refreshTokenWithLock(): Promise<string> {
  // If a refresh is already in progress, queue this caller by returning the same promise
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = executeRefresh();
  return refreshPromise;
}

/**
 * Check whether a token refresh is currently in-flight.
 */
export function isRefreshInProgress(): boolean {
  return refreshPromise !== null;
}

/**
 * Reset the refresh lock (primarily for testing purposes).
 */
export function resetRefreshLock(): void {
  refreshPromise = null;
}

// ---------------------------------------------------------------------------
// Internal implementation
// ---------------------------------------------------------------------------

async function executeRefresh(): Promise<string> {
  try {
    const result = await Promise.race([
      performRefreshRequest(),
      createTimeout(REFRESH_TIMEOUT_MS),
    ]);
    return result;
  } catch (error) {
    // On failure: clear auth state and redirect to login with returnUrl
    handleRefreshFailure();
    throw error;
  } finally {
    // Always clear the singleton promise so subsequent calls can try again
    refreshPromise = null;
  }
}

async function performRefreshRequest(): Promise<string> {
  const response = await apiClient.post<TokenResponse>(
    '/auth/refresh',
    {},
    { skipAuth: true, skipRetry: true },
  );

  const newToken = response.data.access_token;

  // Update token in both the auth slice closure and the shared API client store
  setAuthToken(newToken);
  setToken(newToken);

  return newToken;
}

function createTimeout(ms: number): Promise<never> {
  return new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Token refresh timed out after ${ms}ms`));
    }, ms);
  });
}

function handleRefreshFailure(): void {
  // Clear all token state
  clearAuthToken();
  setToken(null);

  // Redirect to login with the current URL preserved as returnUrl (Req 2.8)
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname + window.location.search;
    const returnUrl = encodeURIComponent(currentPath);
    const loginUrl = `${ROUTES.LOGIN}?returnUrl=${returnUrl}`;

    // Use location.replace to navigate (won't add to history)
    window.location.replace(loginUrl);
  }
}
