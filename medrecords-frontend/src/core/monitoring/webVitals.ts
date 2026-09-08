/**
 * Web Vitals monitoring and route navigation spans.
 *
 * Tracks LCP, FID, CLS, TTFB, INP metrics and exports them to the
 * configured collector endpoint via OpenTelemetry spans.
 * Also records route navigation spans with source and destination routes.
 *
 * Requirements: 6.4, 6.5
 */

import { type Metric, onLCP, onCLS, onTTFB, onINP } from 'web-vitals';
import { SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { getTracer } from './telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebVitalsMetrics {
  lcp?: number;
  cls?: number;
  ttfb?: number;
  inp?: number;
}

export interface NavigationSpanOptions {
  source: string;
  destination: string;
}

// ---------------------------------------------------------------------------
// Tracer instance
// ---------------------------------------------------------------------------

let vitalsTracer: Tracer | null = null;

function getVitalsTracer(): Tracer {
  if (!vitalsTracer) {
    vitalsTracer = getTracer('medrecords-web-vitals', '0.1.0');
  }
  return vitalsTracer;
}

// ---------------------------------------------------------------------------
// Web Vitals collection
// ---------------------------------------------------------------------------

/**
 * Report a single Web Vital metric as an OpenTelemetry span.
 */
function reportMetric(metric: Metric): void {
  const tracer = getVitalsTracer();
  const span = tracer.startSpan(`web-vital.${metric.name}`, {
    attributes: {
      'web_vital.name': metric.name,
      'web_vital.value': metric.value,
      'web_vital.rating': metric.rating,
      'web_vital.id': metric.id,
      'web_vital.navigation_type': metric.navigationType ?? 'unknown',
    },
  });
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * Initialize Web Vitals monitoring.
 *
 * Registers callbacks for LCP, FID, CLS, TTFB, and INP metrics.
 * Each metric is recorded as an OpenTelemetry span when reported by the browser.
 */
export function initWebVitals(): void {
  onLCP(reportMetric);
  onCLS(reportMetric);
  onTTFB(reportMetric);
  onINP(reportMetric);
}

// ---------------------------------------------------------------------------
// Route navigation spans
// ---------------------------------------------------------------------------

/**
 * Record a route navigation as a trace span.
 *
 * @param options - Source and destination routes
 */
export function recordNavigationSpan(options: NavigationSpanOptions): void {
  const tracer = getVitalsTracer();
  const span = tracer.startSpan('route.navigation', {
    attributes: {
      'route.source': options.source,
      'route.destination': options.destination,
    },
  });
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}
