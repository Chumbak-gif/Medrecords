/**
 * Audit log API service.
 *
 * Provides typed API calls for fetching audit log entries.
 * Requirements: 7.1
 */

import { createTypedApiClient } from '@/shared/services/api/apiClient';
import type { AuditLogFilters } from '@/shared/constants/queryKeys';

export interface AuditLog {
  id: number;
  eventType: string;
  actorId: number | null;
  actorUsername: string;
  actorRole: string;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginatedAuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const apiClient = createTypedApiClient();

export async function fetchAuditLogs(filters: AuditLogFilters): Promise<PaginatedAuditResponse> {
  const params: Record<string, unknown> = {
    page: filters.page,
    page_size: filters.pageSize,
  };

  if (filters.eventType) params.event_type = filters.eventType;
  if (filters.actorUsername) params.actor_username = filters.actorUsername;
  if (filters.startDate) params.start_date = filters.startDate;
  if (filters.endDate) params.end_date = filters.endDate;

  const response = await apiClient.get<PaginatedAuditResponse>('/audit', { params });
  return response.data;
}
