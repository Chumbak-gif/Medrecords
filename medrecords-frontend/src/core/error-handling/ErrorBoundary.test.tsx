/**
 * Tests for ErrorBoundary component.
 *
 * Validates:
 * - Catches unhandled exceptions in child trees
 * - Displays fallback UI without crashing the app
 * - Supports resetKeys for recovery
 * - Reports errors to telemetry
 *
 * Requirements: 5.1, 5.5
 */

import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary, DefaultErrorFallback } from './ErrorBoundary';
import type { ErrorFallbackProps } from './ErrorBoundary';

// Suppress console.error from React's error boundary logging during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// Helper: A component that throws an error
// ---------------------------------------------------------------------------

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from component');
  }
  return <div>Child rendered successfully</div>;
}

function SimpleFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div>
      <p data-testid="error-message">{error.message}</p>
      <button onClick={resetError}>Reset</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary fallback={SimpleFallback}>
        <div>Normal content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary fallback={SimpleFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Test error from component',
    );
    expect(screen.queryByText('Child rendered successfully')).not.toBeInTheDocument();
  });

  it('does not crash other parts of the application', () => {
    render(
      <div>
        <div data-testid="sibling">Sibling content</div>
        <ErrorBoundary fallback={SimpleFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      </div>,
    );

    // Sibling content outside the boundary remains functional
    expect(screen.getByTestId('sibling')).toHaveTextContent('Sibling content');
    // Fallback is shown inside the boundary
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
  });

  it('calls onError callback when an error is caught', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary fallback={SimpleFallback} onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error from component' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('reports errors to telemetry via custom event', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <ErrorBoundary fallback={SimpleFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    const telemetryEvent = dispatchEventSpy.mock.calls.find(
      (call) => (call[0] as CustomEvent).type === 'error-boundary-catch',
    );

    expect(telemetryEvent).toBeDefined();
    const detail = (telemetryEvent![0] as CustomEvent).detail;
    expect(detail).toMatchObject({
      message: 'Test error from component',
      name: 'Error',
      timestamp: expect.any(String),
    });

    dispatchEventSpy.mockRestore();
  });

  it('resets error state when resetKeys change', () => {
    function TestWrapper() {
      const [key, setKey] = useState(0);
      return (
        <div>
          <button onClick={() => setKey((k) => k + 1)}>Change Key</button>
          <ErrorBoundary fallback={SimpleFallback} resetKeys={[key]}>
            {key === 0 ? (
              <ThrowingComponent shouldThrow={true} />
            ) : (
              <div>Recovered content</div>
            )}
          </ErrorBoundary>
        </div>
      );
    }

    render(<TestWrapper />);

    // Initially shows error fallback
    expect(screen.getByTestId('error-message')).toBeInTheDocument();

    // Change the reset key
    fireEvent.click(screen.getByText('Change Key'));

    // After key change, should reset and render new children
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  it('allows manual reset via resetError callback', () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) {
        throw new Error('Conditional error');
      }
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary fallback={SimpleFallback}>
        <ConditionalThrower />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-message')).toHaveTextContent('Conditional error');

    // Fix the condition and reset
    shouldThrow = false;
    fireEvent.click(screen.getByText('Reset'));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('renders DefaultErrorFallback correctly', () => {
    render(
      <ErrorBoundary fallback={DefaultErrorFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error from component')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
