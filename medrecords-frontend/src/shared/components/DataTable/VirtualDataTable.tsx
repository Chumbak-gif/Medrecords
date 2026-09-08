/**
 * Virtual scrolling DataTable component for rendering large datasets (1000+ rows).
 *
 * Uses @tanstack/react-virtual to virtualize rows, maintaining 30fps during scroll
 * with no frame exceeding 50ms.
 *
 * Requirements: 10.5
 */

import { useRef, useCallback, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualDataTableColumn<T> {
  key: string;
  header: string;
  width?: number;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

export interface VirtualDataTableProps<T> {
  columns: VirtualDataTableColumn<T>[];
  data: T[];
  rowHeight?: number;
  containerHeight?: number;
  overscan?: number;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  emptyMessage?: string;
  isLoading?: boolean;
}

/**
 * VirtualDataTable renders only the visible rows using virtualization.
 * Designed for tables exceeding 1000 rows while maintaining smooth 30fps scrolling.
 */
export function VirtualDataTable<T extends { id: number | string }>({
  columns,
  data,
  rowHeight = 40,
  containerHeight = 600,
  overscan = 10,
  onSort,
  sortBy,
  sortOrder = 'asc',
  emptyMessage = 'No data available',
  isLoading = false,
}: VirtualDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan,
  });

  function handleSort(key: string) {
    if (!onSort) return;
    const newOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(key, newOrder);
  }

  if (isLoading) {
    return (
      <div className="virtual-data-table__loading" aria-busy="true" role="status">
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="virtual-data-table__empty">{emptyMessage}</div>;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div className="virtual-data-table">
      {/* Fixed header */}
      <div className="virtual-data-table__header" role="rowgroup">
        <table role="table" aria-label="Virtualized data table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr role="row">
              {columns.map((col) => (
                <th
                  key={col.key}
                  role="columnheader"
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sortBy === col.key
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  style={{
                    cursor: col.sortable ? 'pointer' : 'default',
                    width: col.width ? `${col.width}px` : 'auto',
                    padding: '8px 12px',
                    textAlign: 'left',
                    borderBottom: '2px solid #e2e8f0',
                  }}
                >
                  {col.header}
                  {sortBy === col.key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized body */}
      <div
        ref={parentRef}
        className="virtual-data-table__body"
        style={{
          height: `${containerHeight}px`,
          overflow: 'auto',
          willChange: 'transform',
          contain: 'strict',
        }}
        role="rowgroup"
        aria-rowcount={data.length}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table
            style={{
              width: '100%',
              tableLayout: 'fixed',
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            }}
          >
            <tbody>
              {virtualItems.map((virtualRow) => {
                const item = data[virtualRow.index];
                return (
                  <tr
                    key={item.id}
                    role="row"
                    aria-rowindex={virtualRow.index + 1}
                    style={{ height: `${rowHeight}px` }}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '8px 12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: col.width ? `${col.width}px` : 'auto',
                        }}
                      >
                        {col.render
                          ? col.render(item)
                          : String((item as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count info */}
      <div className="virtual-data-table__info" aria-live="polite">
        {data.length.toLocaleString()} rows total
      </div>
    </div>
  );
}
