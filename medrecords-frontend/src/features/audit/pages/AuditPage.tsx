/**
 * Audit Log Page.
 *
 * Displays a paginated table of audit log entries with filters
 * for event type, actor, and date range.
 *
 * Requirements: 7.1, 7.4
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { useAuditLogs } from '../hooks/useAuditLogs';
import type { AuditLog } from '../api/auditApi';
import type { AuditLogFilters } from '@/shared/constants/queryKeys';

export function AuditPage() {
  const { t } = useTranslation('common');
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize: 20,
  });

  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const { data, isLoading } = useAuditLogs(filters);

  const columns: DataTableColumn<AuditLog>[] = [
    { key: 'eventType', header: t('audit.eventType', 'Event Type'), sortable: true },
    { key: 'actorUsername', header: t('audit.actor', 'Actor'), sortable: true },
    { key: 'actorRole', header: t('audit.role', 'Role') },
    { key: 'description', header: t('audit.description', 'Description') },
    { key: 'ipAddress', header: t('audit.ipAddress', 'IP Address') },
    {
      key: 'createdAt',
      header: t('audit.timestamp', 'Timestamp'),
      sortable: true,
      render: (log) => new Date(log.createdAt).toLocaleString(),
    },
  ];

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function handleApplyFilters() {
    setFilters({
      page: 1,
      pageSize: 20,
      eventType: eventTypeFilter || undefined,
      actorUsername: actorFilter || undefined,
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
    });
  }

  function handleClearFilters() {
    setEventTypeFilter('');
    setActorFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setFilters({ page: 1, pageSize: 20 });
  }

  return (
    <div className="audit-page">
      <h1>{t('audit.title', 'Audit Log')}</h1>

      <div className="audit-page__filters" role="search" aria-label="Audit log filters">
        <div className="audit-page__filter-group">
          <label htmlFor="eventType">{t('audit.filterEventType', 'Event Type')}</label>
          <input
            id="eventType"
            type="text"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            placeholder={t('audit.filterEventTypePlaceholder', 'e.g., LOGIN, PATIENT_CREATE')}
          />
        </div>

        <div className="audit-page__filter-group">
          <label htmlFor="actor">{t('audit.filterActor', 'Actor Username')}</label>
          <input
            id="actor"
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder={t('audit.filterActorPlaceholder', 'Username')}
          />
        </div>

        <div className="audit-page__filter-group">
          <label htmlFor="startDate">{t('audit.filterStartDate', 'Start Date')}</label>
          <input
            id="startDate"
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
          />
        </div>

        <div className="audit-page__filter-group">
          <label htmlFor="endDate">{t('audit.filterEndDate', 'End Date')}</label>
          <input
            id="endDate"
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
          />
        </div>

        <div className="audit-page__filter-actions">
          <button onClick={handleApplyFilters}>
            {t('audit.applyFilters', 'Apply Filters')}
          </button>
          <button onClick={handleClearFilters}>
            {t('audit.clearFilters', 'Clear')}
          </button>
        </div>
      </div>

      <DataTable<AuditLog>
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        page={filters.page}
        pageSize={filters.pageSize}
        total={data?.total ?? 0}
        onPageChange={handlePageChange}
        emptyMessage={t('audit.empty', 'No audit log entries found')}
      />
    </div>
  );
}

export default AuditPage;
