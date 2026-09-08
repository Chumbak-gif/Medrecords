/**
 * Form error mapper for server validation errors.
 *
 * Maps HTTP 422 field errors from the server to form field paths,
 * enabling inline error messages adjacent to each invalid field.
 *
 * Supports:
 * - FastAPI-style validation errors: { detail: [{ loc: [...], msg, type }] }
 * - Generic field errors: { errors: { fieldName: string[] } }
 * - Nested field paths (dot notation): "address.city" → { address: { city: ... } }
 *
 * Requirements: 5.3
 */

import { ErrorCategory, type AppError } from '@/shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Server validation error as returned in response body.
 */
export interface ServerFieldError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/**
 * Mapped form errors keyed by field path (dot notation for nested fields).
 * Each field may have one or more error messages.
 */
export type FormFieldErrors = Record<string, string[]>;

/**
 * Flat form errors with a single message per field (for react-hook-form setError).
 */
export type FlatFormErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Extract validation errors from AppError
// ---------------------------------------------------------------------------

/**
 * Determines if an AppError is a validation error with field-level details.
 */
export function isValidationError(error: AppError): boolean {
  return error.category === ErrorCategory.VALIDATION;
}

/**
 * Extract field errors from an AppError that was classified as VALIDATION.
 * Returns null if no field-level errors are available.
 */
export function extractFieldErrors(error: AppError): FormFieldErrors | null {
  if (!isValidationError(error)) {
    return null;
  }

  const validationErrors = error.context?.validationErrors as
    | Record<string, string[]>
    | undefined;

  if (validationErrors && typeof validationErrors === 'object') {
    return validationErrors;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Map server response to form errors
// ---------------------------------------------------------------------------

/**
 * Maps a FastAPI-style validation response body to form field errors.
 *
 * FastAPI returns: { detail: [{ loc: ["body", "fieldName"], msg: "...", type: "..." }] }
 * This function maps each loc to a dot-notation field path, skipping the "body" prefix.
 */
export function mapFastApiErrors(detail: ServerFieldError[]): FormFieldErrors {
  const errors: FormFieldErrors = {};

  for (const item of detail) {
    if (!Array.isArray(item.loc) || !item.msg) {
      continue;
    }

    // FastAPI loc typically starts with "body", skip it
    const loc = item.loc.filter(
      (segment) => segment !== 'body' && segment !== 'query' && segment !== 'path',
    );

    // Build dot-notation field path
    const fieldPath = loc.length > 0 ? loc.join('.') : 'general';

    if (!errors[fieldPath]) {
      errors[fieldPath] = [];
    }
    errors[fieldPath].push(item.msg);
  }

  return errors;
}

/**
 * Maps a generic server error response body to form field errors.
 * Supports multiple formats:
 * - { detail: [{ loc, msg, type }] } — FastAPI
 * - { errors: { field: string[] } } — Generic
 * - { errors: { field: string } } — Single message per field
 */
export function mapServerErrors(responseData: unknown): FormFieldErrors | null {
  if (!responseData || typeof responseData !== 'object') {
    return null;
  }

  const data = responseData as Record<string, unknown>;

  // FastAPI-style: { detail: [{ loc, msg, type }] }
  if (Array.isArray(data.detail)) {
    const fastApiErrors = data.detail.filter(
      (item): item is ServerFieldError =>
        typeof item === 'object' &&
        item !== null &&
        'loc' in item &&
        'msg' in item,
    );

    if (fastApiErrors.length > 0) {
      return mapFastApiErrors(fastApiErrors);
    }
  }

  // Generic: { errors: { field: string[] | string } }
  if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
    const errors: FormFieldErrors = {};
    const fieldMap = data.errors as Record<string, unknown>;

    for (const [field, messages] of Object.entries(fieldMap)) {
      if (Array.isArray(messages)) {
        errors[field] = messages.filter((m): m is string => typeof m === 'string');
      } else if (typeof messages === 'string') {
        errors[field] = [messages];
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Flatten errors for form libraries
// ---------------------------------------------------------------------------

/**
 * Flatten FormFieldErrors to a single message per field (first error wins).
 * Useful for react-hook-form's setError which expects one message per field.
 */
export function flattenFormErrors(errors: FormFieldErrors): FlatFormErrors {
  const flat: FlatFormErrors = {};

  for (const [field, messages] of Object.entries(errors)) {
    if (messages.length > 0) {
      flat[field] = messages[0];
    }
  }

  return flat;
}

/**
 * Apply server validation errors to a react-hook-form setError function.
 * Maps each field error to the corresponding form field.
 */
export function applyServerErrorsToForm(
  errors: FormFieldErrors,
  setError: (field: string, error: { type: string; message: string }) => void,
): void {
  for (const [field, messages] of Object.entries(errors)) {
    if (messages.length > 0) {
      setError(field, {
        type: 'server',
        message: messages[0],
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience: extract and map from AppError in one step
// ---------------------------------------------------------------------------

/**
 * Extract form field errors from an AppError.
 * Returns null if the error is not a validation error or has no field details.
 */
export function getFormErrorsFromAppError(error: AppError): FormFieldErrors | null {
  return extractFieldErrors(error);
}
