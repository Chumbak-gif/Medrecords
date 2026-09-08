/**
 * Audit Log Page - Read-only system activity log with filters and export.
 * Matches Angular AuditLogComponent.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface AuditLog {
  id: number;
  event_type: string;
  actor_username: string;
  actor_role: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

interface PaginatedResponse {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface AuditFilters {
  event_type: string;
  actor_username: string;
  from_date: string;
  to_date: string;
}

const EVENT_TYPE_OPTIONS = [
  { label: 'All Events', value: '' },
  { label: 'Login', value: 'login' },
  { label: 'Logout', value: 'logout' },
  { label: 'Create', value: 'create' },
  { label: 'Update', value: 'update' },
  { label: 'Delete', value: 'delete' },
  { label: 'Export', value: 'export' },
];

function getEventBadgeStyle(eventType: string): React.CSSProperties {
  const base: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' };
  switch (eventType?.toLowerCase()) {
    case 'login': return { ...base, background: '#dcfce7', color: '#166534' };
    case 'logout': return { ...base, background: '#f3f4f6', color: '#6b7280' };
    case 'create': return { ...base, background: '#dbeafe', color: '#1e40af' };
    case 'update': return { ...base, background: '#fef3c7', color: '#92400e' };
    case 'delete': return { ...base, background: '#fee2e2', color: '#991b1b' };
    case 'export': return { ...base, background: '#dbeafe', color: '#1e40af' };
    default: return { ...base, background: '#f3f4f6', color: '#6b7280' };
  }
}

const apiClient = createTypedApiClient();

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const [filters, setFilters] = useState<AuditFilters>({
    event_type: '',
    actor_username: '',
    from_date: '',
    to_date: '',
  });

  const actorSearchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadLogs = useCallback(async (page: number, size: number, f: AuditFilters) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: size };
      if (f.event_type) params.event_type = f.event_type;
      if (f.actor_username.trim()) params.actor_username = f.actor_username.trim();
      if (f.from_date) params.from_date = f.from_date;
      if (f.to_date) params.to_date = f.to_date;
      const res = await apiClient.get<PaginatedResponse>('/audit/', { params });
      setLogs(res.data.items);
      setTotalRecords(res.data.total);
    } catch {
      showToast('error', 'Failed to load audit log entries');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLogs(currentPage, pageSize, filters);
  }, [currentPage, pageSize, loadLogs, filters]);

  function onFilterChange(key: keyof AuditFilters, value: string) {
    if (key === 'actor_username') {
      // Debounce actor username
      setFilters(prev => ({ ...prev, [key]: value }));
      if (actorSearchTimeout.current) clearTimeout(actorSearchTimeout.current);
      actorSearchTimeout.current = setTimeout(() => {
        setCurrentPage(1);
      }, 400);
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
      setCurrentPage(1);
    }
  }

  function clearFilters() {
    setFilters({ event_type: '', actor_username: '', from_date: '', to_date: '' });
    setCurrentPage(1);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const params: Record<string, unknown> = { format: 'excel' };
      if (filters.event_type) params.event_type = filters.event_type;
      if (filters.from_date) params.start_date = filters.from_date;
      if (filters.to_date) params.end_date = filters.to_date;

      const res = await apiClient.get<Blob>('/exports/audit-log', { params });
      // Trigger download
      const blob = new Blob([res.data as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Audit log exported successfully');
    } catch {
      showToast('error', 'Export failed');
    }
    setExporting(false);
  }

  function formatDateTime(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    } catch { return dateStr; }
  }

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Audit Log</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Read-only system activity log — all user actions are recorded here
          </p>
        </div>
        <button className="btn-primary" onClick={exportExcel} disabled={exporting}>
          <i className={`pi ${exporting ? 'pi-spin pi-spinner' : 'pi-file-excel'}`} />
          {exporting ? ' Exporting…' : ' Export Excel'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {/* Event Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)' }}>Event Type</label>
            <select
              className="form-control"
              value={filters.event_type}
              onChange={(e) => onFilterChange('event_type', e.target.value)}
            >
              {EVENT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Actor Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200, maxWidth: 320 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)' }}>Actor Username</label>
            <span style={{ position: 'relative' }}>
              <i className="pi pi-user" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-500)', zIndex: 1 }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search by username…"
                value={filters.actor_username}
                onChange={(e) => onFilterChange('actor_username', e.target.value)}
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </span>
          </div>

          {/* From Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)' }}>From Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.from_date}
              onChange={(e) => onFilterChange('from_date', e.target.value)}
            />
          </div>

          {/* To Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)' }}>To Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.to_date}
              onChange={(e) => onFilterChange('to_date', e.target.value)}
            />
          </div>

          {/* Clear */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn-secondary" onClick={clearFilters} title="Clear all filters">
              <i className="pi pi-filter-slash" /> Clear
            </button>
          </div>

          {/* Count */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
              {totalRecords} record(s)
            </span>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '1.5rem' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 70 }}>ID</th>
                  <th style={thStyle}>Event Type</th>
                  <th style={thStyle}>Actor</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Entity Type</th>
                  <th style={{ ...thStyle, minWidth: 260 }}>Description</th>
                  <th style={thStyle}>IP Address</th>
                  <th style={{ ...thStyle, minWidth: 160 }}>Date / Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--color-neutral-400)' }}>
                      <i className="pi pi-list" style={{ fontSize: '2rem', display: 'block', marginBottom: 10, opacity: 0.4 }} />
                      No audit log entries found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-neutral-500)' }}>#{log.id}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={getEventBadgeStyle(log.event_type)}>{log.event_type.toUpperCase()}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{log.actor_username}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}>
                          {log.actor_role}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {log.entity_type ? (
                          <span style={{ color: 'var(--color-neutral-700)' }}>
                            {log.entity_type}
                            {log.entity_id != null && <span style={{ color: 'var(--color-neutral-400)', fontSize: 12 }}> #{log.entity_id}</span>}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-neutral-300)' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--color-neutral-600)', fontSize: 13 }} title={log.description ?? ''}>
                          {log.description || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-neutral-600)' }}>
                          {log.ip_address || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
                          {formatDateTime(log.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-neutral-600)' }}>
              <span>Rows per page:</span>
              <select className="form-control" style={{ width: 70 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn-icon" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <i className="pi pi-chevron-left" />
              </button>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-600)', padding: '0 8px' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button className="btn-icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <i className="pi pi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'left',
  background: 'var(--color-neutral-50)',
  color: 'var(--color-neutral-600)',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};

export default AuditLogPage;
