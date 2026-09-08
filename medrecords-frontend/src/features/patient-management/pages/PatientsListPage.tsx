/**
 * Patients List Page.
 * Matches Angular PatientsListComponent - paginated table with search.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface Patient {
  id: number;
  patient_uid: string;
  first_name: string;
  last_name: string;
  gender: string;
  contact_number: string;
  is_active: boolean;
}

interface PaginatedResponse {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
}

const apiClient = createTypedApiClient();

export function PatientsListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const prefix = location.pathname.startsWith('/admin') ? '/admin' : '/doctor';

  const loadPatients = useCallback(async (page: number, size: number, search: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: size };
      if (search.trim()) params.search = search.trim();
      const res = await apiClient.get<PaginatedResponse>('/patients/', { params });
      setPatients(res.data.items);
      setTotalRecords(res.data.total);
    } catch {
      setPatients([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPatients(currentPage, pageSize, searchTerm);
  }, [currentPage, pageSize, loadPatients, searchTerm]);

  function onSearchChange(value: string) {
    setSearchTerm(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
  }

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Patients</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Manage your registered patients
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate(`${prefix}/patients/new`)}>
          <i className="pi pi-plus" /> New Patient
        </button>
      </div>

      {/* Table Card */}
      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <i className="pi pi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-500)', zIndex: 1 }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or Patient ID..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginLeft: 'auto' }}>
            {totalRecords} patient(s)
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '1.5rem' }} />
            <p style={{ marginTop: 8, fontSize: 13 }}>Loading…</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Patient UID</th>
                <th style={thStyle}>Full Name</th>
                <th style={{ ...thStyle, width: 100 }}>Gender</th>
                <th style={thStyle}>Contact</th>
                <th style={{ ...thStyle, width: 110 }}>Status</th>
                <th style={{ ...thStyle, width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
                    <i className="pi pi-users" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    No patients found.
                  </td>
                </tr>
              ) : (
                patients.map(patient => (
                  <tr
                    key={patient.id}
                    style={{ borderBottom: '1px solid var(--color-neutral-100)', cursor: 'pointer', opacity: patient.is_active ? 1 : 0.55 }}
                    onClick={() => navigate(`${prefix}/patients/${patient.id}`)}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-neutral-100)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                        {patient.patient_uid}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{patient.first_name} {patient.last_name}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--color-neutral-600)' }}>{patient.gender}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--color-neutral-600)' }}>{patient.contact_number}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className={patient.is_active ? 'badge-active' : 'badge-inactive'}>
                        {patient.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        className="btn-icon"
                        title="View Patient"
                        onClick={(e) => { e.stopPropagation(); navigate(`${prefix}/patients/${patient.id}`); }}
                      >
                        <i className="pi pi-eye" />
                      </button>
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

export default PatientsListPage;
