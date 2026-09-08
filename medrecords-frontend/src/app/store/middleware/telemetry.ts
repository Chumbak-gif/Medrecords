/**
 * Telemetry middleware for Redux store action tracking.
 *
 * Tracks dispatched actions for observability purposes, recording action
 * type, timestamp, and duration. In production, this data would be
 * forwarded to the telemetry collector; in development, it logs to console.
 *
 * Requirements: 4.1
 */

import type { Middleware } from '@reduxjs/toolkit';

export interface ActionTelemetryEntry {
  actionType: string;
  timestamp: string;
  durationMs: number;
}

/**
 * Telemetry middleware that measures action dispatch duration and
 * records it for observability.
 */
export const telemetryMiddleware: Middleware = (_storeAPI) => (next) => (action) => {
  const typedAction = action as { type?: string };
  const actionType = typedAction.type ?? 'unknown';
  const startTime = performance.now();

  const result = next(action);

  const durationMs = performance.now() - startTime;
  const entry: ActionTelemetryEntry = {
    actionType,
    timestamp: new Date().toISOString(),
    durationMs: Math.round(durationMs * 100) / 100,
  };

  // In development, log slow actions (> 16ms ≈ one frame budget)
  if (import.meta.env.DEV && durationMs > 16) {
    console.warn(
      `%c[Telemetry] Slow action: ${actionType} (${entry.durationMs}ms)`,
      'color: #f59e0b;',
    );
  }

  // In production, this would forward to the telemetry collector
  // For now, we emit a custom event that the telemetry system can subscribe to
  if (typeof window !== 'undefined' && !import.meta.env.DEV) {
    window.dispatchEvent(
      new CustomEvent('redux-action-telemetry', { detail: entry }),
    );
  }

  return result;
};
