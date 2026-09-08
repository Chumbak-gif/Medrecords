/**
 * User Management Page - Full user CRUD with role/status filters.
 * Matches Angular UserManagementComponent.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface UserRecord {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  items: UserRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const ROLE_OPTIONS = [
  { label: 'Doctor', value: 'doctor' },
  { label: 'Admin', value: 'admin' },
  { label: 'Pharma', value: 'pharma_viewer' },
  { label: 'Sys Admin', value: 'sys_admin' },
];

const ROLE_LABEL_MAP: Record<string, string> = {
  doctor: 'Doctor',
  admin: 'Admin',
  pharma_viewer: 'Pharma',
  sys_admin: 'Sys Admin',
};

const ROLE_BADGE_STYLES: Record<string, React.CSSProperties> = {
  doctor: { background: '#e0f2fe', color: '#0369a1', fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  admin: { background: '#fef9c3', color: '#854d0e', fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  pharma_viewer: { background: '#f0fdf4', color: '#166534', fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  sys_admin: { background: '#fce7f3', color: '#9d174d', fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
};

const apiClient = createTypedApiClient();

export function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // User dialog
  const [userDialogVisible, setUserDialogVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Reset password dialog
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  // Confirm dialog
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<UserRecord | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadUsers = useCallback(async (page: number, size: number, search: string, role: string, status: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: size };
      if (search.trim()) params.search = search.trim();
      if (role) params.role = role;
      const res = await apiClient.get<PaginatedResponse>('/users/', { params });
      let items = res.data.items;
      // Client-side active/inactive filter
      if (status === 'active') items = items.filter(u => u.is_active);
      else if (status === 'inactive') items = items.filter(u => !u.is_active);
      setUsers(items);
      setTotalRecords(res.data.total);
    } catch {
      showToast('error', 'Failed to load users');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers(currentPage, pageSize, searchTerm, selectedRole, selectedStatus);
  }, [currentPage, pageSize, loadUsers, searchTerm, selectedRole, selectedStatus]);

  function onSearchChange(value: string) {
    setSearchTerm(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return dateStr; }
  }

  // Create/Edit dialog
  function openAddDialog() {
    setEditingUser(null);
    setFormFullName('');
    setFormUsername('');
    setFormEmail('');
    setFormRole('');
    setFormSpecialty('');
    setFormPassword('');
    setUserDialogVisible(true);
  }

  function openEditDialog(user: UserRecord) {
    setEditingUser(user);
    setFormFullName(user.full_name);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormSpecialty(user.specialty ?? '');
    setFormPassword('');
    setUserDialogVisible(true);
  }

  async function saveUser() {
    if (!formFullName.trim() || !formEmail.trim() || !formRole) return;
    if (!editingUser && (!formUsername.trim() || !formPassword)) return;

    setSaving(true);
    try {
      if (editingUser) {
        await apiClient.patch(`/users/${editingUser.id}`, {
          full_name: formFullName.trim(),
          email: formEmail.trim(),
          role: formRole,
          specialty: formSpecialty.trim() || null,
        });
        showToast('success', 'User updated successfully');
      } else {
        await apiClient.post('/users/', {
          full_name: formFullName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          role: formRole,
          specialty: formSpecialty.trim() || null,
          password: formPassword,
        });
        showToast('success', 'User created successfully');
      }
      setUserDialogVisible(false);
      loadUsers(currentPage, pageSize, searchTerm, selectedRole, selectedStatus);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? (editingUser ? 'Update failed' : 'Create failed'));
    }
    setSaving(false);
  }

  // Reset password
  function openResetPasswordDialog(user: UserRecord) {
    setResetTarget(user);
    setResetPasswordVal('');
    setResetDialogVisible(true);
  }

  async function submitResetPassword() {
    if (!resetTarget || !resetPasswordVal) return;
    setResetting(true);
    try {
      await apiClient.post(`/users/${resetTarget.id}/reset-password`, { password: resetPasswordVal });
      showToast('success', `Password reset for ${resetTarget.full_name}`);
      setResetDialogVisible(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Password reset failed');
    }
    setResetting(false);
  }

  // Soft delete
  function confirmDelete(user: UserRecord) {
    setConfirmTarget(user);
    setConfirmVisible(true);
  }

  async function softDeleteUser() {
    if (!confirmTarget) return;
    try {
      await apiClient.delete(`/users/${confirmTarget.id}`);
      showToast('success', `${confirmTarget.full_name} deactivated`);
      setConfirmVisible(false);
      loadUsers(currentPage, pageSize, searchTerm, selectedRole, selectedStatus);
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
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>User Management</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Manage all platform users — create, edit, reset passwords and deactivate
          </p>
        </div>
        <button className="btn-primary" onClick={openAddDialog}>
          <i className="pi pi-plus" /> Create User
        </button>
      </div>

      <div className="card">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <i className="pi pi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-500)', zIndex: 1 }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search name, username, email…"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </span>
          <select className="form-control" style={{ minWidth: 160 }} value={selectedRole} onChange={(e) => { setSelectedRole(e.target.value); setCurrentPage(1); }}>
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select className="form-control" style={{ minWidth: 140 }} value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
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
                <th style={{ ...thStyle, width: 60 }}>ID</th>
                <th style={thStyle}>Full Name</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Email</th>
                <th style={{ ...thStyle, width: 120 }}>Role</th>
                <th style={{ ...thStyle, width: 100 }}>Status</th>
                <th style={{ ...thStyle, width: 120 }}>Created</th>
                <th style={{ ...thStyle, width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
                    <i className="pi pi-users" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--color-neutral-100)', opacity: user.is_active ? 1 : 0.55 }}>
                    <td style={{ ...tdStyle, color: 'var(--color-neutral-400)', fontSize: 12 }}>#{user.id}</td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{user.full_name}</span></td>
                    <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-neutral-700)' }}>{user.username}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{user.email}</span></td>
                    <td style={tdStyle}>
                      <span style={ROLE_BADGE_STYLES[user.role] ?? ROLE_BADGE_STYLES.doctor}>
                        {ROLE_LABEL_MAP[user.role] ?? user.role}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className={user.is_active ? 'badge-active' : 'badge-inactive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--color-neutral-500)' }}>{formatDate(user.created_at)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" title="Edit" onClick={() => openEditDialog(user)}>
                          <i className="pi pi-pencil" />
                        </button>
                        <button className="btn-icon btn-icon-warning" title="Reset Password" onClick={() => openResetPasswordDialog(user)}>
                          <i className="pi pi-key" />
                        </button>
                        {user.is_active && (
                          <button className="btn-icon btn-icon-danger" title="Deactivate" onClick={() => confirmDelete(user)}>
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

      {/* Create/Edit User Dialog */}
      {userDialogVisible && (
        <div className="dialog-overlay" onClick={() => setUserDialogVisible(false)}>
          <div className="dialog" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>{editingUser ? 'Edit User' : 'Create User'}</h3>
              <button className="btn-icon" onClick={() => setUserDialogVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <div className="form-field-group">
                <label className="label">Full Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="text" className="form-control" placeholder="e.g. Dr. Anjali Mehta" value={formFullName} onChange={(e) => setFormFullName(e.target.value)} style={{ width: '100%' }} />
              </div>
              {!editingUser && (
                <div className="form-field-group" style={{ marginTop: 16 }}>
                  <label className="label">Username <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <input type="text" className="form-control" placeholder="e.g. anjali.mehta" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} style={{ width: '100%' }} autoComplete="username" />
                </div>
              )}
              <div className="form-field-group" style={{ marginTop: 16 }}>
                <label className="label">Email <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="email" className="form-control" placeholder="e.g. anjali@hospital.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} style={{ width: '100%' }} autoComplete="email" />
              </div>
              <div className="form-field-group" style={{ marginTop: 16 }}>
                <label className="label">Role <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select className="form-control" value={formRole} onChange={(e) => setFormRole(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select role</option>
                  {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              {formRole === 'doctor' && (
                <div className="form-field-group" style={{ marginTop: 16 }}>
                  <label className="label">Specialty</label>
                  <input type="text" className="form-control" placeholder="e.g. Cardiology" value={formSpecialty} onChange={(e) => setFormSpecialty(e.target.value)} style={{ width: '100%' }} />
                </div>
              )}
              {!editingUser && (
                <div className="form-field-group" style={{ marginTop: 16 }}>
                  <label className="label">Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <input type="password" className="form-control" placeholder="Min 8 chars, uppercase, digit, special char" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} style={{ width: '100%' }} autoComplete="new-password" />
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setUserDialogVisible(false)}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={saveUser}>
                {saving ? 'Saving…' : editingUser ? 'Update' : 'Create'}
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
                Setting new password for <strong>{resetTarget.full_name}</strong> (<span style={{ fontFamily: 'monospace' }}>{resetTarget.username}</span>)
              </p>
              <div className="form-field-group">
                <label className="label">New Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input type="password" className="form-control" placeholder="Min 8 chars, uppercase, digit, special char" value={resetPasswordVal} onChange={(e) => setResetPasswordVal(e.target.value)} style={{ width: '100%' }} autoComplete="new-password" />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setResetDialogVisible(false)}>Cancel</button>
              <button className="btn-primary" disabled={!resetPasswordVal || resetting} onClick={submitResetPassword}>
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
              <p style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>The user will lose access to the portal.</p>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setConfirmVisible(false)}>Cancel</button>
              <button className="btn-danger" onClick={softDeleteUser}>Deactivate</button>
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

export default UserManagementPage;
