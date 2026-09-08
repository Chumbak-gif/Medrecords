/**
 * Unit tests for authSlice.
 *
 * Tests the Redux slice reducers, token-in-memory storage,
 * and token expiry detection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  clearError,
  setAuthenticated,
  forceLogout,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  isTokenExpiringSoon,
} from './authSlice';
import type { AuthState, UserProfile } from '@/shared/types';

// ---------------------------------------------------------------------------
// Helper: create a fake JWT token with a given expiry (seconds from epoch)
// ---------------------------------------------------------------------------

function createFakeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: expSeconds, sub: '1' }));
  const signature = 'fake-signature';
  return `${header}.${payload}.${signature}`;
}

function createTestStore(preloadedState?: Partial<AuthState>) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: preloadedState ? { auth: { ...initialState, ...preloadedState } } : undefined,
  });
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const mockUser: UserProfile = {
  id: 1,
  username: 'drjones',
  email: 'dr.jones@med.com',
  fullName: 'Dr. Jones',
  role: 'doctor',
  specialty: 'Cardiology',
  isActive: true,
};

describe('authSlice', () => {
  beforeEach(() => {
    clearAuthToken();
  });

  describe('initial state', () => {
    it('should return the initial state', () => {
      const store = createTestStore();
      expect(store.getState().auth).toEqual(initialState);
    });
  });

  describe('reducers', () => {
    it('clearError should reset error to null', () => {
      const store = createTestStore({
        error: { message: 'Something went wrong' },
      });
      store.dispatch(clearError());
      expect(store.getState().auth.error).toBeNull();
    });

    it('setAuthenticated should set user and auth state', () => {
      const store = createTestStore();
      store.dispatch(setAuthenticated({ user: mockUser, hasToken: true }));

      const state = store.getState().auth;
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('[in-memory]');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('setAuthenticated with hasToken=false should be unauthenticated', () => {
      const store = createTestStore();
      store.dispatch(setAuthenticated({ user: mockUser, hasToken: false }));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
    });

    it('forceLogout should clear all auth state', () => {
      const store = createTestStore({
        user: mockUser,
        token: '[in-memory]',
        isAuthenticated: true,
        isLoading: true,
        error: { message: 'error' },
      });

      store.dispatch(forceLogout());

      const state = store.getState().auth;
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('in-memory token storage', () => {
    it('should store and retrieve token', () => {
      expect(getAuthToken()).toBeNull();
      setAuthToken('test-token');
      expect(getAuthToken()).toBe('test-token');
    });

    it('should clear token', () => {
      setAuthToken('test-token');
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });

    it('setAuthToken(null) should clear the token', () => {
      setAuthToken('test-token');
      setAuthToken(null);
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('token expiry check', () => {
    it('should return true when no token is stored', () => {
      expect(isTokenExpiringSoon()).toBe(true);
    });

    it('should return true when token is already expired', () => {
      // Token expired 10 minutes ago
      const expiredTime = Math.floor(Date.now() / 1000) - 600;
      setAuthToken(createFakeJwt(expiredTime));
      expect(isTokenExpiringSoon()).toBe(true);
    });

    it('should return true when token expires within 5-minute window', () => {
      // Token expires in 3 minutes (within default 5-minute window)
      const soonExpiry = Math.floor(Date.now() / 1000) + 180;
      setAuthToken(createFakeJwt(soonExpiry));
      expect(isTokenExpiringSoon()).toBe(true);
    });

    it('should return false when token is not expiring soon', () => {
      // Token expires in 30 minutes (outside 5-minute window)
      const futureExpiry = Math.floor(Date.now() / 1000) + 1800;
      setAuthToken(createFakeJwt(futureExpiry));
      expect(isTokenExpiringSoon()).toBe(false);
    });

    it('should support custom pre-refresh window', () => {
      // Token expires in 8 minutes, custom window of 10 minutes
      const expiry = Math.floor(Date.now() / 1000) + 480;
      setAuthToken(createFakeJwt(expiry));
      expect(isTokenExpiringSoon(10 * 60 * 1000)).toBe(true);
      expect(isTokenExpiringSoon(5 * 60 * 1000)).toBe(false);
    });

    it('should handle malformed JWT gracefully', () => {
      setAuthToken('not-a-jwt');
      // No expiry parseable → should treat as expiring
      expect(isTokenExpiringSoon()).toBe(true);
    });
  });
});
