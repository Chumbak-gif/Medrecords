/**
 * ErrorBoundary component for catching unhandled exceptions within Feature_Module
 * component trees and displaying fallback UI without crashing the entire application.
 *
 * Features:
 * - Catches unhandled exceptions in child component trees
 * - Displays configurable fallback UI
 * - Supports resetKeys for recovery (re-renders children when keys change)
 * - Reports caught errors to the telemetry system
 *
 * Requirements: 5.1, 5.5
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
}

export interface ErrorBoundaryProps {
  /** Component to render when an error is caught */
  fallback: React.ComponentType<ErrorFallbackProps>;
  /** Callback invoked when an error is caught — reports to telemetry */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Keys that trigger a reset of the error state when they change */
  resetKeys?: unknown[];
  /** Children components to render */
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ---------------------------------------------------------------------------
// Default telemetry reporter
// ---------------------------------------------------------------------------

/**
 * Default error reporting function that dispatches a custom event
 * for the telemetry system to consume. In development, also logs to console.
 */
function reportErrorToTelemetry(error: Error, errorInfo: ErrorInfo): void {
  const errorReport = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
  };

  // Dispatch custom event for telemetry system to subscribe to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('error-boundary-catch', { detail: errorReport }),
    );
  }

  // In development, log to console for visibility
  if (import.meta.env.DEV) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }
}

// ---------------------------------------------------------------------------
// ErrorBoundary Component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Report to telemetry via custom handler or default
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Always report to telemetry system
    reportErrorToTelemetry(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevResetKeys = prevProps.resetKeys ?? [];
      const currentResetKeys = this.props.resetKeys;

      const hasChanged =
        prevResetKeys.length !== currentResetKeys.length ||
        currentResetKeys.some((key, index) => key !== prevResetKeys[index]);

      if (hasChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Default Fallback UI
// ---------------------------------------------------------------------------

/**
 * A sensible default fallback UI for use with ErrorBoundary.
 * Displays error message and a retry button.
 */
export function DefaultErrorFallback({
  error,
  resetError,
}: ErrorFallbackProps): ReactNode {
  return (
    <div
      role="alert"
      style={{
        padding: '2rem',
        margin: '1rem',
        border: '1px solid #e53e3e',
        borderRadius: '8px',
        backgroundColor: '#fff5f5',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h2 style={{ color: '#c53030', margin: '0 0 0.5rem 0' }}>
        Something went wrong
      </h2>
      <p style={{ color: '#742a2a', margin: '0 0 1rem 0' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={resetError}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#e53e3e',
          color: '#ffffff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
