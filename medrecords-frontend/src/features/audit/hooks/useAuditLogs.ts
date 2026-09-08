/**
 * Hook for fetching audit logs with TanStack Query.
 *
 * Requirements: 7.1, 4.2
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys, type AuditLogFilters } from '@/shared/constants/queryKeys';
import { fetchAuditLogs } from '../api/auditApi';

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: queryKeys.audit.list(filters),
    queryFn: () => fetchAuditLogs(filters),
  });
}
