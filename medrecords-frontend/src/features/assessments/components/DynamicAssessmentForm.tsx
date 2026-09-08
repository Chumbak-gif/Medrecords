/**
 * Dynamic Assessment Form component.
 *
 * Renders form fields dynamically based on a template schema definition
 * and validates using template-based Zod validation.
 *
 * Requirements: 8.7, 8.8
 */

import { useState, type FormEvent } from 'react';
import {
  validateAssessmentFormData,
  type TemplateSchema,
  type TemplateFieldDefinition,
} from '../models/assessment.validation';

export interface DynamicAssessmentFormProps {
  template: TemplateSchema;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading?: boolean;
}

export function DynamicAssessmentForm({
  template,
  initialData = {},
  onSubmit,
  isLoading = false,
}: DynamicAssessmentFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(fieldName: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    // Clear error for the field when user modifies it
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateAssessmentFormData(formData, template);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    onSubmit(result.data!);
  }

  function renderField(field: TemplateFieldDefinition) {
    const value = formData[field.name];
    const error = errors[field.name];
    const fieldId = `assessment-field-${field.name}`;

    switch (field.type) {
      case 'number':
        return (
          <div key={field.name} className="form-field">
            <label htmlFor={fieldId}>
              {field.label ?? field.name}
              {field.required && ' *'}
            </label>
            <input
              id={fieldId}
              type="number"
              value={value !== undefined ? String(value) : ''}
              onChange={(e) => handleChange(field.name, e.target.value ? Number(e.target.value) : undefined)}
              min={field.min}
              max={field.max}
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby={error ? `${fieldId}-error` : undefined}
            />
            {error && (
              <span id={`${fieldId}-error`} className="form-field__error" role="alert">
                {error}
              </span>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.name} className="form-field">
            <label htmlFor={fieldId}>
              <input
                id={fieldId}
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => handleChange(field.name, e.target.checked)}
                disabled={isLoading}
                aria-invalid={!!error}
              />
              {field.label ?? field.name}
              {field.required && ' *'}
            </label>
            {error && (
              <span id={`${fieldId}-error`} className="form-field__error" role="alert">
                {error}
              </span>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="form-field">
            <label htmlFor={fieldId}>
              {field.label ?? field.name}
              {field.required && ' *'}
            </label>
            <select
              id={fieldId}
              value={String(value ?? '')}
              onChange={(e) => handleChange(field.name, e.target.value)}
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby={error ? `${fieldId}-error` : undefined}
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {error && (
              <span id={`${fieldId}-error`} className="form-field__error" role="alert">
                {error}
              </span>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className="form-field">
            <label htmlFor={fieldId}>
              {field.label ?? field.name}
              {field.required && ' *'}
            </label>
            <input
              id={fieldId}
              type="date"
              value={String(value ?? '')}
              onChange={(e) => handleChange(field.name, e.target.value)}
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby={error ? `${fieldId}-error` : undefined}
            />
            {error && (
              <span id={`${fieldId}-error`} className="form-field__error" role="alert">
                {error}
              </span>
            )}
          </div>
        );

      case 'text':
      default:
        return (
          <div key={field.name} className="form-field">
            <label htmlFor={fieldId}>
              {field.label ?? field.name}
              {field.required && ' *'}
            </label>
            <input
              id={fieldId}
              type="text"
              value={String(value ?? '')}
              onChange={(e) => handleChange(field.name, e.target.value)}
              maxLength={field.maxLength}
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby={error ? `${fieldId}-error` : undefined}
            />
            {error && (
              <span id={`${fieldId}-error`} className="form-field__error" role="alert">
                {error}
              </span>
            )}
          </div>
        );
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Assessment form">
      {template.fields.map(renderField)}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit Assessment'}
      </button>
    </form>
  );
}
