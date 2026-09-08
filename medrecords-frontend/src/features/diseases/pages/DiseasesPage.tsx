/**
 * Diseases Page - Disease management with sub-diseases.
 * Matches Angular DiseasesComponent.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface Disease {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SubDisease {
  id: number;
  disease_id: number;
  name: string;
  is_active: boolean;
}

interface PaginatedResponse {
  items: Disease[];
  total: number;
  page: number;
  page_size: number;
}

const apiClient = createTypedApiClient();

export function DiseasesPage() {
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Expanded rows & sub-diseases
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [subDiseases, setSubDiseases] = useState<Record<number, SubDisease[]>>({});
  const [subDiseaseLoading, setSubDiseaseLoading] = useState<Record<number, boolean>>({});

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingDisease, setEditingDisease] = useState<Disease | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Sub-disease dialog
  const [subDialogVisible, setSubDialogVisible] = useState(false);
  const [subDiseaseParent, setSubDiseaseParent] = useState<Disease | null>(null);
  const [newSubDiseaseName, setNewSubDiseaseName] = useState('');

  // Confirm dialog
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Disease | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDiseases = useCallback(async (page: number, size: number, search: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: size, include_inactive: 'true' };
      if (search.trim()) params.search = search.trim();
      const res = await apiClient.get<PaginatedResponse>('/diseases/', { params });
      setDiseases(res.data.items);
      setTotalRecords(res.data.total);
    } catch {
      showToast('error', 'Failed to load diseases');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDiseases(currentPage, pageSize, searchTerm);
  }, [currentPage, pageSize, loadDiseases, searchTerm]);

  function onSearchChange(value: string) {
    setSearchTerm(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
  }

  // Toggle row expansion
  function toggleRow(diseaseId: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(diseaseId)) {
        next.delete(diseaseId);
      } else {
        next.add(diseaseId);
        if (!subDiseases[diseaseId]) {
          loadSubDiseases(diseaseId);
        }
      }
      return next;
    });
  }

  async function loadSubDiseases(diseaseId: number) {
    setSubDiseaseLoading(prev => ({ ...prev, [diseaseId]: true }));
    try {
      const res = await apiClient.get<SubDisease[]>(`/diseases/${diseaseId}/sub-diseases`);
      setSubDiseases(prev => ({ ...prev, [diseaseId]: res.data }));
    } catch { /* ignore */ }
    setSubDiseaseLoading(prev => ({ ...prev, [diseaseId]: false }));
  }

  // Add/Edit dialog
  function openAddDialog() {
    setEditingDisease(null);
    setFormName('');
    setFormDescription('');
    setDialogVisible(true);
  }

  function openEditDialog(disease: Disease) {
    setEditingDisease(disease);
    setFormName(disease.name);
    setFormDescription(disease.description ?? '');
    setDialogVisible(true);
  }

  async function saveDisease() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = { name: formName.trim(), description: formDescription.trim() || null };
      if (editingDisease) {
        await apiClient.patch(`/diseases/${editingDisease.id}`, payload);
        showToast('success', 'Disease updated successfully');
      } else {
        await apiClient.post('/diseases/', payload);
        showToast('success', 'Disease created successfully');
      }
      setDialogVisible(false);
      loadDiseases(currentPage, pageSize, searchTerm);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Operation failed');
    }
    setSaving(false);
  }

  // Delete / Restore
  function confirmDelete(disease: Disease) {
    setConfirmTarget(disease);
    setConfirmVisible(true);
  }

  async function deleteDisease() {
    if (!confirmTarget) return;
    try {
      await apiClient.delete(`/diseases/${confirmTarget.id}`);
      showToast('success', 'Disease deactivated');
      setConfirmVisible(false);
      loadDiseases(currentPage, pageSize, searchTerm);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Delete failed');
    }
  }

  async function restore(disease: Disease) {
    try {
      await apiClient.post(`/diseases/${disease.id}/restore`, {});
      showToast('success', 'Disease restored');
      loadDiseases(currentPage, pageSize, searchTerm);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Restore failed');
    }
  }

  // Sub-disease management
  function openAddSubDisease(disease: Disease) {
    setSubDiseaseParent(disease);
    setNewSubDiseaseName('');
    setSubDialogVisible(true);
    if (!subDiseases[disease.id]) {
      loadSubDiseases(disease.id);
    }
  }

  async function saveSubDisease() {
    if (!subDiseaseParent || !newSubDiseaseName.trim()) return;
    setSaving(true);
    try {
      await apiClient.post(`/diseases/${subDiseaseParent.id}/sub-diseases`, { name: newSubDiseaseName.trim() });
      showToast('success', 'Sub-disease added');
      loadSubDiseases(subDiseaseParent.id);
      setSubDialogVisible(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Failed to add sub-disease');
    }
    setSaving(false);
  }

  async function deleteSubDisease(diseaseId: number, subId: number) {
    try {
      await apiClient.delete(`/diseases/${diseaseId}/sub-diseases/${subId}`);
      showToast('success', 'Sub-disease removed');
      loadSubDiseases(diseaseId);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Delete failed');
    }
  }

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Disease Management</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>Manage diseases and their sub-classifications</p>
        </div>
        <button className="btn-primary" onClick={openAddDialog}>
          <i className="pi pi-plus" /> Add Disease
        </button>
      </div>

      <div className="card">
        {/* Search bar */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <i className="pi pi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-500)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search diseases..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </span>
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
                <th style={{ ...thStyle, width: '3rem' }}></th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Description</th>
                <th style={{ ...thStyle, width: 110 }}>Status</th>
                <th style={{ ...thStyle, width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {diseases.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--color-neutral-400)' }}>
                    No diseases found.
                  </td>
                </tr>
              ) : (
                diseases.map(disease => (
                  <DiseaseRow
                    key={disease.id}
                    disease={disease}
                    expanded={expandedRows.has(disease.id)}
                    onToggle={() => toggleRow(disease.id)}
                    onEdit={() => openEditDialog(disease)}
                    onDelete={() => confirmDelete(disease)}
                    onRestore={() => restore(disease)}
                    subDiseases={subDiseases[disease.id]}
                    subLoading={subDiseaseLoading[disease.id]}
                    onAddSub={() => openAddSubDisease(disease)}
                    onDeleteSub={(subId) => deleteSubDisease(disease.id, subId)}
                  />
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

      {/* Add/Edit Disease Dialog */}
      {dialogVisible && (
        <div className="dialog-overlay" onClick={() => setDialogVisible(false)}>
          <div className="dialog" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>{editingDisease ? 'Edit Disease' : 'Add Disease'}</h3>
              <button className="btn-icon" onClick={() => setDialogVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <div className="form-field-group">
                <label className="label">Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Disease name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-field-group" style={{ marginTop: 16 }}>
                <label className="label">Description</label>
                <textarea
                  className="form-control"
                  placeholder="Optional description"
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setDialogVisible(false)}>Cancel</button>
              <button className="btn-primary" disabled={!formName.trim() || saving} onClick={saveDisease}>
                {saving ? 'Saving...' : editingDisease ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Sub-Disease Dialog */}
      {subDialogVisible && (
        <div className="dialog-overlay" onClick={() => setSubDialogVisible(false)}>
          <div className="dialog" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Add Sub-Disease</h3>
              <button className="btn-icon" onClick={() => setSubDialogVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--color-neutral-600)' }}>
                Disease: <strong>{subDiseaseParent?.name}</strong>
              </div>
              <div className="form-field-group">
                <label className="label">Sub-Disease Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Sub-disease name"
                  value={newSubDiseaseName}
                  onChange={(e) => setNewSubDiseaseName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setSubDialogVisible(false)}>Cancel</button>
              <button className="btn-primary" disabled={!newSubDiseaseName.trim() || saving} onClick={saveSubDisease}>
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmVisible && confirmTarget && (
        <div className="dialog-overlay" onClick={() => setConfirmVisible(false)}>
          <div className="dialog" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Confirm Deactivate</h3>
              <button className="btn-icon" onClick={() => setConfirmVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <p>Are you sure you want to deactivate <strong>{confirmTarget.name}</strong>?</p>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setConfirmVisible(false)}>Cancel</button>
              <button className="btn-danger" onClick={deleteDisease}>Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Disease Row sub-component
interface DiseaseRowProps {
  disease: Disease;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  subDiseases?: SubDisease[];
  subLoading?: boolean;
  onAddSub: () => void;
  onDeleteSub: (subId: number) => void;
}

function DiseaseRow({ disease, expanded, onToggle, onEdit, onDelete, onRestore, subDiseases, subLoading, onAddSub, onDeleteSub }: DiseaseRowProps) {
  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
        <td style={tdStyle}>
          <button className="btn-icon" onClick={onToggle} style={{ width: 28, height: 28 }}>
            <i className={`pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'}`} />
          </button>
        </td>
        <td style={tdStyle}><span style={{ fontWeight: 600 }}>{disease.name}</span></td>
        <td style={tdStyle}><span style={{ color: 'var(--color-neutral-600)' }}>{disease.description || '—'}</span></td>
        <td style={tdStyle}>
          <span className={disease.is_active ? 'badge-active' : 'badge-inactive'}>
            {disease.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-icon" title="Edit" onClick={onEdit}><i className="pi pi-pencil" /></button>
            {disease.is_active ? (
              <button className="btn-icon btn-icon-danger" title="Deactivate" onClick={onDelete}><i className="pi pi-trash" /></button>
            ) : (
              <button className="btn-icon btn-icon-success" title="Restore" onClick={onRestore}><i className="pi pi-refresh" /></button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: '16px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-600)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Sub-Diseases
              </h4>
              <button className="btn-secondary btn-sm" onClick={onAddSub}>
                <i className="pi pi-plus" /> Add Sub-Disease
              </button>
            </div>
            {subLoading ? (
              <p style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>Loading...</p>
            ) : !subDiseases?.length ? (
              <p style={{ color: 'var(--color-neutral-400)', fontSize: 13, fontStyle: 'italic' }}>No sub-diseases found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, color: 'var(--color-neutral-600)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, color: 'var(--color-neutral-600)', width: 100 }}>Status</th>
                    <th style={{ width: 80, padding: '6px 12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {subDiseases.map(sub => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                      <td style={{ padding: '6px 12px' }}>{sub.name}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <span className={sub.is_active ? 'badge-active' : 'badge-inactive'}>
                          {sub.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <button className="btn-icon btn-icon-danger" title="Delete sub-disease" onClick={() => onDeleteSub(sub.id)}>
                          <i className="pi pi-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
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

export default DiseasesPage;
