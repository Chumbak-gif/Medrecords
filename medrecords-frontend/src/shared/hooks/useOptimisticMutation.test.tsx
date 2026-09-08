/**
 * Unit tests for useOptimisticMutation hook.
 *
 * Validates:
 * - Optimistic cache update before mutation completes
 * - Cache rollback on server rejection (Requirement 4.6)
 * - Cache invalidation on success (Requirement 4.5)
 * - Failure notification dispatch on error
 *
 * Requirements: 4.5, 4.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import React from 'react';
import notificationsReducer from '@/app/store/notificationsSlice';
import authReducer from '@/features/authentication/store/authSlice';
import uiReducer from '@/app/store/uiSlice';
import { useOptimisticMutation } from './useOptimisticMutation';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function createTestStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      notifications: notificationsReducer,
    },
  });
}

function createWrapper(queryClient: QueryClient, store: ReturnType<typeof createTestStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      Provider,
      { store },
      React.createElement(QueryClientProvider, { client: queryClient }, children),
    );
  };
}

describe('useOptimisticMutation', () => {
  let queryClient: QueryClient;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    store = createTestStore();
  });

  it('applies optimistic update to cache immediately on mutate', async () => {
    const queryKey = ['patients', 'detail', 1];
    const originalData = { id: 1, name: 'John Doe' };

    queryClient.setQueryData(queryKey, originalData);

    const mutationFn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: 'Jane Doe' }), 100)),
    );

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdate: (_current, variables: { name: string }) => ({
            id: 1,
            name: variables.name,
          }),
        }),
      { wrapper: createWrapper(queryClient, store) },
    );

    act(() => {
      result.current.mutate({ name: 'Jane Doe' });
    });

    // Cache should be optimistically updated immediately
    await waitFor(() => {
      expect(queryClient.getQueryData(queryKey)).toEqual({ id: 1, name: 'Jane Doe' });
    });
  });

  it('rolls back cache to snapshot on server rejection', async () => {
    const queryKey = ['patients', 'detail', 2];
    const originalData = { id: 2, name: 'Original Name' };

    queryClient.setQueryData(queryKey, originalData);

    const mutationFn = vi.fn().mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdate: (_current, variables: { name: string }) => ({
            id: 2,
            name: variables.name,
          }),
        }),
      { wrapper: createWrapper(queryClient, store) },
    );

    act(() => {
      result.current.mutate({ name: 'Optimistic Name' });
    });

    // Wait for the mutation to settle
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Cache should be rolled back to original
    expect(queryClient.getQueryData(queryKey)).toEqual(originalData);
  });

  it('dispatches failure notification on server rejection', async () => {
    const queryKey = ['patients', 'detail', 3];
    queryClient.setQueryData(queryKey, { id: 3, name: 'Test' });

    const mutationFn = vi.fn().mockRejectedValue(new Error('Conflict'));

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdate: (_current, variables: { name: string }) => ({
            id: 3,
            name: variables.name,
          }),
          errorMessage: 'Failed to update patient.',
        }),
      { wrapper: createWrapper(queryClient, store) },
    );

    act(() => {
      result.current.mutate({ name: 'New Name' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Check notification was dispatched
    const notifications = store.getState().notifications.items;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('error');
    expect(notifications[0].message).toBe('Failed to update patient.');
  });

  it('invalidates query keys on success', async () => {
    const queryKey = ['patients', 'detail', 4];
    const relatedKey = ['patients'];

    queryClient.setQueryData(queryKey, { id: 4, name: 'Before' });
    queryClient.setQueryData(relatedKey, [{ id: 4, name: 'Before' }]);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mutationFn = vi.fn().mockResolvedValue({ id: 4, name: 'After' });

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdate: (_current, variables: { name: string }) => ({
            id: 4,
            name: variables.name,
          }),
          invalidateKeys: [relatedKey],
        }),
      { wrapper: createWrapper(queryClient, store) },
    );

    act(() => {
      result.current.mutate({ name: 'After' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Both the primary key and related keys should be invalidated
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: relatedKey });
  });

  it('calls onSuccess callback on mutation success', async () => {
    const queryKey = ['patients', 'detail', 5];
    queryClient.setQueryData(queryKey, { id: 5, name: 'Original' });

    const onSuccess = vi.fn();
    const mutationFn = vi.fn().mockResolvedValue({ id: 5, name: 'Updated' });

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdate: (_current, variables: { name: string }) => ({
            id: 5,
            name: variables.name,
          }),
          onSuccess,
        }),
      { wrapper: createWrapper(queryClient, store) },
    );

    act(() => {
      result.current.mutate({ name: 'Updated' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledWith(
      { id: 5, name: 'Updated' },
      { name: 'Updated' },
    );
  });

  it('calls onError callback on mutation failure', async () => {
    const queryKey = ['patients', 'detail', 6];
    queryClient.setQueryData(queryKey, { id: 6, name: 'Original' });

    const onError = vi.fn();
    const mutationFn = vi.fn().mockRejectedValue(new Error('Fail'));

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdate: (_current, variables: { name: string }) => ({
            id: 6,
            name: variables.name,
          }),
          onError,
        }),
      { wrapper: createWrapper(queryClient, store) },
    );

    act(() => {
      result.current.mutate({ name: 'Doomed' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error), { name: 'Doomed' });
  });
});
