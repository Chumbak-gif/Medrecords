/**
 * Redux store configuration with middleware.
 *
 * Configures the application store with:
 * - Root reducer combining auth, ui, and notifications slices
 * - Logger middleware (development only)
 * - Telemetry middleware (action tracking)
 * - Default Redux Toolkit middleware (thunk, serializability check, etc.)
 *
 * Exports typed hooks (useAppDispatch, useAppSelector) for use throughout
 * the application.
 *
 * Requirements: 4.1
 */

import { configureStore } from '@reduxjs/toolkit';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';
import { rootReducer, type RootState } from './rootReducer';
import { loggerMiddleware } from './middleware/logger';
import { telemetryMiddleware } from './middleware/telemetry';
import { loadSession } from '@/features/authentication/services/authPersistence';
import { setAuthToken } from '@/features/authentication/store/authSlice';
import { setToken } from '@/shared/services/api/apiClient';

// ---------------------------------------------------------------------------
// Rehydrate a persisted session (sessionStorage) synchronously at startup so a
// page reload keeps the user authenticated without a flash of the login page.
// ---------------------------------------------------------------------------

function buildPreloadedState(): Partial<RootState> | undefined {
  const session = loadSession();
  if (!session) return undefined;

  // Re-arm both token stores (in-memory closure + shared API client).
  setAuthToken(session.token);
  setToken(session.token);

  return {
    auth: {
      user: session.user,
      token: '[in-memory]',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    },
  } as Partial<RootState>;
}

// ---------------------------------------------------------------------------
// Store creation
// ---------------------------------------------------------------------------

export const store = configureStore({
  reducer: rootReducer,
  preloadedState: buildPreloadedState(),
  middleware: (getDefaultMiddleware) => {
    const middlewares = getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in auth actions (e.g., AbortSignal)
        ignoredActions: ['auth/login/pending', 'auth/refreshToken/pending'],
      },
    });

    // Add telemetry middleware for all environments
    middlewares.push(telemetryMiddleware);

    // Add logger middleware only in development
    if (import.meta.env.DEV) {
      middlewares.push(loggerMiddleware);
    }

    return middlewares;
  },
  devTools: import.meta.env.DEV,
});

// ---------------------------------------------------------------------------
// Typed hooks
// ---------------------------------------------------------------------------

export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { RootState } from './rootReducer';
