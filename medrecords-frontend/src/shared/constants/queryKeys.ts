/**
 * Typed query key factories for TanStack Query.
 * Ensures consistent, type-safe cache keys across the application.
 *
 * @see design.md — State Management Layer (Component 4)
 */

export interface PatientFilters {
  search?: string;
  gender?: string;
  registeredBy?: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AssessmentFilters {
  patientId?: number;
  doctorId?: number;
  status?: string;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  eventType?: string;
  actorUsername?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export const queryKeys = {
  patients: {
    all: ['patients'] as const,
    list: (filters: PatientFilters) => ['patients', 'list', filters] as const,
    detail: (id: number) => ['patients', 'detail', id] as const,
  },

  assessments: {
    all: ['assessments'] as const,
    byPatient: (patientId: number) => ['assessments', 'byPatient', patientId] as const,
    detail: (id: number) => ['assessments', 'detail', id] as const,
    list: (filters: AssessmentFilters) => ['assessments', 'list', filters] as const,
  },

  audit: {
    all: ['audit'] as const,
    list: (filters: AuditLogFilters) => ['audit', 'list', filters] as const,
    detail: (id: number) => ['audit', 'detail', id] as const,
  },
} as const;
