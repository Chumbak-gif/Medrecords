/**
 * Assessment domain model types.
 *
 * Defines the Assessment entity, DTOs, and related types.
 */

export interface Assessment {
  id: number;
  patientId: number;
  doctorId: number;
  diseaseId: number;
  templateId: number;
  status: 'draft' | 'in_progress' | 'completed' | 'locked';
  formData: Record<string, unknown>;
  lockedAt?: string;
  lockedBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentCreateDTO {
  patientId: number;
  diseaseId: number;
  templateId: number;
  formData: Record<string, unknown>;
}

export interface AssessmentUpdateDTO {
  formData: Record<string, unknown>;
  status?: 'draft' | 'in_progress' | 'completed';
}

export interface FormTemplate {
  id: number;
  name: string;
  diseaseId: number;
  schema: import('./assessment.validation').TemplateSchema;
  createdAt: string;
  updatedAt: string;
}
