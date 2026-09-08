/**
 * Patient Zod validation schemas.
 *
 * Validates patient form data with:
 * - firstName/lastName: non-empty, max 100 characters
 * - dateOfBirth: valid ISO 8601 date string (YYYY-MM-DD), not in the future
 * - gender: enum (male, female, other)
 * - contactNumber: 7-15 digits with optional leading "+" prefix, allowing digits, spaces, and hyphens
 * - email: optional, valid email format
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6
 */

import { z } from 'zod';

/**
 * Validates that a date string is a valid ISO 8601 date (YYYY-MM-DD)
 * and is not in the future.
 */
function isValidPastDate(value: string): boolean {
  // Must match YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return false;
  }

  const date = new Date(value);
  // Check the date is valid (not NaN)
  if (isNaN(date.getTime())) {
    return false;
  }

  // Ensure the parsed date matches the input (handles invalid dates like 2023-02-30)
  const [year, month, day] = value.split('-').map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  // Must not be in the future
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}

/**
 * Contact number pattern:
 * - Optional leading "+"
 * - 7-15 characters total of digits, spaces, and hyphens
 * - Must contain between 7 and 15 digits
 */
const CONTACT_NUMBER_REGEX = /^\+?[\d\s-]{7,15}$/;

/**
 * Zod schema for patient registration/update form.
 */
export const patientSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be at most 100 characters'),
  dateOfBirth: z
    .string()
    .refine(isValidPastDate, {
      message: 'Date of birth must be a valid date in YYYY-MM-DD format and not in the future',
    }),
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' }),
  }),
  contactNumber: z
    .string()
    .regex(CONTACT_NUMBER_REGEX, 'Contact number must be 7-15 characters with optional + prefix, digits, spaces, and hyphens'),
  email: z
    .string()
    .email('Email must be a valid email address')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500, 'Address must be at most 500 characters').optional(),
  medicalRecordNumber: z
    .string()
    .min(1, 'Medical record number is required')
    .max(50, 'Medical record number must be at most 50 characters')
    .optional(),
});

/**
 * TypeScript type inferred from the patient schema.
 */
export type PatientFormData = z.infer<typeof patientSchema>;

/**
 * Schema for patient creation (medical record number required).
 */
export const patientCreateSchema = patientSchema.extend({
  medicalRecordNumber: z
    .string()
    .min(1, 'Medical record number is required')
    .max(50, 'Medical record number must be at most 50 characters'),
});

export type PatientCreateFormData = z.infer<typeof patientCreateSchema>;
