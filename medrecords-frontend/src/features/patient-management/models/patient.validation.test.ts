/**
 * Tests for patient Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import { patientSchema } from './patient.validation';

describe('patientSchema', () => {
  const validPatient = {
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-05-15',
    gender: 'male' as const,
    contactNumber: '+1234567890',
    email: 'john@example.com',
  };

  it('should accept valid patient data', () => {
    const result = patientSchema.safeParse(validPatient);
    expect(result.success).toBe(true);
  });

  it('should accept valid patient data without email', () => {
    const { email, ...withoutEmail } = validPatient;
    const result = patientSchema.safeParse(withoutEmail);
    expect(result.success).toBe(true);
  });

  describe('firstName', () => {
    it('should reject empty firstName', () => {
      const result = patientSchema.safeParse({ ...validPatient, firstName: '' });
      expect(result.success).toBe(false);
    });

    it('should reject firstName over 100 characters', () => {
      const result = patientSchema.safeParse({ ...validPatient, firstName: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should accept firstName at 100 characters', () => {
      const result = patientSchema.safeParse({ ...validPatient, firstName: 'a'.repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe('lastName', () => {
    it('should reject empty lastName', () => {
      const result = patientSchema.safeParse({ ...validPatient, lastName: '' });
      expect(result.success).toBe(false);
    });

    it('should reject lastName over 100 characters', () => {
      const result = patientSchema.safeParse({ ...validPatient, lastName: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });
  });

  describe('dateOfBirth', () => {
    it('should reject future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = patientSchema.safeParse({
        ...validPatient,
        dateOfBirth: futureDate.toISOString().split('T')[0],
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = patientSchema.safeParse({ ...validPatient, dateOfBirth: '15-05-1990' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid dates like Feb 30', () => {
      const result = patientSchema.safeParse({ ...validPatient, dateOfBirth: '2023-02-30' });
      expect(result.success).toBe(false);
    });

    it('should accept valid past date', () => {
      const result = patientSchema.safeParse({ ...validPatient, dateOfBirth: '2000-01-01' });
      expect(result.success).toBe(true);
    });
  });

  describe('gender', () => {
    it('should accept male, female, other', () => {
      for (const gender of ['male', 'female', 'other']) {
        const result = patientSchema.safeParse({ ...validPatient, gender });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid gender values', () => {
      const result = patientSchema.safeParse({ ...validPatient, gender: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('contactNumber', () => {
    it('should accept number with + prefix', () => {
      const result = patientSchema.safeParse({ ...validPatient, contactNumber: '+1234567890' });
      expect(result.success).toBe(true);
    });

    it('should accept number without + prefix', () => {
      const result = patientSchema.safeParse({ ...validPatient, contactNumber: '1234567890' });
      expect(result.success).toBe(true);
    });

    it('should accept number with spaces and hyphens', () => {
      const result = patientSchema.safeParse({ ...validPatient, contactNumber: '+1 234-567' });
      expect(result.success).toBe(true);
    });

    it('should reject number less than 7 characters', () => {
      const result = patientSchema.safeParse({ ...validPatient, contactNumber: '12345' });
      expect(result.success).toBe(false);
    });

    it('should reject number more than 15 characters', () => {
      const result = patientSchema.safeParse({ ...validPatient, contactNumber: '1234567890123456' });
      expect(result.success).toBe(false);
    });
  });

  describe('email', () => {
    it('should accept valid email', () => {
      const result = patientSchema.safeParse({ ...validPatient, email: 'user@domain.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = patientSchema.safeParse({ ...validPatient, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('should accept empty string for optional email', () => {
      const result = patientSchema.safeParse({ ...validPatient, email: '' });
      expect(result.success).toBe(true);
    });
  });
});
