/**
 * Error reporter and notification system.
 *
 * Reports errors with correlationId, category, timestamp, userId, route,
 * and feature module name to the telemetry system.
 *
 * Provides a toast notification service:
 * - Network errors → connection toast
 * - Server errors → correlation ID + retry button
 * - Chunk load failure → "New version available" with reload button
 *
 * Requirements: 5.2, 5.4, 5.5, 5.6
 */

import { ErrorCategory, type AppError } from '@/shared/types';
import { store } from '@/app/store';
import { addNotification } from '@/app/store/notificationsSlice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorReport {
  correlationId: string;
  category: ErrorCategory;
  message: string;
  timestamp: string;
  userId?: number;
  route: string;
  feature: string;
  statusCode?: number;
  context?: Record<string, unknown>;
}

export interface ToastNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  action?: ToastAction;
  autoDismissMs?: number | null;
}

export interface ToastAction {
  label: string;
  handler: () => void;
}

// ---------------------------------------------------------------------------
// Helper: detect chunk load failure
// ---------------------------------------------------------------------------

export function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('loading chunk') ||
      message.includes('loading css chunk') ||
      message.includes('dynamically imported module') ||
      message.includes('failed to fetch dynamically imported module')
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helper: get current route
// ---------------------------------------------------------------------------

function getCurrentRoute(): string {
  if (typeof window !== 'undefined') {
    return window.location.pathname;
  }
  return '/';
}

// ---------------------------------------------------------------------------
// Helper: get current user ID from store
// ---------------------------------------------------------------------------

function getCurrentUserId(): number | undefined {
  try {
    const state = store.getState();
    return state.auth.user?.id ?? undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Helper: extract feature module from route
// ---------------------------------------------------------------------------

function extractFeatureFromRoute(route: string): string {
  // Routes are like /patients/..., /assessments/..., /dashboard, /audit/...
  const segments = route.split('/').filter(Boolean);
  if (segments.length > 0) {
    return segments[0];
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Report error to telemetry
// ---------------------------------------------------------------------------

/**
 * Report an error to the telemetry system with full context.
 * Dispatches a custom event that the telemetry system can subscribe to.
 */
export function reportError(error: AppError, feature?: string): ErrorReport {
  const route = getCurrentRoute();
  const report: ErrorReport = {
    correlationId: error.correlationId ?? '',
    category: error.category,
    message: error.message,
    timestamp: error.timestamp,
    userId: getCurrentUserId(),
    route,
    feature: feature ?? extractFeatureFromRoute(route),
    statusCode: error.statusCode,
    context: error.context,
  };

  // Emit custom event for telemetry system
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('error-report', { detail: report }),
    );
  }

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('[ErrorReporter]', report);
  }

  return report;
}

// ---------------------------------------------------------------------------
// Toast notification dispatch
// ---------------------------------------------------------------------------

/**
 * Show a toast notification via the Redux notifications slice.
 */
function dispatchToast(toast: ToastNotification): void {
  store.dispatch(
    addNotification({
      id: toast.id,
      type: toast.type,
      title: toast.title,
      message: toast.message,
      autoDismissMs: toast.autoDismissMs,
    }),
  );
}

// ---------------------------------------------------------------------------
// Notify user based on error category
// ---------------------------------------------------------------------------

/**
 * Display appropriate toast notification based on error category.
 * - NETWORK → connection toast (minimum 5s display)
 * - SERVER → generic message with correlation ID + retry button
 * - Chunk load → "New version available" with reload button
 */
export function notifyError(error: AppError, options?: { onRetry?: () => void }): void {
  const toastId = `error_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  switch (error.category) {
    case ErrorCategory.NETWORK:
      dispatchToast({
        id: toastId,
        type: 'error',
        title: 'Connection Lost',
        message: 'Unable to reach the server. Please check your network connection.',
        autoDismissMs: null, // Persistent until connection restored or dismissed
      });
      break;

    case ErrorCategory.SERVER:
      dispatchToast({
        id: toastId,
        type: 'error',
        title: 'Server Error',
        message: error.correlationId
          ? `Something went wrong. Reference: ${error.correlationId}`
          : 'Something went wrong. Please try again.',
        action: options?.onRetry
          ? { label: 'Retry', handler: options.onRetry }
          : undefined,
        autoDismissMs: null, // Persistent until user dismisses or retries
      });
      break;

    case ErrorCategory.TIMEOUT:
      dispatchToast({
        id: toastId,
        type: 'warning',
        title: 'Request Timeout',
        message: 'The request took too long. Please try again.',
        action: options?.onRetry
          ? { label: 'Retry', handler: options.onRetry }
          : undefined,
        autoDismissMs: 8000,
      });
      break;

    case ErrorCategory.AUTHENTICATION:
      dispatchToast({
        id: toastId,
        type: 'warning',
        title: 'Session Expired',
        message: 'Your session has expired. Please log in again.',
        autoDismissMs: 5000,
      });
      break;

    case ErrorCategory.AUTHORIZATION:
      dispatchToast({
        id: toastId,
        type: 'warning',
        title: 'Access Denied',
        message: 'You do not have permission to perform this action.',
        autoDismissMs: 5000,
      });
      break;

    default:
      // VALIDATION, NOT_FOUND, UNKNOWN — handled elsewhere or silently
      break;
  }
}

/**
 * Display a "New version available" toast with a reload button.
 * Called when a lazy-loaded chunk fails to load (chunk load failure).
 */
export function notifyChunkLoadFailure(): void {
  const toastId = `chunk_${Date.now()}`;

  dispatchToast({
    id: toastId,
    type: 'info',
    title: 'New Version Available',
    message: 'A new version of the application is available. Please reload to update.',
    autoDismissMs: null, // Persistent until user reloads
  });

  // Also dispatch a custom event for UI components to render a reload button
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('chunk-load-failure', {
        detail: { toastId, action: 'reload' },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Unified error handler
// ---------------------------------------------------------------------------

/**
 * Handle an error end-to-end: classify → report → notify.
 * This is the primary entry point for error handling outside of ErrorBoundary.
 */
export function handleError(
  error: AppError,
  options?: { feature?: string; onRetry?: () => void },
): ErrorReport {
  // Report to telemetry
  const report = reportError(error, options?.feature);

  // Display toast notification
  notifyError(error, { onRetry: options?.onRetry });

  return report;
}
