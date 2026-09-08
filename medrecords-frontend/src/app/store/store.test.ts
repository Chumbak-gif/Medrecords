/**
 * Unit tests for Redux store configuration.
 *
 * Verifies store creation, middleware integration, and typed hooks.
 */

import { describe, it, expect } from 'vitest';
import { store, useAppDispatch, useAppSelector } from './index';
import { rootReducer } from './rootReducer';

describe('Redux store', () => {
  it('should create store with the correct initial state shape', () => {
    const state = store.getState();
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('ui');
    expect(state).toHaveProperty('notifications');
  });

  it('auth state should have correct initial values', () => {
    const { auth } = store.getState();
    expect(auth.user).toBeNull();
    expect(auth.token).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isLoading).toBe(false);
    expect(auth.error).toBeNull();
  });

  it('ui state should have correct initial values', () => {
    const { ui } = store.getState();
    expect(ui.sidebarCollapsed).toBe(false);
    expect(ui.theme).toBe('system');
    expect(ui.locale).toBe('en');
    expect(ui.breadcrumbs).toEqual([]);
  });

  it('notifications state should have correct initial values', () => {
    const { notifications } = store.getState();
    expect(notifications.items).toEqual([]);
    expect(notifications.unreadCount).toBe(0);
  });

  it('should export typed hooks', () => {
    expect(useAppDispatch).toBeDefined();
    expect(useAppSelector).toBeDefined();
  });

  it('rootReducer should produce the same state shape', () => {
    const state = rootReducer(undefined, { type: '@@INIT' });
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('ui');
    expect(state).toHaveProperty('notifications');
  });

  it('store dispatch should accept auth actions', () => {
    // Dispatch a simple synchronous action
    store.dispatch({ type: 'auth/clearError' });
    expect(store.getState().auth.error).toBeNull();
  });
});
