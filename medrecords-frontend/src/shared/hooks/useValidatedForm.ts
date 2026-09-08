/**
 * Validated form hook integrating Zod with react-hook-form via zodResolver.
 *
 * Provides client-side validation before submission and displays
 * error messages adjacent to each invalid field.
 *
 * Requirements: 8.1, 8.2
 */

import { useForm, type UseFormProps, type UseFormReturn, type FieldValues, type Path, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ZodType } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseValidatedFormOptions<TFormData extends FieldValues> extends Omit<UseFormProps<TFormData>, 'resolver'> {
  /** Zod schema to validate form data against */
  schema: ZodType<TFormData>;
}

export interface UseValidatedFormReturn<TFormData extends FieldValues> extends UseFormReturn<TFormData> {
  /**
   * Get the error message for a specific field.
   * Returns undefined if the field has no error.
   */
  getFieldError: (name: Path<TFormData>) => string | undefined;

  /**
   * Check if a specific field has a validation error.
   */
  hasFieldError: (name: Path<TFormData>) => boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Custom hook that integrates Zod validation with react-hook-form.
 *
 * Uses zodResolver to validate form data client-side before submission.
 * Validation errors are surfaced via the form state and helper functions
 * so that error messages can be displayed adjacent to each invalid field.
 *
 * @example
 * ```tsx
 * const { register, handleSubmit, getFieldError } = useValidatedForm({
 *   schema: patientSchema,
 *   defaultValues: { firstName: '', lastName: '' },
 * });
 *
 * return (
 *   <form onSubmit={handleSubmit(onSubmit)}>
 *     <input {...register('firstName')} />
 *     {getFieldError('firstName') && <span>{getFieldError('firstName')}</span>}
 *   </form>
 * );
 * ```
 */
export function useValidatedForm<TFormData extends FieldValues>(
  options: UseValidatedFormOptions<TFormData>,
): UseValidatedFormReturn<TFormData> {
  const { schema, ...formOptions } = options;

  const form = useForm<TFormData>({
    ...formOptions,
    // Cast bridges a types-only skew between zod v3 and @hookform/resolvers;
    // runtime behavior is unaffected.
    resolver: zodResolver(schema as never) as Resolver<TFormData>,
    mode: formOptions.mode ?? 'onBlur',
  });

  const getFieldError = (name: Path<TFormData>): string | undefined => {
    const error = form.formState.errors[name];
    if (error && typeof error.message === 'string') {
      return error.message;
    }
    return undefined;
  };

  const hasFieldError = (name: Path<TFormData>): boolean => {
    return !!form.formState.errors[name];
  };

  return {
    ...form,
    getFieldError,
    hasFieldError,
  };
}
