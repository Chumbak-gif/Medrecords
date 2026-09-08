/**
 * Optimistic mutation hook with automatic rollback on server rejection.
 *
 * Implements:
 * - Cache snapshot before mutation (stores previous data for rollback)
 * - Optimistic cache update (immediate UI feedback)
 * - On server rejection: rollback cache to snapshot, show failure notification
 * - On success: invalidate related query keys to trigger re-fetch
 *
 * Requirements: 4.5, 4.6
 */

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAppDispatch } from '@/app/store';
import { addNotification } from '@/app/store/notificationsSlice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseOptimisticMutationOptions<TData, TVariables> {
  /** The mutation function that sends the request to the server */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /**
   * Query keys to optimistically update before the mutation completes.
   * These are also invalidated on success.
   */
  queryKey: QueryKey;

  /**
   * Produces the optimistic data to write into the cache.
   * Receives the current cached data and the mutation variables.
   * Return the updated cache value.
   */
  optimisticUpdate: (currentData: unknown, variables: TVariables) => unknown;

  /**
   * Additional query keys to invalidate on success (beyond the primary queryKey).
   * Useful for invalidating related list queries when a detail is updated.
   */
  invalidateKeys?: QueryKey[];

  /** Called when the mutation succeeds (after cache invalidation) */
  onSuccess?: (data: TData, variables: TVariables) => void;

  /** Called when the mutation fails (after rollback) */
  onError?: (error: unknown, variables: TVariables) => void;

  /** Custom error message for the failure notification */
  errorMessage?: string;

  /** Custom success message for the success notification (optional) */
  successMessage?: string;
}

export interface UseOptimisticMutationResult<TData, TVariables> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => void;
  /** Execute the mutation (returns a promise) */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Whether the mutation is in progress */
  isPending: boolean;
  /** Whether the mutation has failed */
  isError: boolean;
  /** The error if the mutation failed */
  error: unknown;
  /** Whether the mutation succeeded */
  isSuccess: boolean;
  /** The data returned by the mutation */
  data: TData | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Custom hook implementing the optimistic mutation pattern with rollback.
 *
 * Usage:
 * ```ts
 * const { mutate } = useOptimisticMutation({
 *   mutationFn: (patient) => api.updatePatient(patient.id, patient),
 *   queryKey: queryKeys.patients.detail(patientId),
 *   optimisticUpdate: (current, newPatient) => ({ ...current, ...newPatient }),
 *   invalidateKeys: [queryKeys.patients.all],
 * });
 * ```
 */
export function useOptimisticMutation<TData, TVariables>(
  options: UseOptimisticMutationOptions<TData, TVariables>,
): UseOptimisticMutationResult<TData, TVariables> {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const mutation = useMutation<TData, unknown, TVariables, { previousData: unknown }>({
    mutationFn: options.mutationFn,

    onMutate: async (variables) => {
      // Cancel any in-flight queries for this key to prevent race conditions
      await queryClient.cancelQueries({ queryKey: options.queryKey });

      // Snapshot the current cache value before applying optimistic update
      const previousData = queryClient.getQueryData(options.queryKey);

      // Apply the optimistic update to the cache
      queryClient.setQueryData(options.queryKey, (currentData: unknown) => {
        return options.optimisticUpdate(currentData, variables);
      });

      // Return the snapshot as context for potential rollback
      return { previousData };
    },

    onError: (error, variables, context) => {
      // Rollback: restore cache to pre-mutation snapshot (Requirement 4.6)
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(options.queryKey, context.previousData);
      }

      // Show failure notification (Requirement 4.6)
      dispatch(
        addNotification({
          type: 'error',
          message: options.errorMessage ?? 'Operation failed. Changes have been reverted.',
          title: 'Update Failed',
          autoDismissMs: 5000,
        }),
      );

      // Call consumer's error handler
      options.onError?.(error, variables);
    },

    onSuccess: (data, variables) => {
      // Show success notification if configured
      if (options.successMessage) {
        dispatch(
          addNotification({
            type: 'success',
            message: options.successMessage,
            autoDismissMs: 3000,
          }),
        );
      }

      // Call consumer's success handler
      options.onSuccess?.(data, variables);
    },

    onSettled: () => {
      // Invalidate the primary query key to trigger re-fetch (Requirement 4.5)
      queryClient.invalidateQueries({ queryKey: options.queryKey });

      // Invalidate any additional related query keys
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    data: mutation.data,
    reset: mutation.reset,
  };
}
