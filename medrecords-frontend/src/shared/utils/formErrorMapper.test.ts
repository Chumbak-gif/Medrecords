/**
 * Tests for form error mapper.
 *
 * Requirements: 5.3
 */

import { describe, it, expect } from 'vitest';
import { ErrorCategory, type AppError } from '@/shared/types';
import {
  isValidationError,
  extractFieldErrors,
  mapFastApiErrors,
  mapServerErrors,
  flattenFormErrors,
  applyServerErrorsToForm,
  getFormErrorsFromAppError,
} from './formErrorMapper';

describe('formErrorMapper', () => {
  describe('isValidationError', () => {
    it('returns true for VALIDATION category', () => {
      const error: AppError = {
        category: ErrorCategory.VALIDATION,
        message: 'Validation error',
        timestamp: '2024-01-15T10:00:00.000Z',
      };
      expect(isValidationError(error)).toBe(true);
    });

    it('returns false for other categories', () => {
      const error: AppError = {
        category: ErrorCategory.SERVER,
        message: 'Server error',
        timestamp: '2024-01-15T10:00:00.000Z',
      };
      expect(isValidationError(error)).toBe(false);
    });
  });

  describe('extractFieldErrors', () => {
    it('extracts validationErrors from context', () => {
      const error: AppError = {
        category: ErrorCategory.VALIDATION,
        message: 'Validation error',
        timestamp: '2024-01-15T10:00:00.000Z',
        context: {
          validationErrors: {
            firstName: ['Field is required'],
            email: ['Invalid email format'],
          },
        },
      };

      const result = extractFieldErrors(error);
      expect(result).toEqual({
        firstName: ['Field is required'],
        email: ['Invalid email format'],
      });
    });

    it('returns null for non-validation errors', () => {
      const error: AppError = {
        category: ErrorCategory.NETWORK,
        message: 'Network error',
        timestamp: '2024-01-15T10:00:00.000Z',
      };
      expect(extractFieldErrors(error)).toBeNull();
    });

    it('returns null if no validationErrors in context', () => {
      const error: AppError = {
        category: ErrorCategory.VALIDATION,
        message: 'Validation error',
        timestamp: '2024-01-15T10:00:00.000Z',
        context: {},
      };
      expect(extractFieldErrors(error)).toBeNull();
    });
  });

  describe('mapFastApiErrors', () => {
    it('maps FastAPI-style errors to field paths', () => {
      const detail = [
        { loc: ['body', 'firstName'], msg: 'Field is required', type: 'value_error.missing' },
        { loc: ['body', 'email'], msg: 'Invalid email', type: 'value_error' },
      ];

      const result = mapFastApiErrors(detail);
      expect(result).toEqual({
        firstName: ['Field is required'],
        email: ['Invalid email'],
      });
    });

    it('handles nested field paths', () => {
      const detail = [
        { loc: ['body', 'address', 'city'], msg: 'City is required', type: 'value_error.missing' },
      ];

      const result = mapFastApiErrors(detail);
      expect(result).toEqual({
        'address.city': ['City is required'],
      });
    });

    it('strips body/query/path prefixes', () => {
      const detail = [
        { loc: ['query', 'page'], msg: 'Invalid page', type: 'type_error.integer' },
      ];

      const result = mapFastApiErrors(detail);
      expect(result).toEqual({
        page: ['Invalid page'],
      });
    });

    it('groups multiple errors for same field', () => {
      const detail = [
        { loc: ['body', 'password'], msg: 'Too short', type: 'value_error' },
        { loc: ['body', 'password'], msg: 'Needs uppercase', type: 'value_error' },
      ];

      const result = mapFastApiErrors(detail);
      expect(result).toEqual({
        password: ['Too short', 'Needs uppercase'],
      });
    });
  });

  describe('mapServerErrors', () => {
    it('maps FastAPI-style response data', () => {
      const responseData = {
        detail: [
          { loc: ['body', 'firstName'], msg: 'Required', type: 'value_error' },
        ],
      };

      const result = mapServerErrors(responseData);
      expect(result).toEqual({
        firstName: ['Required'],
      });
    });

    it('maps generic errors format', () => {
      const responseData = {
        errors: {
          firstName: ['Too long'],
          lastName: ['Required'],
        },
      };

      const result = mapServerErrors(responseData);
      expect(result).toEqual({
        firstName: ['Too long'],
        lastName: ['Required'],
      });
    });

    it('handles single string error messages', () => {
      const responseData = {
        errors: {
          email: 'Invalid email format',
        },
      };

      const result = mapServerErrors(responseData);
      expect(result).toEqual({
        email: ['Invalid email format'],
      });
    });

    it('returns null for null/undefined input', () => {
      expect(mapServerErrors(null)).toBeNull();
      expect(mapServerErrors(undefined)).toBeNull();
    });

    it('returns null for unrecognized format', () => {
      expect(mapServerErrors({ message: 'Error' })).toBeNull();
    });
  });

  describe('flattenFormErrors', () => {
    it('takes first error message for each field', () => {
      const errors = {
        firstName: ['Required', 'Too short'],
        email: ['Invalid format'],
      };

      const result = flattenFormErrors(errors);
      expect(result).toEqual({
        firstName: 'Required',
        email: 'Invalid format',
      });
    });

    it('skips fields with empty error arrays', () => {
      const errors = {
        firstName: ['Required'],
        lastName: [],
      };

      const result = flattenFormErrors(errors);
      expect(result).toEqual({
        firstName: 'Required',
      });
    });
  });

  describe('applyServerErrorsToForm', () => {
    it('calls setError for each field with errors', () => {
      const setError = vi.fn();
      const errors = {
        firstName: ['Required'],
        email: ['Invalid format'],
      };

      applyServerErrorsToForm(errors, setError);

      expect(setError).toHaveBeenCalledTimes(2);
      expect(setError).toHaveBeenCalledWith('firstName', {
        type: 'server',
        message: 'Required',
      });
      expect(setError).toHaveBeenCalledWith('email', {
        type: 'server',
        message: 'Invalid format',
      });
    });
  });

  describe('getFormErrorsFromAppError', () => {
    it('extracts field errors from AppError', () => {
      const error: AppError = {
        category: ErrorCategory.VALIDATION,
        message: 'Validation failed',
        timestamp: '2024-01-15T10:00:00.000Z',
        context: {
          validationErrors: {
            name: ['Required'],
          },
        },
      };

      expect(getFormErrorsFromAppError(error)).toEqual({
        name: ['Required'],
      });
    });
  });
});
