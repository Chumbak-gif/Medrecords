/**
 * Authentication Redux Toolkit slice.
 *
 * Manages authentication state including user profile, loading state, and errors.
 * The JWT access token is stored in a module-level closure variable (never in Redux
 * state, localStorage, or sessionStorage) for security.
 *
 * Provides async thunks for login, logout, refreshToken, and getProfile.
 * Implements a 5-minute pre-refresh window for automatic token renewal.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AuthState,
  AuthError,
  LoginCredentials,
  TokenResponse,
  UserProfile,
} from '@/shared/types';
import { createTypedApiClient } from '@/shared/services/api/apiClient';
import { persistSession, persistUser, clearSession } from '../services/authPersistence';

// ---------------------------------------------------------------------------
// In-memory token storage (module-level closure — mirrored to sessionStorage
// so a full page reload keeps the user logged in)
// ---------------------------------------------------------------------------

let inMemoryToken: string | null = null;
let tokenExpiresAt: number | null = null;

/**
 * Get the current in-memory access token.
 * Returns null if no token is stored.
 */
export function getAuthToken(): string | null {
  return inMemoryToken;
}

/**
 * Set the access token in memory and parse expiration from JWT payload.
 * Pass null to clear the token.
 */
export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  if (token) {
    tokenExpiresAt = parseTokenExpiry(token);
  } else {
    tokenExpiresAt = null;
  }
}

/**
 * Clear all in-memory token data.
 */
export function clearAuthToken(): void {
  inMemoryToken = null;
  tokenExpiresAt = null;
}

/**
 * Check if the token is expired or will expire within the given window (ms).
 * Returns true if token needs refresh (expired or within pre-refresh window).
 */
export function isTokenExpiringSoon(preRefreshWindowMs: number = 5 * 60 * 1000): boolean {
  if (!inMemoryToken || !tokenExpiresAt) {
    return true;
  }
  const now = Date.now();
  return now >= tokenExpiresAt - preRefreshWindowMs;
}

/**
 * Parse the expiration timestamp from a JWT token payload.
 * Returns the expiration time in milliseconds since epoch, or null if unparseable.
 */
function parseTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000; // Convert seconds to milliseconds
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API client instance (uses the shared typed client)
// ---------------------------------------------------------------------------

const apiClient = createTypedApiClient();

// ---------------------------------------------------------------------------
// Async Thunks
// ---------------------------------------------------------------------------

/**
 * Login thunk: authenticates user with credentials and stores token in memory.
 */
export const login = createAsyncThunk<
  { user: UserProfile; tokenResponse: TokenResponse },
  LoginCredentials,
  { rejectValue: AuthError }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await apiClient.post<TokenResponse>(
      '/auth/login',
      credentials,
      { skipAuth: true },
    );

    const tokenResponse = response.data;

    // Store token in memory
    setAuthToken(tokenResponse.access_token);

    // Also update the shared API client token store
    const { setToken } = await import('@/shared/services/api/apiClient');
    setToken(tokenResponse.access_token);

    // Build a basic user profile from the token response
    const user: UserProfile = {
      id: tokenResponse.user_id,
      username: '', // Will be populated by getProfile
      email: '',
      fullName: tokenResponse.full_name,
      role: tokenResponse.role,
      specialty: null,
      isActive: true,
      mustChangePassword: tokenResponse.must_change_password,
    };

    // Persist to sessionStorage so a reload keeps the user logged in
    persistSession(tokenResponse.access_token, user);

    return { user, tokenResponse };
  } catch (error: unknown) {
    // Generic error message — never reveal which field is wrong (Req 2.2)
    return rejectWithValue({
      message: 'Invalid credentials. Please try again.',
    });
  }
});

/**
 * Logout thunk: clears all auth state, invalidates refresh token on backend,
 * and broadcasts logout event to other tabs.
 */
export const logout = createAsyncThunk<void, void, { rejectValue: AuthError }>(
  'auth/logout',
  async () => {
    try {
      // Attempt to invalidate the refresh token on the backend
      await apiClient.post('/auth/logout', {}, { skipRetry: true }).catch(() => {
        // Best-effort — don't block logout if backend is unreachable
      });
    } catch {
      // Swallow error — logout should always succeed client-side
    } finally {
      // Always clear in-memory token regardless of backend response
      clearAuthToken();

      // Clear the persisted session
      clearSession();

      // Clear the shared API client token store
      const { setToken } = await import('@/shared/services/api/apiClient');
      setToken(null);
    }
  },
);

/**
 * Refresh token thunk: requests a new access token using the httpOnly refresh cookie.
 */
export const refreshToken = createAsyncThunk<
  TokenResponse,
  void,
  { rejectValue: AuthError }
>('auth/refreshToken', async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.post<TokenResponse>(
      '/auth/refresh',
      {},
      { skipAuth: true, skipRetry: true },
    );

    const tokenResponse = response.data;

    // Update in-memory token
    setAuthToken(tokenResponse.access_token);

    // Sync with shared API client token store
    const { setToken } = await import('@/shared/services/api/apiClient');
    setToken(tokenResponse.access_token);

    return tokenResponse;
  } catch {
    // Clear auth state on refresh failure
    clearAuthToken();
    const { setToken } = await import('@/shared/services/api/apiClient');
    setToken(null);

    return rejectWithValue({
      message: 'Session expired. Please log in again.',
    });
  }
});

/**
 * Get user profile thunk: fetches the full profile for the current authenticated user.
 */
export const getProfile = createAsyncThunk<
  UserProfile,
  void,
  { rejectValue: AuthError }
>('auth/getProfile', async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.get<UserProfile>('/auth/me');
    // Keep the persisted session's user profile in sync.
    persistUser(response.data);
    return response.data;
  } catch {
    return rejectWithValue({
      message: 'Failed to load user profile.',
    });
  }
});

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const initialState: AuthState = {
  user: null,
  token: null, // Note: actual token is in the closure, this field tracks presence
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Reset auth error state.
     */
    clearError(state) {
      state.error = null;
    },

    /**
     * Set authentication state directly (e.g., from session sync).
     */
    setAuthenticated(
      state,
      action: PayloadAction<{ user: UserProfile; hasToken: boolean }>,
    ) {
      state.user = action.payload.user;
      state.token = action.payload.hasToken ? '[in-memory]' : null;
      state.isAuthenticated = action.payload.hasToken;
      state.isLoading = false;
      state.error = null;
    },

    /**
     * Force clear all auth state (e.g., from multi-tab logout broadcast).
     */
    forceLogout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // -- Login --
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = '[in-memory]'; // Marker — actual token is in closure
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload ?? { message: 'Login failed.' };
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
    });

    // -- Logout --
    builder.addCase(logout.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    });
    builder.addCase(logout.rejected, (state) => {
      // Logout always clears state even on failure
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    });

    // -- Refresh Token --
    builder.addCase(refreshToken.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(refreshToken.fulfilled, (state, action) => {
      state.isLoading = false;
      state.token = '[in-memory]';
      state.isAuthenticated = true;
      // Update user info from token response if available
      if (state.user) {
        state.user.role = action.payload.role;
        state.user.fullName = action.payload.full_name;
      }
    });
    builder.addCase(refreshToken.rejected, (state, action) => {
      state.isLoading = false;
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = action.payload ?? { message: 'Token refresh failed.' };
    });

    // -- Get Profile --
    builder.addCase(getProfile.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(getProfile.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload;
    });
    builder.addCase(getProfile.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload ?? { message: 'Failed to load profile.' };
    });
  },
});

export const { clearError, setAuthenticated, forceLogout } = authSlice.actions;
export default authSlice.reducer;
