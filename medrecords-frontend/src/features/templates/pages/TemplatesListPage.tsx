/**
 * Templates List Page - Form template management.
 * Matches Angular TemplatesListComponent.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface Disease {
  id: number;
  name: string;
  is_active: boolean;
}

interface FormTemplate {
  id: number;
  disease_id: number;
  disease_name?: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

const apiClient = createTypedApiClient();

export function TemplatesListPage() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<number | ''>('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Confirm dialog
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<FormTemplate | null>(null);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDiseases = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<Disease>>('/diseases/', {
        params: { page_size: 100, include_inactive: 'false' },
      });
      setDiseases(res.data.items);
    } catch { /* non-critical */ }
  }, []);

  const loadTemplates = useCallback(async (page: number, size: number, diseaseId: number | '') => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: size, include_inactive: 'true' };
      if (diseaseId) params.disease_id = diseaseId;
      const res = await apiClient.get<PaginatedResponse<FormTemplate>>('/templates/', { params });
      // Enrich with disease names
      const diseaseMap = new Map(diseases.map(d => [d.id, d.name]));
      const enriched = res.data.items.map(t => ({
        ...t,
        disease_name: t.disease_name ?? diseaseMap.get(t.disease_id) ?? `Disease #${t.disease_id}`,
      }));
      setTemplates(enriched);
      setTotalRecords(res.data.total);
    } catch {
      showToast('error', 'Failed to load templates');
    }
    setLoading(false);
  }, [diseases]);

  useEffect(() => {
    loadDiseases();
  }, [loadDiseases]);

  useEffect(() => {
    loadTemplates(currentPage, pageSize, selectedDiseaseId);
  }, [currentPage, pageSize, selectedDiseaseId, loadTemplates]);

  function onDiseaseFilter(value: string) {
    setSelectedDiseaseId(value ? Number(value) : '');
    setCurrentPage(1);
  }

  function confirmDelete(tmpl: FormTemplate) {
    setConfirmTarget(tmpl);
    setConfirmVisible(true);
  }

  async function deleteTemplate() {
    if (!confirmTarget) return;
    try {
      await apiClient.delete(`/templates/${confirmTarget.id}`);
      showToast('success', 'Template deleted.');
      setConfirmVisible(false);
      loadTemplates(currentPage, pageSize, selectedDiseaseId);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Delete failed');
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  }

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Form Templates</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Manage disease-specific form schemas
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/admin/templates/new')}>
          <i className="pi pi-plus" /> New Template
        </button>
      </div>

      <div className="card">
        {/* Filters */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ minWidth: 220 }}
            value={selectedDiseaseId}
            onChange={(e) => onDiseaseFilter(e.target.value)}
          >
            <option value="">All diseases</option>
            {diseases.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>{totalRecords} record(s)</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '1.5rem' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Disease</th>
                <th style={{ ...thStyle, width: 110, textAlign: 'center' }}>Version</th>
                <th style={{ ...thStyle, width: 120 }}>Status</th>
                <th style={{ ...thStyle, width: 170 }}>Created At</th>
                <th style={{ ...thStyle, width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
                    No templates found. <button className="btn-link" onClick={() => navigate('/admin/templates/new')}>Create one?</button>
                  </td>
                </tr>
              ) : (
                templates.map(tmpl => (
                  <tr key={tmpl.id} style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{tmpl.disease_name ?? '—'}</span></td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: tmpl.is_active ? '#dcfce7' : '#f3f4f6',
                        color: tmpl.is_active ? '#166534' : '#6b7280',
                      }}>
                        v{tmpl.version}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className={tmpl.is_active ? 'badge-active' : 'badge-inactive'}>
                        {tmpl.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--color-neutral-600)', fontSize: 12 }}>{formatDate(tmpl.created_at)}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" title="Edit schema" onClick={() => navigate(`/admin/templates/${tmpl.id}`)}>
                          <i className="pi pi-pencil" />
                        </button>
                        <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => confirmDelete(tmpl)}>
                          <i className="pi pi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-neutral-600)' }}>
              <span>Rows per page:</span>
              <select className="form-control" style={{ width: 70 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
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

      {/* Confirm Delete Dialog */}
      {confirmVisible && confirmTarget && (
        <div className="dialog-overlay" onClick={() => setConfirmVisible(false)}>
          <div className="dialog" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Confirm Delete</h3>
              <button className="btn-icon" onClick={() => setConfirmVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <p>Delete template <strong>v{confirmTarget.version}</strong> for "{confirmTarget.disease_name}"?</p>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setConfirmVisible(false)}>Cancel</button>
              <button className="btn-danger" onClick={deleteTemplate}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'left',
  color: 'var(--color-neutral-600)',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};

export default TemplatesListPage;
