/**
 * TanStack Query hook for fetching paginated patients.
 *
 * Uses typed query key factories for consistent cache management.
 * Requirements: 7.1, 7.3
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys, type PatientFilters } from '@/shared/constants/queryKeys';
import { patientApi } from '../api/patientApi';

export function usePatients(filters: PatientFilters) {
  return useQuery({
    queryKey: queryKeys.patients.list(filters),
    queryFn: () => patientApi.getPatients(filters),
  });
}

export function usePatient(id: number) {
  return useQuery({
    queryKey: queryKeys.patients.detail(id),
    queryFn: () => patientApi.getPatient(id),
    enabled: id > 0,
  });
}
