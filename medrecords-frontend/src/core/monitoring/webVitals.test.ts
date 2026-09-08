/**
 * Tests for Web Vitals monitoring and route navigation spans.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpanStatusCode } from '@opentelemetry/api';

// Mock web-vitals
vi.mock('web-vitals', () => ({
  onLCP: vi.fn(),
  onCLS: vi.fn(),
  onTTFB: vi.fn(),
  onINP: vi.fn(),
}));

const mockSpan = {
  setStatus: vi.fn(),
  setAttribute: vi.fn(),
  end: vi.fn(),
};

const mockTracer = {
  startSpan: vi.fn(() => mockSpan),
};

// Mock the telemetry module
vi.mock('./telemetry', () => ({
  getTracer: vi.fn(() => mockTracer),
}));

import { onLCP, onCLS, onTTFB, onINP } from 'web-vitals';
import { initWebVitals, recordNavigationSpan } from './webVitals';

describe('webVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initWebVitals', () => {
    it('should register callbacks for all web vital metrics', () => {
      initWebVitals();

      expect(onLCP).toHaveBeenCalledWith(expect.any(Function));
      expect(onCLS).toHaveBeenCalledWith(expect.any(Function));
      expect(onTTFB).toHaveBeenCalledWith(expect.any(Function));
      expect(onINP).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should report a metric as a span when callback is invoked', () => {
      initWebVitals();

      // Simulate LCP callback
      const lcpCallback = vi.mocked(onLCP).mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        id: 'lcp-1',
        navigationType: 'navigate',
        delta: 2500,
        entries: [],
      });

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'web-vital.LCP',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'web_vital.name': 'LCP',
            'web_vital.value': 2500,
            'web_vital.rating': 'good',
          }),
        }),
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('recordNavigationSpan', () => {
    it('should create a span with source and destination routes', () => {
      recordNavigationSpan({
        source: '/patients',
        destination: '/patients/123',
      });

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'route.navigation',
        expect.objectContaining({
          attributes: {
            'route.source': '/patients',
            'route.destination': '/patients/123',
          },
        }),
      );
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });
});
