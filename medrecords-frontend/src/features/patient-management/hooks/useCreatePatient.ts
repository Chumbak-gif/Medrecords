/**
 * TanStack Query mutation hook for creating a patient.
 *
 * On success, invalidates the patients query cache to trigger refetch.
 * Requirements: 7.1, 7.3
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/constants/queryKeys';
import { patientApi } from '../api/patientApi';
import type { PatientCreateDTO } from '../models/patient.types';

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PatientCreateDTO) => patientApi.createPatient(data),
    onSuccess: () => {
      // Invalidate all patient queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.all });
    },
  });
}
