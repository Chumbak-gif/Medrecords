/**
 * Patient domain model types.
 *
 * Defines the Patient entity, filters, and DTOs for the patient-management feature.
 */

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  contactNumber: string;
  email?: string;
  address?: string;
  medicalRecordNumber: string;
  registeredBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatientCreateDTO {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  contactNumber: string;
  email?: string;
  address?: string;
  medicalRecordNumber: string;
}

export interface PatientUpdateDTO {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  contactNumber?: string;
  email?: string;
  address?: string;
}
