/**
 * Application-wide provider composition.
 *
 * Composes all top-level providers in correct nesting order:
 * - ErrorBoundary (outermost — catches unhandled errors)
 * - Redux Provider (state management)
 * - QueryClientProvider (server state)
 * - Telemetry context
 * - Theme/i18n context
 *
 * Requirements: 5.1, 7.1
 */

import { type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, DefaultErrorFallback } from '@/core/error-handling/ErrorBoundary';
import { store } from '@/app/store';
import { getQueryClient } from '@/shared/services/api/queryClient';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composes all application providers.
 * Order matters: outermost providers catch errors from inner providers.
 */
export function AppProviders({ children }: AppProvidersProps) {
  const queryClient = getQueryClient();

  return (
    <ErrorBoundary fallback={DefaultErrorFallback}>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ReduxProvider>
    </ErrorBoundary>
  );
}
