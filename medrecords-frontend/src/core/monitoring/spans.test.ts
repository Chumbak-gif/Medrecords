/**
 * Tests for API call telemetry spans.
 *
 * Requirements: 6.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpanStatusCode } from '@opentelemetry/api';

// Mock the telemetry module
const mockStartSpan = vi.fn();
const mockSetAttribute = vi.fn();
const mockSetStatus = vi.fn();
const mockRecordException = vi.fn();
const mockEnd = vi.fn();

const mockSpan = {
  setAttribute: mockSetAttribute,
  setStatus: mockSetStatus,
  recordException: mockRecordException,
  end: mockEnd,
};

vi.mock('./telemetry', () => ({
  getTracer: () => ({
    startSpan: (...args: unknown[]) => {
      mockStartSpan(...args);
      return mockSpan;
    },
  }),
}));

import { startApiSpan, recordApiSpan } from './spans';

describe('spans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startApiSpan', () => {
    it('creates a span with HTTP method and URL attributes', () => {
      startApiSpan({ method: 'GET', url: '/api/patients' });

      expect(mockStartSpan).toHaveBeenCalledWith(
        'HTTP GET /api/patients',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'http.method': 'GET',
            'http.url': '/api/patients',
          }),
        }),
      );
    });

    it('includes correlationId in span attributes when provided', () => {
      startApiSpan({ method: 'POST', url: '/api/assessments', correlationId: 'corr-123' });

      expect(mockStartSpan).toHaveBeenCalledWith(
        'HTTP POST /api/assessments',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'http.correlation_id': 'corr-123',
          }),
        }),
      );
    });

    it('end function records duration and status on success', () => {
      const { end } = startApiSpan({ method: 'GET', url: '/api/patients' });

      end({ status: 200 });

      expect(mockSetAttribute).toHaveBeenCalledWith('http.duration_ms', expect.any(Number));
      expect(mockSetAttribute).toHaveBeenCalledWith('http.status_code', 200);
      expect(mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockEnd).toHaveBeenCalled();
    });

    it('end function records error status for 4xx/5xx', () => {
      const { end } = startApiSpan({ method: 'PUT', url: '/api/patients/1' });

      end({ status: 404 });

      expect(mockSetStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'HTTP 404',
      });
      expect(mockEnd).toHaveBeenCalled();
    });

    it('end function records exception for errors', () => {
      const { end } = startApiSpan({ method: 'GET', url: '/api/data' });
      const error = new Error('Network failure');

      end({ status: 0, error });

      expect(mockSetStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Network failure',
      });
      expect(mockRecordException).toHaveBeenCalledWith(error);
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('recordApiSpan', () => {
    it('creates and immediately ends a span for completed requests', () => {
      recordApiSpan('GET', '/api/patients', 150, 200, 'corr-456');

      expect(mockStartSpan).toHaveBeenCalledWith(
        'HTTP GET /api/patients',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'http.method': 'GET',
            'http.url': '/api/patients',
            'http.status_code': 200,
            'http.duration_ms': 150,
            'http.correlation_id': 'corr-456',
          }),
        }),
      );
      expect(mockSetStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockEnd).toHaveBeenCalled();
    });

    it('records error status for failed requests', () => {
      recordApiSpan('POST', '/api/patients', 2000, 500);

      expect(mockSetStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'HTTP 500',
      });
    });
  });
});
