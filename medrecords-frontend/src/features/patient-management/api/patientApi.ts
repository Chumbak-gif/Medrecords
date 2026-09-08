/**
 * Patient API service using the shared apiClient.
 *
 * Provides typed API calls for patient CRUD operations.
 * Requirements: 7.1, 7.3
 */

import { createTypedApiClient } from '@/shared/services/api/apiClient';
import type { PaginatedResponse } from '@/shared/types';
import type { PatientFilters } from '@/shared/constants/queryKeys';
import type { Patient, PatientCreateDTO, PatientUpdateDTO } from '../models/patient.types';

const apiClient = createTypedApiClient();

export const patientApi = {
  /**
   * Fetch a paginated list of patients with optional filters.
   */
  async getPatients(filters: PatientFilters): Promise<PaginatedResponse<Patient>> {
    const response = await apiClient.get<PaginatedResponse<Patient>>('/patients', {
      params: filters as unknown as Record<string, unknown>,
    });
    return response.data;
  },

  /**
   * Fetch a single patient by ID.
   */
  async getPatient(id: number): Promise<Patient> {
    const response = await apiClient.get<Patient>(`/patients/${id}`);
    return response.data;
  },

  /**
   * Create a new patient.
   */
  async createPatient(data: PatientCreateDTO): Promise<Patient> {
    const response = await apiClient.post<Patient>('/patients', data);
    return response.data;
  },

  /**
   * Update an existing patient.
   */
  async updatePatient(id: number, data: PatientUpdateDTO): Promise<Patient> {
    const response = await apiClient.put<Patient>(`/patients/${id}`, data);
    return response.data;
  },

  /**
   * Delete a patient by ID.
   */
  async deletePatient(id: number): Promise<void> {
    await apiClient.delete(`/patients/${id}`);
  },
};
