/**
 * Tests for assessment validation with dynamic template schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTemplateSchema,
  validateAssessmentFormData,
  type TemplateSchema,
} from './assessment.validation';

describe('assessment.validation', () => {
  const sampleTemplate: TemplateSchema = {
    fields: [
      { name: 'temperature', type: 'number', label: 'Temperature', required: true, min: 35, max: 42 },
      { name: 'notes', type: 'text', label: 'Notes', required: true, minLength: 5, maxLength: 500 },
      { name: 'bloodPressure', type: 'text', label: 'Blood Pressure', required: true, pattern: '^\\d{2,3}/\\d{2,3}$', patternMessage: 'Must be in format like 120/80' },
      { name: 'severity', type: 'select', label: 'Severity', required: true, options: ['mild', 'moderate', 'severe'] },
      { name: 'followUp', type: 'boolean', label: 'Follow-up Required', required: false },
    ],
  };

  describe('buildTemplateSchema', () => {
    it('should build a Zod schema from template fields', () => {
      const schema = buildTemplateSchema(sampleTemplate);
      expect(schema).toBeDefined();
      expect(schema.shape).toBeDefined();
    });
  });

  describe('validateAssessmentFormData', () => {
    const validData = {
      temperature: 37.5,
      notes: 'Patient reports mild symptoms',
      bloodPressure: '120/80',
      severity: 'mild',
      followUp: true,
    };

    it('should accept valid form data', () => {
      const result = validateAssessmentFormData(validData, sampleTemplate);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should reject missing required fields', () => {
      const result = validateAssessmentFormData({}, sampleTemplate);
      expect(result.success).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    });

    it('should validate min/max for number fields', () => {
      const result = validateAssessmentFormData(
        { ...validData, temperature: 50 },
        sampleTemplate,
      );
      expect(result.success).toBe(false);
      expect(result.errors.temperature).toContain('at most 42');
    });

    it('should validate minLength/maxLength for text fields', () => {
      const result = validateAssessmentFormData(
        { ...validData, notes: 'Hi' },
        sampleTemplate,
      );
      expect(result.success).toBe(false);
      expect(result.errors.notes).toContain('at least 5');
    });

    it('should validate pattern for text fields', () => {
      const result = validateAssessmentFormData(
        { ...validData, bloodPressure: 'invalid' },
        sampleTemplate,
      );
      expect(result.success).toBe(false);
      expect(result.errors.bloodPressure).toBeDefined();
    });

    it('should validate select fields against options', () => {
      const result = validateAssessmentFormData(
        { ...validData, severity: 'critical' },
        sampleTemplate,
      );
      expect(result.success).toBe(false);
      expect(result.errors.severity).toBeDefined();
    });

    it('should report errors for each invalid field', () => {
      const result = validateAssessmentFormData(
        { temperature: 100, notes: 'Hi', bloodPressure: 'bad', severity: 'invalid' },
        sampleTemplate,
      );
      expect(result.success).toBe(false);
      expect(result.errors.temperature).toBeDefined();
      expect(result.errors.notes).toBeDefined();
      expect(result.errors.bloodPressure).toBeDefined();
      expect(result.errors.severity).toBeDefined();
    });
  });
});
