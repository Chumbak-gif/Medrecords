/**
 * Assessments List Page.
 *
 * Displays a paginated table of assessments with filtering capabilities.
 * Requirements: 7.1
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable';
import { PermissionGate } from '@/shared/components/PermissionGate/PermissionGate';
import { useAssessments } from '../hooks/useAssessments';
import type { Assessment } from '../models/assessment.types';
import type { AssessmentFilters } from '@/shared/constants/queryKeys';

export function AssessmentsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AssessmentFilters>({
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading } = useAssessments(filters);

  const columns: DataTableColumn<Assessment>[] = [
    { key: 'id', header: 'ID', sortable: true },
    { key: 'patientId', header: 'Patient ID' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Created', sortable: true },
    {
      key: 'actions',
      header: 'Actions',
      render: (assessment) => (
        <button
          onClick={() => navigate(`/doctor/assessments/${assessment.id}`)}
          aria-label={`View assessment ${assessment.id}`}
        >
          View
        </button>
      ),
    },
  ];

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  return (
    <div className="assessments-list-page">
      <div className="assessments-list-page__header">
        <h1>Assessments</h1>
        <PermissionGate permission={{ resource: 'assessments', action: 'create' }}>
          <button
            onClick={() => navigate('/doctor/assessments/new')}
            className="assessments-list-page__create-btn"
          >
            New Assessment
          </button>
        </PermissionGate>
      </div>

      <DataTable<Assessment>
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        page={filters.page}
        pageSize={filters.pageSize}
        total={data?.total ?? 0}
        onPageChange={handlePageChange}
        emptyMessage="No assessments found"
      />
    </div>
  );
}

export default AssessmentsListPage;
