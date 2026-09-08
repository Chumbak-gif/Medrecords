/**
 * TanStack Query hooks for assessment data fetching.
 *
 * Requirements: 7.1
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, type AssessmentFilters } from '@/shared/constants/queryKeys';
import { assessmentApi } from '../api/assessmentApi';
import type { AssessmentCreateDTO, AssessmentUpdateDTO } from '../models/assessment.types';

export function useAssessments(filters: AssessmentFilters) {
  return useQuery({
    queryKey: queryKeys.assessments.list(filters),
    queryFn: () => assessmentApi.getAssessments(filters),
  });
}

export function useAssessmentsByPatient(patientId: number) {
  return useQuery({
    queryKey: queryKeys.assessments.byPatient(patientId),
    queryFn: () => assessmentApi.getAssessmentsByPatient(patientId),
    enabled: patientId > 0,
  });
}

export function useAssessment(id: number) {
  return useQuery({
    queryKey: queryKeys.assessments.detail(id),
    queryFn: () => assessmentApi.getAssessment(id),
    enabled: id > 0,
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssessmentCreateDTO) => assessmentApi.createAssessment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssessmentUpdateDTO }) =>
      assessmentApi.updateAssessment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
    },
  });
}

export function useTemplate(templateId: number) {
  return useQuery({
    queryKey: ['templates', templateId],
    queryFn: () => assessmentApi.getTemplate(templateId),
    enabled: templateId > 0,
  });
}
