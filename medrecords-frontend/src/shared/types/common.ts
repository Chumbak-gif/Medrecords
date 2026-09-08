/**
 * Common shared TypeScript types used across the application.
 *
 * Includes RBAC permissions, error classification, structured logging context,
 * and other cross-cutting type definitions.
 */

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'manage';
}

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  category: ErrorCategory;
  message: string;
  code?: string;
  statusCode?: number;
  correlationId?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface LogContext {
  correlationId?: string;
  userId?: number;
  feature?: string;
  action?: string;
  [key: string]: unknown;
}
