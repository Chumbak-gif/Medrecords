/**
 * API call telemetry spans.
 *
 * Instruments the API client to create a trace span per request with:
 * - HTTP method
 * - URL
 * - Duration
 * - Response status
 *
 * Uses OpenTelemetry trace API via the telemetry module.
 *
 * Requirements: 6.2
 */

import { SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';
import { getTracer } from './telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpanAttributes {
  'http.method': string;
  'http.url': string;
  'http.status_code'?: number;
  'http.duration_ms'?: number;
  'http.correlation_id'?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ApiSpanOptions {
  method: string;
  url: string;
  correlationId?: string;
}

// ---------------------------------------------------------------------------
// Tracer instance
// ---------------------------------------------------------------------------

let apiTracer: Tracer | null = null;

function getApiTracer(): Tracer {
  if (!apiTracer) {
    apiTracer = getTracer('medrecords-api-client', '0.1.0');
  }
  return apiTracer;
}

// ---------------------------------------------------------------------------
// Span management
// ---------------------------------------------------------------------------

/**
 * Start a new API call span. Returns the span and a function to end it.
 *
 * Usage:
 *   const { span, end } = startApiSpan({ method: 'GET', url: '/api/patients' });
 *   try {
 *     const response = await fetch(...);
 *     end({ status: 200 });
 *   } catch (error) {
 *     end({ status: 0, error });
 *   }
 */
export function startApiSpan(options: ApiSpanOptions): {
  span: Span;
  end: (result: { status?: number; error?: Error }) => void;
} {
  const tracer = getApiTracer();
  const startTime = performance.now();

  const span = tracer.startSpan(`HTTP ${options.method} ${options.url}`, {
    attributes: {
      'http.method': options.method,
      'http.url': options.url,
      ...(options.correlationId && { 'http.correlation_id': options.correlationId }),
    },
  });

  const end = (result: { status?: number; error?: Error }): void => {
    const duration = performance.now() - startTime;

    span.setAttribute('http.duration_ms', Math.round(duration));

    if (result.status !== undefined) {
      span.setAttribute('http.status_code', result.status);
    }

    if (result.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.error.message,
      });
      span.recordException(result.error);
    } else if (result.status && result.status >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${result.status}`,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  };

  return { span, end };
}

/**
 * Create and immediately record a completed API span.
 * Useful for recording a span after the request has already completed.
 */
export function recordApiSpan(
  method: string,
  url: string,
  durationMs: number,
  status: number,
  correlationId?: string,
): void {
  const tracer = getApiTracer();

  const span = tracer.startSpan(`HTTP ${method} ${url}`, {
    attributes: {
      'http.method': method,
      'http.url': url,
      'http.status_code': status,
      'http.duration_ms': Math.round(durationMs),
      ...(correlationId && { 'http.correlation_id': correlationId }),
    },
  });

  if (status >= 400) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `HTTP ${status}`,
    });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  span.end();
}

/**
 * Axios interceptor-compatible function that creates telemetry spans.
 * Attach to Axios request/response interceptors for automatic instrumentation.
 *
 * Returns a pair of interceptor handlers:
 * - requestInterceptor: records start time in request config
 * - responseInterceptor: records the completed span
 * - errorInterceptor: records the error span
 */
export function createAxiosSpanInterceptors() {
  const pendingSpans = new Map<string, { span: Span; end: (result: { status?: number; error?: Error }) => void }>();

  return {
    /**
     * Request interceptor: start a span for each outgoing request.
     */
    requestInterceptor(config: Record<string, unknown>): Record<string, unknown> {
      const method = ((config.method as string) ?? 'GET').toUpperCase();
      const url = (config.url as string) ?? '/';
      const correlationId = getCorrelationIdFromConfig(config);

      const { span, end } = startApiSpan({ method, url, correlationId });

      // Store the span reference using correlation ID as key
      if (correlationId) {
        pendingSpans.set(correlationId, { span, end });
      }

      // Attach span reference to config for response interceptor
      (config as Record<string, unknown>).__spanEnd = end;
      (config as Record<string, unknown>).__spanCorrelationId = correlationId;

      return config;
    },

    /**
     * Response interceptor: end the span with success status.
     */
    responseInterceptor(response: Record<string, unknown>): Record<string, unknown> {
      const config = (response as { config?: Record<string, unknown> }).config;
      const endFn = config?.__spanEnd as ((result: { status?: number; error?: Error }) => void) | undefined;
      const correlationId = config?.__spanCorrelationId as string | undefined;

      if (endFn) {
        const status = (response as { status?: number }).status ?? 200;
        endFn({ status });
      }

      // Clean up
      if (correlationId) {
        pendingSpans.delete(correlationId);
      }

      return response;
    },

    /**
     * Error interceptor: end the span with error status.
     */
    errorInterceptor(error: Record<string, unknown>): never {
      const config = (error as { config?: Record<string, unknown> }).config;
      const endFn = config?.__spanEnd as ((result: { status?: number; error?: Error }) => void) | undefined;
      const correlationId = config?.__spanCorrelationId as string | undefined;

      if (endFn) {
        const status = ((error as { response?: { status?: number } }).response?.status) ?? 0;
        const errorObj = error instanceof Error ? error : new Error(String((error as { message?: string }).message ?? 'Request failed'));
        endFn({ status, error: errorObj });
      }

      // Clean up
      if (correlationId) {
        pendingSpans.delete(correlationId);
      }

      throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCorrelationIdFromConfig(config: Record<string, unknown>): string | undefined {
  const headers = config.headers as Record<string, unknown> | undefined;
  if (headers) {
    return (headers['X-Correlation-ID'] as string) ?? undefined;
  }
  return undefined;
}
