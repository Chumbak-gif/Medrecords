/**
 * TanStack Query client configuration with enterprise defaults.
 *
 * Configures:
 * - Default staleTime: 30 seconds (data stays fresh for 30s)
 * - Default gcTime: 5 minutes (inactive queries garbage-collected after 5min)
 * - Stale-while-revalidate behavior (show stale data while fetching fresh)
 * - Global error handler for failed background refetches (non-blocking notification)
 * - Query key factories wired from shared constants
 *
 * Requirements: 4.2, 4.3, 4.4, 4.7
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { queryKeys } from '@/shared/constants';

// ---------------------------------------------------------------------------
// Default timing configuration
// ---------------------------------------------------------------------------

/** Data is considered fresh for 30 seconds (Requirement 4.2) */
const DEFAULT_STALE_TIME_MS = 30 * 1000;

/** Inactive queries are garbage-collected after 5 minutes (Requirement 4.2) */
const DEFAULT_GC_TIME_MS = 5 * 60 * 1000;

/** Maximum number of retries for failed queries */
const DEFAULT_RETRY_COUNT = 1;

// ---------------------------------------------------------------------------
// Notification callback type
// ---------------------------------------------------------------------------

/**
 * Callback invoked when a background refetch fails while stale data is displayed.
 * The consumer (e.g., the app shell) should wire this to a non-blocking toast notification.
 *
 * Requirement 4.4: show a non-blocking notification indicating the refresh failed.
 */
export type OnBackgroundRefetchError = (error: unknown, queryKey: readonly unknown[]) => void;

let backgroundErrorHandler: OnBackgroundRefetchError | null = null;

/**
 * Set the global handler for background refetch failures.
 * Call this once during app initialization to wire notification display.
 */
export function setBackgroundRefetchErrorHandler(handler: OnBackgroundRefetchError): void {
  backgroundErrorHandler = handler;
}

// ---------------------------------------------------------------------------
// Query Client factory
// ---------------------------------------------------------------------------

/**
 * Create and configure the TanStack Query client with enterprise defaults.
 *
 * Stale-while-revalidate behavior (Requirement 4.3):
 * - When a query cache entry becomes stale, TanStack Query continues displaying
 *   the cached data while fetching fresh data in the background automatically.
 * - This is the default behavior with staleTime < Infinity.
 *
 * Requirement 4.4:
 * - If a background refetch fails while stale data is displayed, the cached data
 *   continues to display and a non-blocking notification is shown.
 */
export function createQueryClient(): QueryClient {
  const queryCache = new QueryCache({
    onError: (error: unknown, query) => {
      // This fires for background refetches that fail while stale data is shown.
      // Only trigger notification if there's existing cached data (stale-while-revalidate scenario).
      if (query.state.data !== undefined && backgroundErrorHandler) {
        backgroundErrorHandler(error, query.queryKey);
      }
    },
  });

  const mutationCache = new MutationCache({});

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        retry: DEFAULT_RETRY_COUNT,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
    queryCache,
    mutationCache,
  });

  return queryClient;
}

// ---------------------------------------------------------------------------
// Singleton query client instance
// ---------------------------------------------------------------------------

let queryClientInstance: QueryClient | null = null;

/**
 * Get the singleton QueryClient instance.
 * Creates it on first access with default configuration.
 */
export function getQueryClient(): QueryClient {
  if (!queryClientInstance) {
    queryClientInstance = createQueryClient();
  }
  return queryClientInstance;
}

/**
 * Reset the query client instance (primarily for testing).
 */
export function resetQueryClient(): void {
  if (queryClientInstance) {
    queryClientInstance.clear();
    queryClientInstance = null;
  }
}

// ---------------------------------------------------------------------------
// Query key factories re-export for convenience
// ---------------------------------------------------------------------------

export { queryKeys };
