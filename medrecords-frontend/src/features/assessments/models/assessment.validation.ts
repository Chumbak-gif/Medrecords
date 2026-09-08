/**
 * Assessment validation with dynamic template schemas.
 *
 * Validates assessment formData against a template schema that defines:
 * - Required fields
 * - min/max numeric constraints
 * - minLength/maxLength string constraints
 * - pattern regex constraints
 *
 * Generates Zod schemas dynamically from template definitions so that
 * error messages are displayed adjacent to invalid fields and
 * submission is prevented until all validation errors are resolved.
 *
 * Requirements: 8.7, 8.8
 */

import { z, type ZodTypeAny } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A field definition from a disease template schema.
 */
export interface TemplateFieldDefinition {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  label?: string;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  options?: string[];
}

/**
 * A template schema defines the validation rules for an assessment form.
 */
export interface TemplateSchema {
  fields: TemplateFieldDefinition[];
}

/**
 * Validation result with field-level errors.
 */
export interface AssessmentValidationResult {
  success: boolean;
  errors: Record<string, string>;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Dynamic schema builder
// ---------------------------------------------------------------------------

/**
 * Build a Zod schema for a single template field based on its type and constraints.
 */
function buildFieldSchema(field: TemplateFieldDefinition): ZodTypeAny {
  switch (field.type) {
    case 'number': {
      let schema = z.number({
        required_error: `${field.label ?? field.name} is required`,
        invalid_type_error: `${field.label ?? field.name} must be a number`,
      });
      if (field.min !== undefined) {
        schema = schema.min(field.min, `${field.label ?? field.name} must be at least ${field.min}`);
      }
      if (field.max !== undefined) {
        schema = schema.max(field.max, `${field.label ?? field.name} must be at most ${field.max}`);
      }
      return field.required ? schema : schema.optional();
    }

    case 'boolean': {
      const schema = z.boolean({
        required_error: `${field.label ?? field.name} is required`,
        invalid_type_error: `${field.label ?? field.name} must be a boolean`,
      });
      return field.required ? schema : schema.optional();
    }

    case 'date': {
      let schema = z.string({
        required_error: `${field.label ?? field.name} is required`,
      });
      if (field.required) {
        schema = schema.min(1, `${field.label ?? field.name} is required`);
      }
      if (field.pattern) {
        schema = schema.regex(
          new RegExp(field.pattern),
          field.patternMessage ?? `${field.label ?? field.name} format is invalid`,
        );
      }
      return field.required ? schema : schema.optional();
    }

    case 'select': {
      if (field.options && field.options.length > 0) {
        const schema = z.enum(field.options as [string, ...string[]], {
          required_error: `${field.label ?? field.name} is required`,
          invalid_type_error: `${field.label ?? field.name} must be one of: ${field.options.join(', ')}`,
        });
        return field.required ? schema : schema.optional();
      }
      // Fallback to string if no options defined
      let schema = z.string({
        required_error: `${field.label ?? field.name} is required`,
      });
      if (field.required) {
        schema = schema.min(1, `${field.label ?? field.name} is required`);
      }
      return field.required ? schema : schema.optional();
    }

    case 'text':
    default: {
      let schema = z.string({
        required_error: `${field.label ?? field.name} is required`,
      });
      if (field.required) {
        schema = schema.min(1, `${field.label ?? field.name} is required`);
      }
      if (field.minLength !== undefined) {
        schema = schema.min(
          field.minLength,
          `${field.label ?? field.name} must be at least ${field.minLength} characters`,
        );
      }
      if (field.maxLength !== undefined) {
        schema = schema.max(
          field.maxLength,
          `${field.label ?? field.name} must be at most ${field.maxLength} characters`,
        );
      }
      if (field.pattern) {
        schema = schema.regex(
          new RegExp(field.pattern),
          field.patternMessage ?? `${field.label ?? field.name} format is invalid`,
        );
      }
      return field.required ? schema : schema.optional();
    }
  }
}

/**
 * Build a complete Zod schema from a template definition.
 *
 * Each field in the template produces a corresponding Zod field
 * with constraints derived from its definition.
 */
export function buildTemplateSchema(template: TemplateSchema): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of template.fields) {
    shape[field.name] = buildFieldSchema(field);
  }

  return z.object(shape);
}

/**
 * Validate assessment form data against a template schema.
 *
 * Returns field-level errors mapped by field name for display
 * adjacent to each invalid field. Prevents submission when errors exist.
 */
export function validateAssessmentFormData(
  formData: Record<string, unknown>,
  template: TemplateSchema,
): AssessmentValidationResult {
  const schema = buildTemplateSchema(template);
  const result = schema.safeParse(formData);

  if (result.success) {
    return {
      success: true,
      errors: {},
      data: result.data as Record<string, unknown>,
    };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const fieldName = issue.path.join('.');
    // Only capture the first error per field
    if (!errors[fieldName]) {
      errors[fieldName] = issue.message;
    }
  }

  return {
    success: false,
    errors,
  };
}
