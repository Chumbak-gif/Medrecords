/**
 * Reusable DataTable component for displaying paginated tabular data.
 *
 * Provides sortable columns, pagination controls, and a loading state.
 */

import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  emptyMessage?: string;
}

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  isLoading = false,
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  onSort,
  sortBy,
  sortOrder = 'asc',
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize);

  function handleSort(key: string) {
    if (!onSort) return;
    const newOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(key, newOrder);
  }

  if (isLoading) {
    return (
      <div className="data-table__loading" aria-busy="true" role="status">
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="data-table__empty">{emptyMessage}</div>;
  }

  return (
    <div className="data-table">
      <table role="table" aria-label="Data table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={
                  sortBy === col.key
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                style={col.sortable ? { cursor: 'pointer' } : undefined}
              >
                {col.header}
                {sortBy === col.key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && onPageChange && (
        <nav className="data-table__pagination" aria-label="Table pagination">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
