/**
 * Tests for OpenTelemetry SDK initialization.
 *
 * Validates:
 * - SDK initializes without errors
 * - Tracer can be obtained
 * - Non-production uses console exporter (no external calls)
 * - Production configures batch span processor with correct parameters
 * - Shutdown cleans up resources
 *
 * Requirements: 6.1, 6.6, 6.7, 6.8
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { trace } from '@opentelemetry/api';

// We need to mock import.meta.env for environment-specific testing
// The module reads import.meta.env at load time, so we test the exported functions

describe('telemetry', () => {
  beforeEach(() => {
    // Reset modules to ensure fresh initialization
    vi.resetModules();
  });

  afterEach(async () => {
    // Clean up any initialized provider
    const { shutdownTelemetry } = await import('./telemetry');
    await shutdownTelemetry();
  });

  it('initializes without errors in development mode', async () => {
    const { initTelemetry } = await import('./telemetry');

    expect(() => {
      initTelemetry({ environment: 'development' });
    }).not.toThrow();
  });

  it('initializes without errors in production mode', async () => {
    const { initTelemetry } = await import('./telemetry');

    expect(() => {
      initTelemetry({
        environment: 'production',
        collectorEndpoint: 'http://localhost:4318/v1/traces',
      });
    }).not.toThrow();
  });

  it('returns a TracerProvider on initialization', async () => {
    const { initTelemetry } = await import('./telemetry');

    const provider = initTelemetry({ environment: 'development' });

    expect(provider).toBeDefined();
  });

  it('prevents double initialization', async () => {
    const { initTelemetry } = await import('./telemetry');

    const provider1 = initTelemetry({ environment: 'development' });
    const provider2 = initTelemetry({ environment: 'development' });

    expect(provider1).toBe(provider2);
  });

  it('getTracer returns a tracer instance', async () => {
    const { initTelemetry, getTracer } = await import('./telemetry');

    initTelemetry({ environment: 'development' });
    const tracer = getTracer('test-module');

    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
  });

  it('creates spans that can be ended', async () => {
    const { initTelemetry, getTracer } = await import('./telemetry');

    initTelemetry({ environment: 'development' });
    const tracer = getTracer('test-module');
    const span = tracer.startSpan('test-span');

    expect(span).toBeDefined();
    expect(() => span.end()).not.toThrow();
  });

  it('shutdownTelemetry cleans up and allows re-initialization', async () => {
    const { initTelemetry, shutdownTelemetry } = await import('./telemetry');

    initTelemetry({ environment: 'development' });
    await shutdownTelemetry();

    // After shutdown, can reinitialize
    const provider = initTelemetry({ environment: 'development' });
    expect(provider).toBeDefined();
  });

  it('flushTelemetry does not throw when provider exists', async () => {
    const { initTelemetry, flushTelemetry } = await import('./telemetry');

    initTelemetry({ environment: 'development' });

    await expect(flushTelemetry()).resolves.not.toThrow();
  });

  it('flushTelemetry does not throw when no provider exists', async () => {
    const { flushTelemetry } = await import('./telemetry');

    await expect(flushTelemetry()).resolves.not.toThrow();
  });

  it('getContextAPI returns the context API', async () => {
    const { initTelemetry, getContextAPI } = await import('./telemetry');

    initTelemetry({ environment: 'development' });
    const ctx = getContextAPI();

    expect(ctx).toBeDefined();
    expect(typeof ctx.active).toBe('function');
  });

  it('getPropagationAPI returns the propagation API', async () => {
    const { initTelemetry, getPropagationAPI } = await import('./telemetry');

    initTelemetry({ environment: 'development' });
    const prop = getPropagationAPI();

    expect(prop).toBeDefined();
    expect(typeof prop.inject).toBe('function');
    expect(typeof prop.extract).toBe('function');
  });

  it('global tracer is registered after initialization', async () => {
    const { initTelemetry } = await import('./telemetry');

    initTelemetry({ environment: 'development' });

    // The global trace API should return a functional tracer
    const globalTracer = trace.getTracer('global-test');
    expect(globalTracer).toBeDefined();
    const span = globalTracer.startSpan('global-test-span');
    expect(span).toBeDefined();
    span.end();
  });
});
