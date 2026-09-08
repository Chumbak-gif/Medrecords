/**
 * Unit tests for the core API client.
 *
 * Tests cover:
 * - Token store (getToken/setToken)
 * - Correlation ID generation (UUID v4 format)
 * - Request interceptor: auth header attachment
 * - Request interceptor: skipAuth omits Authorization
 * - Request interceptor: AUTHENTICATION error when no token
 * - Response interceptor: 401 triggers token refresh + retry once
 * - Response interceptor: already retried 401 is not retried again
 * - createApiClient factory
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';
import {
  getToken,
  setToken,
  generateCorrelationId,
  createApiClient,
} from './apiClient';

// UUID v4 regex pattern
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Token Store', () => {
  beforeEach(() => {
    setToken(null);
  });

  it('returns null when no token is set', () => {
    expect(getToken()).toBeNull();
  });

  it('stores and retrieves a token', () => {
    setToken('test-jwt-token');
    expect(getToken()).toBe('test-jwt-token');
  });

  it('clears token when set to null', () => {
    setToken('some-token');
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe('generateCorrelationId', () => {
  it('produces a valid UUID v4 string', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('produces unique values across multiple calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateCorrelationId()));
    expect(ids.size).toBe(100);
  });
});

describe('createApiClient', () => {
  let mockAdapter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setToken(null);
    // Create a mock adapter for axios
    mockAdapter = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createTestClient() {
    const client = createApiClient({
      baseURL: 'http://test-api.local',
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
    });
    // Replace the adapter with our mock
    client.defaults.adapter = mockAdapter;
    return client;
  }

  describe('Request Interceptor', () => {
    it('attaches Bearer token when token is available', async () => {
      setToken('my-jwt-token');
      const client = createTestClient();

      mockAdapter.mockResolvedValueOnce({
        status: 200,
        data: { ok: true },
        headers: {},
        config: {},
      });

      await client.get('/test');

      const requestConfig = mockAdapter.mock.calls[0][0];
      expect(requestConfig.headers.get('Authorization')).toBe('Bearer my-jwt-token');
    });

    it('attaches X-Correlation-ID header as UUID v4', async () => {
      setToken('token');
      const client = createTestClient();

      mockAdapter.mockResolvedValueOnce({
        status: 200,
        data: {},
        headers: {},
        config: {},
      });

      await client.get('/test');

      const requestConfig = mockAdapter.mock.calls[0][0];
      const correlationId = requestConfig.headers.get('X-Correlation-ID');
      expect(correlationId).toMatch(UUID_V4_REGEX);
    });

    it('rejects with AUTHENTICATION error when no token and skipAuth not set', async () => {
      setToken(null);
      const client = createTestClient();

      await expect(client.get('/protected')).rejects.toMatchObject({
        message: 'No authentication token available',
      });

      // Adapter should never be called
      expect(mockAdapter).not.toHaveBeenCalled();
    });

    it('omits Authorization header when skipAuth is true', async () => {
      setToken(null);
      const client = createTestClient();

      mockAdapter.mockResolvedValueOnce({
        status: 200,
        data: {},
        headers: {},
        config: {},
      });

      await client.get('/public', { _skipAuth: true } as never);

      const requestConfig = mockAdapter.mock.calls[0][0];
      expect(requestConfig.headers.has('Authorization')).toBe(false);
    });

    it('still attaches X-Correlation-ID when skipAuth is true', async () => {
      setToken(null);
      const client = createTestClient();

      mockAdapter.mockResolvedValueOnce({
        status: 200,
        data: {},
        headers: {},
        config: {},
      });

      await client.get('/public', { _skipAuth: true } as never);

      const requestConfig = mockAdapter.mock.calls[0][0];
      const correlationId = requestConfig.headers.get('X-Correlation-ID');
      expect(correlationId).toMatch(UUID_V4_REGEX);
    });
  });

  describe('Response Interceptor - 401 Handling', () => {
    it('clears the session token on 401 when refresh is unavailable', async () => {
      setToken('expired-token');
      const client = createTestClient();

      // Request → 401. With no refresh endpoint, the client clears the
      // session and rejects (redirect to login is a browser side-effect).
      mockAdapter.mockRejectedValueOnce(createAxiosError(401, client));

      await expect(client.get('/test')).rejects.toMatchObject({
        response: { status: 401 },
      });

      // Session token is cleared so subsequent requests don't reuse it.
      expect(getToken()).toBeNull();
    });

    it('does not retry if _retried flag is already set', async () => {
      setToken('expired-token');
      const client = createTestClient();

      const error = createAxiosError(401, client);
      // Simulate the _retried flag already being set
      if (error.config) {
        (error.config as Record<string, unknown>)._retried = true;
      }

      mockAdapter.mockRejectedValueOnce(error);

      await expect(client.get('/test')).rejects.toMatchObject({
        response: { status: 401 },
      });

      // Only the original request, no retry
      expect(mockAdapter).toHaveBeenCalledTimes(1);
    });
  });
});

// Helper to create axios-like errors for testing
function createAxiosError(status: number, instance: ReturnType<typeof axios.create>) {
  const config = {
    headers: new axios.AxiosHeaders(),
    url: '/test',
    method: 'get',
  };
  const error = new axios.AxiosError(
    `Request failed with status code ${status}`,
    axios.AxiosError.ERR_BAD_RESPONSE,
    config as never,
    {},
    {
      status,
      statusText: status === 401 ? 'Unauthorized' : 'Error',
      headers: {},
      config: config as never,
      data: {},
    },
  );
  return error;
}
