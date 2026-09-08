/**
 * Multi-tab session synchronization service.
 *
 * Uses the BroadcastChannel API to synchronize authentication state across
 * browser tabs. Handles:
 * - Broadcasting logout events to all tabs
 * - Receiving logout from another tab: clears local state, redirects to login
 * - On page load/refresh: attempts silent token refresh via httpOnly cookie
 *
 * Requirements: 2.6, 2.7, 2.9, 2.10
 */

import { setToken } from '@/shared/services/api/apiClient';
import { createTypedApiClient } from '@/shared/services/api/apiClient';
import { setAuthToken, clearAuthToken } from '../store/authSlice';
import { ROUTES } from '@/shared/constants';
import type { TokenResponse, UserProfile } from '@/shared/types';

// ---------------------------------------------------------------------------
// BroadcastChannel setup
// ---------------------------------------------------------------------------

const CHANNEL_NAME = 'medrecords-auth-sync';

type SessionMessage =
  | { type: 'LOGOUT'; timestamp: string }
  | { type: 'SESSION_RESTORED'; userId: number; timestamp: string };

let channel: BroadcastChannel | null = null;

// ---------------------------------------------------------------------------
// Store dispatch reference (set during initialization)
// ---------------------------------------------------------------------------

type DispatchFn = (action: unknown) => void;
let storeDispatch: DispatchFn | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the session sync service.
 * Must be called once on application startup with the Redux store dispatch.
 *
 * @param dispatch - The Redux store dispatch function (for forceLogout/setAuthenticated actions)
 */
export function initSessionSync(dispatch: DispatchFn): void {
  storeDispatch = dispatch;

  if (typeof BroadcastChannel === 'undefined') {
    // BroadcastChannel not available (e.g., SSR or very old browsers)
    return;
  }

  // Close existing channel if re-initializing
  if (channel) {
    channel.close();
  }

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = handleMessage;
}

/**
 * Broadcast a logout event to all other browser tabs.
 * Called after local logout is complete.
 *
 * Requirement 2.6: broadcast the logout event to all browser tabs via BroadcastChannel API.
 */
export function broadcastLogout(): void {
  if (!channel) return;

  const message: SessionMessage = {
    type: 'LOGOUT',
    timestamp: new Date().toISOString(),
  };

  channel.postMessage(message);
}

/**
 * Broadcast session restoration to other tabs (informational).
 */
export function broadcastSessionRestored(userId: number): void {
  if (!channel) return;

  const message: SessionMessage = {
    type: 'SESSION_RESTORED',
    userId,
    timestamp: new Date().toISOString(),
  };

  channel.postMessage(message);
}

/**
 * Attempt a silent token refresh using the httpOnly refresh cookie.
 * Called on page load/refresh to restore session without user interaction.
 *
 * Requirement 2.9: On page load/refresh, attempt silent token refresh.
 * Requirement 2.10: If silent refresh fails, set state to unauthenticated and redirect.
 *
 * @returns The user profile if refresh succeeds, null otherwise.
 */
export async function attemptSilentRefresh(): Promise<{
  token: string;
  user: UserProfile;
} | null> {
  const apiClient = createTypedApiClient();

  try {
    // Attempt token refresh using httpOnly cookie (no auth header needed)
    const refreshResponse = await apiClient.post<TokenResponse>(
      '/auth/refresh',
      {},
      { skipAuth: true, skipRetry: true },
    );

    const tokenResponse = refreshResponse.data;
    const newToken = tokenResponse.access_token;

    // Store the new token in memory
    setAuthToken(newToken);
    setToken(newToken);

    // Build user profile from token response
    const user: UserProfile = {
      id: tokenResponse.user_id,
      username: '', // Will be populated by getProfile if needed
      email: '',
      fullName: tokenResponse.full_name,
      role: tokenResponse.role,
      specialty: null,
      isActive: true,
    };

    return { token: newToken, user };
  } catch {
    // Silent refresh failed — clear any stale state
    clearAuthToken();
    setToken(null);
    return null;
  }
}

/**
 * Handle silent refresh failure by redirecting to login.
 * Preserves the originally requested URL as a returnUrl query parameter.
 *
 * Requirement 2.10: redirect to login with originally requested URL preserved.
 */
export function handleSilentRefreshFailure(): void {
  if (typeof window === 'undefined') return;

  const currentPath = window.location.pathname + window.location.search;

  // Don't redirect if already on login page
  if (currentPath.startsWith(ROUTES.LOGIN)) return;

  const returnUrl = encodeURIComponent(currentPath);
  const loginUrl = `${ROUTES.LOGIN}?returnUrl=${returnUrl}`;

  // Use replace to prevent back-button access
  window.location.replace(loginUrl);
}

/**
 * Clean up the session sync service.
 * Closes the BroadcastChannel and removes event listeners.
 */
export function destroySessionSync(): void {
  if (channel) {
    channel.close();
    channel = null;
  }
  storeDispatch = null;
}

// ---------------------------------------------------------------------------
// Internal handlers
// ---------------------------------------------------------------------------

function handleMessage(event: MessageEvent<SessionMessage>): void {
  const message = event.data;

  switch (message.type) {
    case 'LOGOUT':
      handleLogoutFromOtherTab();
      break;
    case 'SESSION_RESTORED':
      // Informational — other tabs can react if needed
      break;
  }
}

/**
 * Handle a logout event received from another browser tab.
 *
 * Requirement 2.7: clear local session state and redirect to login using
 * replaceUrl navigation to prevent back-button access.
 */
function handleLogoutFromOtherTab(): void {
  // Clear token state
  clearAuthToken();
  setToken(null);

  // Dispatch forceLogout to clear Redux state
  if (storeDispatch) {
    // Import the action type inline to avoid circular dependency at module load
    storeDispatch({ type: 'auth/forceLogout' });
  }

  // Redirect to login using replaceUrl (prevents back-button access to auth views)
  if (typeof window !== 'undefined') {
    window.location.replace(ROUTES.LOGIN);
  }
}
