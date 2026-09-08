/**
 * Doctors Page - Doctor account management.
 * Matches Angular DoctorsComponent.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface Doctor {
  id: number;
  full_name: string;
  username: string;
  email: string;
  specialty: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface PaginatedResponse {
  items: Doctor[];
  total: number;
  page: number;
  page_size: number;
}

const apiClient = createTypedApiClient();

export function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Doctor dialog
  const [doctorDialogVisible, setDoctorDialogVisible] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Reset password dialog
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [resetTarget, setResetTarget] = useState<Doctor | null>(null);
  const [resetPassword, setResetPasswordVal] = useState('');

  // Confirm dialog
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Doctor | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDoctors = useCallback(async (page: number, size: number, search: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: size, role: 'doctor' };
      if (search.trim()) params.search = search.trim();
      const res = await apiClient.get<PaginatedResponse>('/users/', { params });
      setDoctors(res.data.items);
      setTotalRecords(res.data.total);
    } catch {
      showToast('error', 'Failed to load doctors');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDoctors(currentPage, pageSize, searchTerm);
  }, [currentPage, pageSize, loadDoctors, searchTerm]);

  function onSearchChange(value: string) {
    setSearchTerm(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
  }

  // Add/Edit dialog
  function openAddDialog() {
    setEditingDoctor(null);
    setFormFullName('');
    setFormUsername('');
    setFormEmail('');
    setFormSpecialty('');
    setFormPassword('');
    setDoctorDialogVisible(true);
  }

  function openEditDialog(doctor: Doctor) {
    setEditingDoctor(doctor);
    setFormFullName(doctor.full_name);
    setFormUsername(doctor.username);
    setFormEmail(doctor.email);
    setFormSpecialty(doctor.specialty ?? '');
    setFormPassword('');
    setDoctorDialogVisible(true);
  }

  async function saveDoctor() {
    if (!formFullName.trim() || !formEmail.trim()) return;
    if (!editingDoctor && (!formUsername.trim() || !formPassword)) return;

    setSaving(true);
    try {
      if (editingDoctor) {
        await apiClient.patch(`/users/${editingDoctor.id}`, {
          full_name: formFullName.trim(),
          email: formEmail.trim(),
          specialty: formSpecialty.trim() || null,
        });
        showToast('success', 'Doctor updated successfully');
      } else {
        await apiClient.post('/users/', {
          full_name: formFullName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          specialty: formSpecialty.trim() || null,
          password: formPassword,
          role: 'doctor',
        });
        showToast('success', 'Doctor account created successfully');
      }
      setDoctorDialogVisible(false);
      loadDoctors(currentPage, pageSize, searchTerm);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? (editingDoctor ? 'Update failed' : 'Create failed'));
    }
    setSaving(false);
  }

  // Reset password
  function openResetPasswordDialog(doctor: Doctor) {
    setResetTarget(doctor);
    setResetPasswordVal('');
    setResetDialogVisible(true);
  }

  async function submitResetPassword() {
    if (!resetTarget || !resetPassword) return;
    setResetting(true);
    try {
      await apiClient.post(`/users/${resetTarget.id}/reset-password`, { password: resetPassword });
      showToast('success', `Password reset for ${resetTarget.full_name}`);
      setResetDialogVisible(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Password reset failed');
    }
    setResetting(false);
  }

  // Soft delete
  function confirmDelete(doctor: Doctor) {
    setConfirmTarget(doctor);
    setConfirmVisible(true);
  }

  async function deleteDoctor() {
    if (!confirmTarget) return;
    try {
      await apiClient.delete(`/users/${confirmTarget.id}`);
      showToast('success', `${confirmTarget.full_name} deactivated`);
      setConfirmVisible(false);
      loadDoctors(currentPage, pageSize, searchTerm);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Delete failed');
    }
  }

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Doctor Accounts</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Manage doctor accounts — create, edit, reset passwords and deactivate
          </p>
        </div>
        <button className="btn-primary" onClick={openAddDialog}>
          <i className="pi pi-plus" /> Add Doctor
        </button>
      </div>

      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <i className="pi pi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-500)', zIndex: 1 }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, username…"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginLeft: 'auto' }}>
            {totalRecords} record(s)
          </span>
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
                <th style={thStyle}>Full Name</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Specialty</th>
                <th style={{ ...thStyle, width: 110 }}>Status</th>
                <th style={{ ...thStyle, width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
                    <i className="pi pi-users" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    No doctors found.
                  </td>
                </tr>
              ) : (
                doctors.map(doctor => (
                  <tr key={doctor.id} style={{ borderBottom: '1px solid var(--color-neutral-100)', opacity: doctor.is_active ? 1 : 0.55 }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{doctor.full_name}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{doctor.email}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--color-neutral-700)', fontFamily: 'monospace' }}>{doctor.username}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--color-neutral-600)' }}>{doctor.specialty || '—'}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className={doctor.is_active ? 'badge-active' : 'badge-inactive'}>
                        {doctor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" title="Edit" onClick={() => openEditDialog(doctor)}>
                          <i className="pi pi-pencil" />
                        </button>
                        <button className="btn-icon btn-icon-warning" title="Reset Password" onClick={() => openResetPasswordDialog(doctor)}>
                          <i className="pi pi-key" />
                        </button>
                        {doctor.is_active && (
                          <button className="btn-icon btn-icon-danger" title="Deactivate" onClick={() => confirmDelete(doctor)}>
                            <i className="pi pi-trash" />
                          </button>
                        )}
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

      {/* Add/Edit Doctor Dialog */}
      {doctorDialogVisible && (
        <div className="dialog-overlay" onClick={() => setDoctorDialogVisible(false)}>
          <div className="dialog" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>{editingDoctor ? 'Edit Doctor' : 'Add Doctor'}</h3>
              <button className="btn-icon" onClick={() => setDoctorDialogVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <div className="form-field-group">
                <label className="label">Full Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="text" className="form-control" placeholder="e.g. Dr. Priya Sharma" value={formFullName} onChange={(e) => setFormFullName(e.target.value)} style={{ width: '100%' }} />
              </div>
              {!editingDoctor && (
                <div className="form-field-group" style={{ marginTop: 16 }}>
                  <label className="label">Username <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <input type="text" className="form-control" placeholder="e.g. dr.priya" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} style={{ width: '100%' }} autoComplete="username" />
                </div>
              )}
              <div className="form-field-group" style={{ marginTop: 16 }}>
                <label className="label">Email <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="email" className="form-control" placeholder="e.g. priya@hospital.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} style={{ width: '100%' }} autoComplete="email" />
              </div>
              <div className="form-field-group" style={{ marginTop: 16 }}>
                <label className="label">Specialty</label>
                <input type="text" className="form-control" placeholder="e.g. Cardiology, Neurology" value={formSpecialty} onChange={(e) => setFormSpecialty(e.target.value)} style={{ width: '100%' }} />
              </div>
              {!editingDoctor && (
                <div className="form-field-group" style={{ marginTop: 16 }}>
                  <label className="label">Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <input type="password" className="form-control" placeholder="Min 8 chars, at least one digit" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} style={{ width: '100%' }} autoComplete="new-password" />
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setDoctorDialogVisible(false)}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={saveDoctor}>
                {saving ? 'Saving…' : editingDoctor ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {resetDialogVisible && resetTarget && (
        <div className="dialog-overlay" onClick={() => setResetDialogVisible(false)}>
          <div className="dialog" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Reset Password</h3>
              <button className="btn-icon" onClick={() => setResetDialogVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-neutral-600)' }}>
                Setting new password for <strong>{resetTarget.full_name}</strong> ({resetTarget.username})
              </p>
              <div className="form-field-group">
                <label className="label">New Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="password" className="form-control" placeholder="Min 8 chars, at least one digit" value={resetPassword} onChange={(e) => setResetPasswordVal(e.target.value)} style={{ width: '100%' }} autoComplete="new-password" />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setResetDialogVisible(false)}>Cancel</button>
              <button className="btn-primary" disabled={!resetPassword || resetting} onClick={submitResetPassword}>
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deactivate Dialog */}
      {confirmVisible && confirmTarget && (
        <div className="dialog-overlay" onClick={() => setConfirmVisible(false)}>
          <div className="dialog" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Confirm Deactivate</h3>
              <button className="btn-icon" onClick={() => setConfirmVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <p>Are you sure you want to deactivate <strong>{confirmTarget.full_name}</strong>?</p>
              <p style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>The doctor will lose access to the portal.</p>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setConfirmVisible(false)}>Cancel</button>
              <button className="btn-danger" onClick={deleteDoctor}>Deactivate</button>
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

export default DoctorsPage;
