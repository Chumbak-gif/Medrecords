/**
 * OpenTelemetry SDK initialization with trace context propagation.
 *
 * Configures:
 * - WebTracerProvider with OTLP HTTP exporter (production only)
 * - W3C Trace Context propagation to backend
 * - BatchSpanProcessor with 30s export interval or 50-entry batch threshold
 * - Buffer up to 500 entries when collector unreachable
 * - Non-production: console-only logging, no external export
 *
 * Requirements: 6.1, 6.6, 6.7, 6.8
 */

import { type TextMapPropagator, type TracerProvider, trace, context, propagation } from '@opentelemetry/api';
import {
  WebTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  collectorEndpoint?: string;
}

function getDefaultConfig(): TelemetryConfig {
  return {
    serviceName: 'medrecords-frontend',
    serviceVersion: import.meta.env.VITE_APP_VERSION ?? '0.1.0',
    environment: import.meta.env.VITE_ENV ?? 'development',
    collectorEndpoint: import.meta.env.VITE_OTEL_COLLECTOR_URL ?? undefined,
  };
}

function isProduction(config: TelemetryConfig): boolean {
  return config.environment === 'production';
}

// ---------------------------------------------------------------------------
// Provider setup
// ---------------------------------------------------------------------------

let tracerProvider: WebTracerProvider | null = null;

/**
 * Initialize the OpenTelemetry SDK.
 *
 * - In production: sets up OTLP exporter with BatchSpanProcessor
 *   (30s export interval, 50-entry batch threshold, 500-entry buffer)
 * - In non-production: logs spans to console only, no external export
 */
export function initTelemetry(overrideConfig?: Partial<TelemetryConfig>): TracerProvider {
  // Prevent double initialization
  if (tracerProvider) {
    return tracerProvider;
  }

  const config: TelemetryConfig = { ...getDefaultConfig(), ...overrideConfig };

  // Create resource identifying this service
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    'deployment.environment': config.environment,
  });

  // Configure span processor based on environment
  const spanProcessor = createSpanProcessor(config);

  // Create the provider with resource and span processors
  tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
  });

  // Set up W3C Trace Context propagation
  const propagator: TextMapPropagator = new W3CTraceContextPropagator();

  // Register as global tracer provider with Zone.js context manager
  tracerProvider.register({
    contextManager: new ZoneContextManager(),
    propagator,
  });

  return tracerProvider;
}

/**
 * Creates the appropriate SpanProcessor based on environment.
 *
 * Production:
 * - BatchSpanProcessor with OTLP exporter
 * - scheduledDelayMillis: 30_000 (30s export interval)
 * - maxExportBatchSize: 50 (batch threshold)
 * - maxQueueSize: 500 (buffer when collector unreachable)
 *
 * Non-production:
 * - SimpleSpanProcessor with ConsoleSpanExporter (log to console only)
 */
function createSpanProcessor(config: TelemetryConfig): SpanProcessor {
  if (isProduction(config)) {
    const exporter = new OTLPTraceExporter({
      url: config.collectorEndpoint ?? '/v1/traces',
    });

    return new BatchSpanProcessor(exporter, {
      scheduledDelayMillis: 30_000,    // Export every 30 seconds
      maxExportBatchSize: 50,          // Or when batch reaches 50 entries
      maxQueueSize: 500,               // Buffer up to 500 when collector unreachable
      exportTimeoutMillis: 30_000,     // Timeout for export attempts
    });
  }

  // Non-production: console-only logging, no external export
  return new SimpleSpanProcessor(new ConsoleSpanExporter());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a tracer instance for creating spans.
 *
 * @param name - Name of the instrumentation scope (e.g., feature module name)
 * @param version - Optional version of the instrumentation scope
 */
export function getTracer(name: string, version?: string) {
  return trace.getTracer(name, version);
}

/**
 * Get the active context API for propagation.
 */
export function getContextAPI() {
  return context;
}

/**
 * Get the propagation API for injecting/extracting trace context headers.
 */
export function getPropagationAPI() {
  return propagation;
}

/**
 * Shutdown the telemetry system, flushing any pending spans.
 * Call this on application teardown.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
  }
}

/**
 * Force flush any pending spans without shutting down.
 */
export async function flushTelemetry(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.forceFlush();
  }
}
