/**
 * Assessment API service using the shared apiClient.
 *
 * Provides typed API calls for assessment CRUD operations.
 * Requirements: 7.1
 */

import { createTypedApiClient } from '@/shared/services/api/apiClient';
import type { PaginatedResponse } from '@/shared/types';
import type { AssessmentFilters } from '@/shared/constants/queryKeys';
import type { Assessment, AssessmentCreateDTO, AssessmentUpdateDTO, FormTemplate } from '../models/assessment.types';

const apiClient = createTypedApiClient();

export const assessmentApi = {
  /**
   * Fetch a paginated list of assessments with optional filters.
   */
  async getAssessments(filters: AssessmentFilters): Promise<PaginatedResponse<Assessment>> {
    const response = await apiClient.get<PaginatedResponse<Assessment>>('/assessments', {
      params: filters as unknown as Record<string, unknown>,
    });
    return response.data;
  },

  /**
   * Fetch assessments for a specific patient.
   */
  async getAssessmentsByPatient(patientId: number): Promise<Assessment[]> {
    const response = await apiClient.get<Assessment[]>(`/assessments?patientId=${patientId}`);
    return response.data;
  },

  /**
   * Fetch a single assessment by ID.
   */
  async getAssessment(id: number): Promise<Assessment> {
    const response = await apiClient.get<Assessment>(`/assessments/${id}`);
    return response.data;
  },

  /**
   * Create a new assessment.
   */
  async createAssessment(data: AssessmentCreateDTO): Promise<Assessment> {
    const response = await apiClient.post<Assessment>('/assessments', data);
    return response.data;
  },

  /**
   * Update an existing assessment.
   */
  async updateAssessment(id: number, data: AssessmentUpdateDTO): Promise<Assessment> {
    const response = await apiClient.put<Assessment>(`/assessments/${id}`, data);
    return response.data;
  },

  /**
   * Fetch a form template by ID for dynamic form rendering.
   */
  async getTemplate(templateId: number): Promise<FormTemplate> {
    const response = await apiClient.get<FormTemplate>(`/templates/${templateId}`);
    return response.data;
  },
};
