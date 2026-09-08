/**
 * API client configuration.
 *
 * Resolution order for the backend base URL:
 *   1. window.__MEDRECORDS_CONFIG__.apiUrl  — runtime config (public/config.js),
 *      editable on the server after build without rebuilding.
 *   2. VITE_API_URL                          — baked in at build time.
 *   3. http://localhost:8000/api/v1          — dev fallback.
 */

import type { ApiClientConfig } from '@/shared/types';

interface RuntimeConfig {
  apiUrl?: string;
}

declare global {
  interface Window {
    __MEDRECORDS_CONFIG__?: RuntimeConfig;
  }
}

function resolveBaseUrl(): string {
  const runtime =
    typeof window !== 'undefined' ? window.__MEDRECORDS_CONFIG__?.apiUrl : undefined;
  // Ignore an unset/placeholder runtime value.
  if (runtime && runtime.trim() && !runtime.includes('__API_URL__')) {
    return runtime.trim();
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
}

export const apiConfig: ApiClientConfig = {
  baseURL: resolveBaseUrl(),
  timeout: 30_000,
  retryAttempts: 3,
  retryDelay: 1000,
};
