/**
 * Patient form component with Zod validation.
 *
 * Uses useValidatedForm to integrate Zod schema validation with react-hook-form.
 * Displays inline error messages adjacent to each invalid field.
 *
 * Requirements: 8.1, 8.2
 */

import { useValidatedForm } from '@/shared/hooks/useValidatedForm';
import { patientCreateSchema, type PatientCreateFormData } from '../models/patient.validation';

export interface PatientFormProps {
  onSubmit: (data: PatientCreateFormData) => void;
  isLoading?: boolean;
  defaultValues?: Partial<PatientCreateFormData>;
}

export function PatientForm({ onSubmit, isLoading = false, defaultValues }: PatientFormProps) {
  const { register, handleSubmit, getFieldError } = useValidatedForm<PatientCreateFormData>({
    schema: patientCreateSchema,
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: undefined,
      contactNumber: '',
      email: '',
      address: '',
      medicalRecordNumber: '',
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Patient form">
      <div className="form-field">
        <label htmlFor="patient-firstName">First Name *</label>
        <input id="patient-firstName" {...register('firstName')} disabled={isLoading} />
        {getFieldError('firstName') && (
          <span className="form-field__error" role="alert">{getFieldError('firstName')}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="patient-lastName">Last Name *</label>
        <input id="patient-lastName" {...register('lastName')} disabled={isLoading} />
        {getFieldError('lastName') && (
          <span className="form-field__error" role="alert">{getFieldError('lastName')}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="patient-dateOfBirth">Date of Birth *</label>
        <input id="patient-dateOfBirth" type="date" {...register('dateOfBirth')} disabled={isLoading} />
        {getFieldError('dateOfBirth') && (
          <span className="form-field__error" role="alert">{getFieldError('dateOfBirth')}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="patient-gender">Gender *</label>
        <select id="patient-gender" {...register('gender')} disabled={isLoading}>
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        {getFieldError('gender') && (
          <span className="form-field__error" role="alert">{getFieldError('gender')}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="patient-contactNumber">Contact Number *</label>
        <input id="patient-contactNumber" {...register('contactNumber')} disabled={isLoading} />
        {getFieldError('contactNumber') && (
          <span className="form-field__error" role="alert">{getFieldError('contactNumber')}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="patient-email">Email</label>
        <input id="patient-email" type="email" {...register('email')} disabled={isLoading} />
        {getFieldError('email') && (
          <span className="form-field__error" role="alert">{getFieldError('email')}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="patient-address">Address</label>
        <textarea id="patient-address" {...register('address')} disabled={isLoading} />
        {getFieldError('address') && (
          <span className="form-field__error" role="alert">{getFieldError('address')}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="patient-medicalRecordNumber">Medical Record Number *</label>
        <input id="patient-medicalRecordNumber" {...register('medicalRecordNumber')} disabled={isLoading} />
        {getFieldError('medicalRecordNumber') && (
          <span className="form-field__error" role="alert">{getFieldError('medicalRecordNumber')}</span>
        )}
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Patient'}
      </button>
    </form>
  );
}
