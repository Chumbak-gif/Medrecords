/**
 * Tests for PII URL Guard utility.
 */

import { describe, it, expect } from 'vitest';
import { checkUrlForPii, isValidPatientRoute, sanitizeUrlPii } from './piiUrlGuard';

describe('piiUrlGuard', () => {
  describe('checkUrlForPii', () => {
    it('should flag email addresses in URLs', () => {
      const result = checkUrlForPii('/patients?email=john@example.com');
      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should flag patient name parameters', () => {
      const result = checkUrlForPii('/patients?firstName=John&lastName=Doe');
      expect(result.safe).toBe(false);
    });

    it('should flag date of birth parameters', () => {
      const result = checkUrlForPii('/patients?dateOfBirth=1990-01-01');
      expect(result.safe).toBe(false);
    });

    it('should flag contact number parameters', () => {
      const result = checkUrlForPii('/patients?contactNumber=+1234567890');
      expect(result.safe).toBe(false);
    });

    it('should pass safe URLs with numeric IDs', () => {
      const result = checkUrlForPii('/patients/123');
      expect(result.safe).toBe(true);
    });

    it('should pass safe list URLs', () => {
      const result = checkUrlForPii('/patients?page=1&pageSize=20');
      expect(result.safe).toBe(true);
    });
  });

  describe('isValidPatientRoute', () => {
    it('should accept /patients', () => {
      expect(isValidPatientRoute('/patients')).toBe(true);
    });

    it('should accept /patients/123', () => {
      expect(isValidPatientRoute('/patients/123')).toBe(true);
    });

    it('should accept /patients/new', () => {
      expect(isValidPatientRoute('/patients/new')).toBe(true);
    });

    it('should accept /patients/123/assessments', () => {
      expect(isValidPatientRoute('/patients/123/assessments')).toBe(true);
    });

    it('should reject /patients/john-doe', () => {
      expect(isValidPatientRoute('/patients/john-doe')).toBe(false);
    });

    it('should reject /patients/abc', () => {
      expect(isValidPatientRoute('/patients/abc')).toBe(false);
    });
  });

  describe('sanitizeUrlPii', () => {
    it('should remove PII query parameters', () => {
      const url = '/patients?page=1&firstName=John&email=john@test.com';
      const sanitized = sanitizeUrlPii(url);
      expect(sanitized).not.toContain('firstName');
      expect(sanitized).not.toContain('email');
      expect(sanitized).toContain('page=1');
    });

    it('should preserve non-PII parameters', () => {
      const url = '/patients?page=1&pageSize=20&sortBy=createdAt';
      const sanitized = sanitizeUrlPii(url);
      expect(sanitized).toContain('page=1');
      expect(sanitized).toContain('pageSize=20');
      expect(sanitized).toContain('sortBy=createdAt');
    });
  });
});
