/**
 * Tests for the error reporter and notification system.
 *
 * Requirements: 5.2, 5.4, 5.5, 5.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCategory, type AppError } from '@/shared/types';

// Mock the store before importing errorReporter
vi.mock('@/app/store', () => {
  const mockDispatch = vi.fn();
  return {
    store: {
      dispatch: mockDispatch,
      getState: () => ({
        auth: { user: { id: 42 } },
      }),
    },
  };
});

vi.mock('@/app/store/notificationsSlice', () => ({
  addNotification: vi.fn((payload) => ({ type: 'notifications/addNotification', payload })),
}));

import {
  reportError,
  notifyError,
  notifyChunkLoadFailure,
  handleError,
  isChunkLoadError,
} from './errorReporter';
import { store } from '@/app/store';

describe('errorReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/patients/123' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isChunkLoadError', () => {
    it('detects "Loading chunk" errors', () => {
      const error = new Error('Loading chunk 5 failed');
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('detects "dynamically imported module" errors', () => {
      const error = new Error('Failed to fetch dynamically imported module: /assets/chunk.js');
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('returns false for regular errors', () => {
      const error = new Error('Something went wrong');
      expect(isChunkLoadError(error)).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(isChunkLoadError('string error')).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
    });
  });

  describe('reportError', () => {
    it('creates an ErrorReport with all required fields', () => {
      const error: AppError = {
        category: ErrorCategory.SERVER,
        message: 'Internal server error',
        correlationId: 'abc-123',
        timestamp: '2024-01-15T10:00:00.000Z',
        statusCode: 500,
      };

      const report = reportError(error, 'patients');

      expect(report.correlationId).toBe('abc-123');
      expect(report.category).toBe(ErrorCategory.SERVER);
      expect(report.message).toBe('Internal server error');
      expect(report.timestamp).toBe('2024-01-15T10:00:00.000Z');
      expect(report.userId).toBe(42);
      expect(report.route).toBe('/patients/123');
      expect(report.feature).toBe('patients');
      expect(report.statusCode).toBe(500);
    });

    it('extracts feature from route if not provided', () => {
      const error: AppError = {
        category: ErrorCategory.NETWORK,
        message: 'Connection lost',
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      const report = reportError(error);
      expect(report.feature).toBe('patients');
    });

    it('dispatches a custom event for telemetry', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      const error: AppError = {
        category: ErrorCategory.NETWORK,
        message: 'Connection lost',
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      reportError(error);

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error-report' }),
      );
    });
  });

  describe('notifyError', () => {
    it('dispatches a connection toast for NETWORK errors', () => {
      const error: AppError = {
        category: ErrorCategory.NETWORK,
        message: 'Connection refused',
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      notifyError(error);

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            type: 'error',
            title: 'Connection Lost',
            autoDismissMs: null,
          }),
        }),
      );
    });

    it('dispatches a server error toast with correlation ID', () => {
      const error: AppError = {
        category: ErrorCategory.SERVER,
        message: 'Internal error',
        correlationId: 'corr-456',
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      notifyError(error);

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            type: 'error',
            title: 'Server Error',
            message: expect.stringContaining('corr-456'),
          }),
        }),
      );
    });

    it('does not dispatch toast for VALIDATION errors', () => {
      const error: AppError = {
        category: ErrorCategory.VALIDATION,
        message: 'Invalid input',
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      notifyError(error);

      expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('dispatches session expired toast for AUTHENTICATION errors', () => {
      const error: AppError = {
        category: ErrorCategory.AUTHENTICATION,
        message: 'Token expired',
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      notifyError(error);

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            type: 'warning',
            title: 'Session Expired',
          }),
        }),
      );
    });
  });

  describe('notifyChunkLoadFailure', () => {
    it('dispatches a "New Version Available" toast', () => {
      notifyChunkLoadFailure();

      expect(store.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            type: 'info',
            title: 'New Version Available',
            autoDismissMs: null,
          }),
        }),
      );
    });

    it('dispatches chunk-load-failure custom event', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      notifyChunkLoadFailure();

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'chunk-load-failure' }),
      );
    });
  });

  describe('handleError', () => {
    it('reports and notifies in one call', () => {
      const error: AppError = {
        category: ErrorCategory.SERVER,
        message: 'Server error',
        correlationId: 'abc-789',
        timestamp: '2024-01-15T10:00:00.000Z',
        statusCode: 500,
      };

      const report = handleError(error, { feature: 'dashboard' });

      expect(report.correlationId).toBe('abc-789');
      expect(report.feature).toBe('dashboard');
      expect(store.dispatch).toHaveBeenCalled();
    });
  });
});
