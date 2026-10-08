/**
 * Patient Detail Page.
 * Matches Angular PatientDetailComponent - demographics, visit history,
 * follow-ups, follow-up scheduling dialog and PDF export.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

// ── Models ──────────────────────────────────────────────────────────────
interface Patient {
  id: number;
  patient_uid: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  contact_number: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

interface AssessmentSummary {
  id: number;
  visit_date: string;
  disease_name: string;
  sub_disease_name: string | null;
  status: 'draft' | 'submitted' | 'locked' | string;
  doctor_name?: string | null;
}

interface AssociatedDoctor {
  id: number;
  full_name: string;
  specialty: string | null;
  role: string;
  is_registering_doctor: boolean;
  visit_count: number;
}

interface Followup {
  id: number;
  patient_id: number;
  doctor_id: number;
  assessment_id: number | null;
  scheduled_date: string;
  notes: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface FollowupListResponse {
  items: Followup[];
  total: number;
  page: number;
  page_size: number;
}

const apiClient = createTypedApiClient();

// ── Date helper: 'dd MMM yyyy' ──────────────────────────────────────────
function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function titleCase(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// ── Inline Status Badge (mirrors Angular StatusBadgeComponent) ──────────
function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const classMap: Record<string, string> = {
    active: 'badge-active',
    approved: 'badge-approved',
    completed: 'badge-completed',
    success: 'badge-active',
    pending: 'badge-pending',
    warning: 'badge-pending',
    overdue: 'badge-overdue',
    rejected: 'badge-rejected',
    error: 'badge-rejected',
    cancelled: 'badge-rejected',
    expired: 'badge-expired',
    draft: 'badge-draft',
    submitted: 'badge-submitted',
    info: 'badge-info',
    locked: 'badge-info',
    inactive: 'badge-inactive',
  };
  const cls = classMap[s] ?? 'badge-default';
  return <span className={cls}>{titleCase(status)}</span>;
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const prefix = location.pathname.startsWith('/admin') ? '/admin' : '/doctor';
  // Assessments are a doctor-only workflow (no admin assessment routes exist),
  // so assessment actions are only shown in the doctor context.
  const isDoctorContext = prefix === '/doctor';

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [associatedDoctors, setAssociatedDoctors] = useState<AssociatedDoctor[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [showFollowupDialog, setShowFollowupDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Confirm dialog state
  const [confirmConfig, setConfirmConfig] = useState<{
    header: string;
    message: string;
    acceptClass: string;
    onAccept: () => void;
  } | null>(null);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Sort follow-ups: pending (asc) first, then others (desc) ──────────
  const sortFollowups = useCallback((items: Followup[]): Followup[] => {
    const pending = items
      .filter(f => f.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    const others = items
      .filter(f => f.status !== 'pending')
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());
    return [...pending, ...others];
  }, []);

  const loadFollowups = useCallback(async (patientId: number) => {
    try {
      const res = await apiClient.get<FollowupListResponse>('/followups/', {
        params: { patient_id: patientId, page_size: 100 },
      });
      setFollowups(sortFollowups(res.data.items));
    } catch {
      showToast('error', 'Failed to load follow-ups');
    }
  }, [sortFollowups]);

  const loadPatient = useCallback(async (patientId: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<Record<string, unknown>>(`/patients/${patientId}`);
      const detail = res.data;
      let loadedPatient: Patient | null = null;

      // Handle both response shapes:
      // Shape 1 (expected): { patient: {...}, assessments: [...] }
      // Shape 2 (actual API): { id, first_name, ..., visits: [...] }
      if (detail.patient) {
        loadedPatient = detail.patient as Patient;
        setPatient(loadedPatient);
        setAssessments((detail.assessments as AssessmentSummary[]) ?? []);
        setAssociatedDoctors((detail.associated_doctors as AssociatedDoctor[]) ?? []);
      } else {
        const { visits, associated_doctors, ...patientData } = detail as Record<string, unknown> & {
          visits?: unknown[];
          associated_doctors?: AssociatedDoctor[];
        };
        loadedPatient = patientData as unknown as Patient;
        setPatient(loadedPatient);
        setAssessments(
          ((visits as Record<string, unknown>[]) ?? []).map((v) => ({
            id: (v.assessment_id ?? v.id) as number,
            visit_date: (v.visit_date ?? v.created_at) as string,
            disease_name: (v.disease_name ?? '') as string,
            sub_disease_name: (v.sub_disease_name ?? null) as string | null,
            status: v.status as string,
            doctor_name: (v.doctor_name ?? null) as string | null,
          }))
        );
        setAssociatedDoctors(associated_doctors ?? []);
      }
      setLoading(false);
      if (loadedPatient?.id) {
        loadFollowups(loadedPatient.id);
      }
    } catch {
      showToast('error', 'Failed to load patient details');
      setPatient(null);
      setLoading(false);
    }
  }, [loadFollowups]);

  useEffect(() => {
    const numericId = Number(id);
    if (!numericId) {
      setLoading(false);
      return;
    }
    loadPatient(numericId);
  }, [id, loadPatient]);

  // ── Navigation ────────────────────────────────────────────────────────
  function goBack() {
    navigate(`${prefix}/patients`);
  }

  function goToEdit() {
    setShowEditDialog(true);
  }

  function onPatientUpdated(updated: Patient) {
    setShowEditDialog(false);
    setPatient((prev) => (prev ? { ...prev, ...updated } : updated));
    showToast('success', 'Patient details updated successfully.');
  }

  function newAssessment() {
    navigate(`/doctor/assessments/new?patientId=${patient?.id}`);
  }

  function viewAssessment(assessmentId: number) {
    navigate(`/doctor/assessments/${assessmentId}`);
  }

  async function downloadPdf(assessmentId: number) {
    try {
      await exportAssessmentPdf(assessmentId);
    } catch {
      showToast('error', 'Failed to generate PDF');
    }
  }

  function onFollowupCreated() {
    setShowFollowupDialog(false);
    showToast('success', 'Follow-up has been scheduled successfully.');
    if (patient?.id) loadFollowups(patient.id);
  }

  // ── Follow-up actions ─────────────────────────────────────────────────
  function markComplete(followup: Followup) {
    setConfirmConfig({
      header: 'Confirm Complete',
      message: 'Are you sure you want to mark this follow-up as <strong>completed</strong>?',
      acceptClass: 'btn-primary',
      onAccept: () => updateFollowupStatus(followup, 'completed', 'Follow-up has been marked as completed.'),
    });
  }

  function markCancelled(followup: Followup) {
    setConfirmConfig({
      header: 'Confirm Cancel',
      message: 'Are you sure you want to <strong>cancel</strong> this follow-up?',
      acceptClass: 'btn-danger',
      onAccept: () => updateFollowupStatus(followup, 'cancelled', 'Follow-up has been cancelled.'),
    });
  }

  async function updateFollowupStatus(followup: Followup, status: 'completed' | 'cancelled', successMsg: string) {
    setConfirmConfig(null);
    try {
      await apiClient.patch(`/followups/${followup.id}`, { status });
      showToast('success', successMsg);
      if (patient?.id) loadFollowups(patient.id);
    } catch {
      showToast('error', 'Failed to update follow-up status. Please try again.');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function truncateNotes(notes: string | null): string {
    if (!notes) return '—';
    return notes.length > 100 ? notes.substring(0, 100) + '…' : notes;
  }

  function followupBadgeClass(status: string): string {
    switch (status) {
      case 'pending': return 'badge-submitted';
      case 'completed': return 'badge-active';
      case 'cancelled': return 'badge-expired';
      default: return 'badge-default';
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {loading ? (
        // Skeleton loader
        <>
          <div className="page-header">
            <div style={{ width: 200, height: 28, background: 'var(--color-neutral-100)', borderRadius: 6 }} />
            <div style={{ width: 120, height: 36, background: 'var(--color-neutral-100)', borderRadius: 6 }} />
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ height: 120, background: 'var(--color-neutral-100)', borderRadius: 6 }} />
          </div>
          <div className="card">
            <div style={{ height: 200, background: 'var(--color-neutral-100)', borderRadius: 6 }} />
          </div>
        </>
      ) : patient ? (
        <>
          {/* Page Header */}
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn-icon" title="Back to Patients" onClick={goBack}>
                <i className="pi pi-arrow-left" />
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  {patient.first_name} {patient.last_name}
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
                  Patient Profile
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={goToEdit}>
                <i className="pi pi-pencil" /> Edit Patient
              </button>
              <button className="btn-secondary" onClick={() => setShowFollowupDialog(true)}>
                <i className="pi pi-calendar-plus" /> Schedule Follow-up
              </button>
              {isDoctorContext && (
                <button className="btn-primary" onClick={newAssessment}>
                  <i className="pi pi-plus" /> New Assessment
                </button>
              )}
            </div>
          </div>

          {/* Demographics Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 13, background: 'var(--color-primary)', color: '#fff',
                padding: '4px 12px', borderRadius: 6, fontWeight: 700, letterSpacing: '0.5px',
              }}>
                {patient.patient_uid}
              </span>
              <StatusBadge status={patient.is_active ? 'active' : 'inactive'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <InfoField label="Full Name" value={`${patient.first_name} ${patient.last_name}`} />
              <InfoField label="Date of Birth" value={formatDisplayDate(patient.date_of_birth)} />
              <InfoField label="Gender" value={patient.gender} />
              <InfoField label="Contact Number" value={patient.contact_number} />
              <InfoField label="Email" value={patient.email || '—'} />
              <InfoField label="Registered On" value={formatDisplayDate(patient.created_at)} />
            </div>
          </div>

          {/* Associated Doctors Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Associated Doctors</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
                Doctors who registered or have treated this patient
              </p>
            </div>
            {associatedDoctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-neutral-400)' }}>
                <i className="pi pi-users" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }} />
                No doctors associated with this patient yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {associatedDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-neutral-200)',
                      background: 'var(--color-neutral-50)',
                      minWidth: 220,
                    }}
                  >
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--color-primary)', color: '#fff', flexShrink: 0,
                    }}>
                      <i className="pi pi-user" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-neutral-900)' }}>{doc.full_name}</span>
                        {doc.is_registering_doctor && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                            background: '#e0f2fe', color: '#0369a1',
                          }}>
                            REGISTERED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
                        {doc.specialty ? `${doc.specialty} · ` : ''}{doc.visit_count} visit{doc.visit_count === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visit History Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Visit History</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
                  {assessments.length} visit(s) recorded
                </p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, minWidth: 130 }}>Visit Date</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>Disease</th>
                  <th style={{ ...thStyle, minWidth: 160 }}>Sub-Disease</th>
                  <th style={{ ...thStyle, minWidth: 160 }}>Doctor</th>
                  <th style={{ ...thStyle, width: 120 }}>Status</th>
                  <th style={{ ...thStyle, width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assessments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
                      <i className="pi pi-file-o" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                      No visits recorded yet.
                      {isDoctorContext && (
                        <>
                          <br />
                          <button className="btn-primary" style={{ marginTop: 12 }} onClick={newAssessment}>
                            <i className="pi pi-plus" /> Start First Visit
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  assessments.map(assessment => (
                    <tr key={assessment.id} style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600 }}>{formatDisplayDate(assessment.visit_date)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span>{assessment.disease_name}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--color-neutral-600)' }}>{assessment.sub_disease_name || '—'}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--color-neutral-600)' }}>{assessment.doctor_name || '—'}</span>
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={assessment.status} />
                      </td>
                      <td style={tdStyle}>
                        {isDoctorContext && (
                          <button className="btn-icon" title="View Assessment" onClick={() => viewAssessment(assessment.id)}>
                            <i className="pi pi-eye" />
                          </button>
                        )}
                        <button className="btn-icon btn-icon-danger" title="Download PDF" onClick={() => downloadPdf(assessment.id)}>
                          <i className="pi pi-file-pdf" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Follow-ups Section */}
          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Follow-ups</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
                  {followups.length} follow-up(s) scheduled
                </p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, minWidth: 130 }}>Scheduled Date</th>
                  <th style={{ ...thStyle, minWidth: 200 }}>Notes</th>
                  <th style={{ ...thStyle, width: 120 }}>Status</th>
                  <th style={{ ...thStyle, width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {followups.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
                      <i className="pi pi-calendar" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                      No follow-ups scheduled for this patient.
                    </td>
                  </tr>
                ) : (
                  followups.map(followup => (
                    <tr key={followup.id} style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600 }}>{formatDisplayDate(followup.scheduled_date)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--color-neutral-600)' }}>{truncateNotes(followup.notes)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span className={followupBadgeClass(followup.status)}>{titleCase(followup.status)}</span>
                      </td>
                      <td style={tdStyle}>
                        {followup.status === 'pending' && (
                          <>
                            <button className="btn-icon btn-icon-success" title="Mark Complete" onClick={() => markComplete(followup)}>
                              <i className="pi pi-check" />
                            </button>
                            <button className="btn-icon btn-icon-danger" title="Cancel Follow-up" onClick={() => markCancelled(followup)}>
                              <i className="pi pi-times" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        // Error / Not Found state
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <i className="pi pi-user-minus" style={{ fontSize: '3rem', color: 'var(--color-neutral-300)', display: 'block', marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--color-neutral-600)' }}>Patient not found</h3>
          <p style={{ color: 'var(--color-neutral-500)', margin: '0 0 20px' }}>
            The patient you're looking for doesn't exist or has been removed.
          </p>
          <button className="btn-secondary" onClick={goBack}>
            <i className="pi pi-arrow-left" /> Back to Patients
          </button>
        </div>
      )}

      {/* Follow-up Dialog */}
      {showFollowupDialog && patient && (
        <FollowupDialog
          patientId={patient.id}
          onClose={() => setShowFollowupDialog(false)}
          onCreated={onFollowupCreated}
        />
      )}

      {/* Edit Patient Dialog */}
      {showEditDialog && patient && (
        <EditPatientDialog
          patient={patient}
          onClose={() => setShowEditDialog(false)}
          onUpdated={onPatientUpdated}
        />
      )}

      {/* Confirm Dialog */}
      {confirmConfig && (
        <div className="dialog-overlay" onClick={() => setConfirmConfig(null)}>
          <div className="dialog" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>{confirmConfig.header}</h3>
              <button className="btn-icon" onClick={() => setConfirmConfig(null)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <p dangerouslySetInnerHTML={{ __html: confirmConfig.message }} />
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setConfirmConfig(null)}>Cancel</button>
              <button className={confirmConfig.acceptClass} onClick={confirmConfig.onAccept}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Info Field ────────────────────────────────────────────────────────────
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-neutral-500)', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: 'var(--color-neutral-800)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

// ── Follow-up Dialog (mirrors the calendar ScheduleDialog, patient pre-set) ──
interface DiseaseOption {
  id: number;
  name: string;
}

const TIME_SLOTS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '09:30 AM', value: '09:30' },
  { label: '10:00 AM', value: '10:00' },
  { label: '10:30 AM', value: '10:30' },
  { label: '11:00 AM', value: '11:00' },
  { label: '11:30 AM', value: '11:30' },
  { label: '12:00 PM', value: '12:00' },
  { label: '12:30 PM', value: '12:30' },
  { label: '01:00 PM', value: '13:00' },
  { label: '01:30 PM', value: '13:30' },
  { label: '02:00 PM', value: '14:00' },
  { label: '02:30 PM', value: '14:30' },
  { label: '03:00 PM', value: '15:00' },
  { label: '03:30 PM', value: '15:30' },
  { label: '04:00 PM', value: '16:00' },
  { label: '04:30 PM', value: '16:30' },
  { label: '05:00 PM', value: '17:00' },
  { label: '05:30 PM', value: '17:30' },
  { label: '06:00 PM', value: '18:00' },
];

interface FollowupDialogProps {
  patientId: number;
  assessmentId?: number;
  onClose: () => void;
  onCreated: () => void;
}

function FollowupDialog({ patientId, assessmentId, onClose, onCreated }: FollowupDialogProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [selectedDisease, setSelectedDisease] = useState<number | ''>('');
  const [diseaseOptions, setDiseaseOptions] = useState<DiseaseOption[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const toDateInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Min date: tomorrow, Max date: today + 365 days
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate = new Date();
  maxDate.setHours(0, 0, 0, 0);
  maxDate.setDate(maxDate.getDate() + 365);

  const minStr = toDateInput(tomorrow);
  const maxStr = toDateInput(maxDate);

  // Load diseases for the optional disease dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{ items: DiseaseOption[]; total: number }>('/diseases/', {
          params: { page_size: 100, include_inactive: 'false' },
        });
        setDiseaseOptions(res.data.items.map((d) => ({ id: d.id, name: d.name })));
      } catch {
        setDiseaseOptions([]);
      }
    })();
  }, []);

  async function submit() {
    if (!scheduledDate) {
      setDateError('Follow-up date is required');
      return;
    }
    const selected = new Date(scheduledDate);
    selected.setHours(0, 0, 0, 0);
    if (selected < tomorrow || selected > maxDate) {
      setDateError('Date must be between tomorrow and 365 days from today');
      return;
    }
    setDateError(null);
    setSaving(true);

    // Prefix notes with the chosen time slot (mirrors the calendar dialog)
    let finalNotes = notes.trim();
    if (timeSlot) {
      const slotLabel = TIME_SLOTS.find((s) => s.value === timeSlot)?.label ?? timeSlot;
      finalNotes = `[${slotLabel}] ${finalNotes}`.trim();
    }

    // Note: the backend FollowupCreate schema accepts patient_id, assessment_id,
    // scheduled_date and notes only. The selected disease is folded into the
    // notes (as the calendar dialog does) since there is no disease_id field.
    if (selectedDisease !== '') {
      const diseaseName = diseaseOptions.find((d) => d.id === selectedDisease)?.name;
      if (diseaseName) finalNotes = `[${diseaseName}] ${finalNotes}`.trim();
    }

    const payload: Record<string, unknown> = {
      patient_id: patientId,
      scheduled_date: scheduledDate,
      ...(assessmentId != null && { assessment_id: assessmentId }),
      ...(finalNotes && { notes: finalNotes }),
    };

    try {
      await apiClient.post('/followups/', payload);
      setSaving(false);
      onCreated();
    } catch (err: unknown) {
      setSaving(false);
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setDateError(detail ?? 'Could not save follow-up. Please try again.');
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Schedule Follow-up</h3>
          <button className="btn-icon" onClick={onClose}><i className="pi pi-times" /></button>
        </div>
        <div className="dialog-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
            {/* Date */}
            <div className="form-field-group">
              <label className="label">
                Date <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={scheduledDate}
                min={minStr}
                max={maxStr}
                onChange={(e) => { setScheduledDate(e.target.value); setDateError(null); }}
                style={{ width: '100%' }}
              />
              {dateError && <span style={{ color: 'var(--color-error)', fontSize: 12 }}>{dateError}</span>}
            </div>

            {/* Time Slot */}
            <div className="form-field-group">
              <label className="label">Time Slot</label>
              <div className="select-wrapper">
                <select
                  className="form-control"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select time slot</option>
                  {TIME_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <i className="pi pi-chevron-down select-arrow" />
              </div>
            </div>

            {/* Disease */}
            <div className="form-field-group">
              <label className="label">Disease</label>
              <div className="select-wrapper">
                <select
                  className="form-control"
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value ? Number(e.target.value) : '')}
                  style={{ width: '100%' }}
                >
                  <option value="">Select disease (optional)</option>
                  {diseaseOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <i className="pi pi-chevron-down select-arrow" />
              </div>
            </div>

            {/* Notes */}
            <div className="form-field-group">
              <label className="label">Notes</label>
              <textarea
                className="form-control"
                placeholder="Add notes for this follow-up..."
                rows={3}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', textAlign: 'right' }}>
                {notes.length}/500
              </span>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!scheduledDate || saving} onClick={submit}>
            <i className="pi pi-calendar-plus" /> {saving ? 'Scheduling...' : 'Schedule Follow-up'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Patient Dialog ─────────────────────────────────────────────────────
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EditPatientDialogProps {
  patient: Patient;
  onClose: () => void;
  onUpdated: (updated: Patient) => void;
}

function EditPatientDialog({ patient, onClose, onUpdated }: EditPatientDialogProps) {
  const [firstName, setFirstName] = useState(patient.first_name ?? '');
  const [lastName, setLastName] = useState(patient.last_name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState((patient.date_of_birth ?? '').slice(0, 10));
  const [gender, setGender] = useState(patient.gender ?? '');
  const [contactNumber, setContactNumber] = useState(patient.contact_number ?? '');
  const [email, setEmail] = useState(patient.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const maxDob = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const emailInvalid = email.trim() !== '' && !EMAIL_REGEX.test(email.trim());
  const invalid =
    !firstName.trim() || !lastName.trim() || !dateOfBirth || !gender || !contactNumber.trim() || emailInvalid;

  async function save() {
    if (invalid) {
      setError('Please fill in all required fields with valid values.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiClient.patch<Patient>(`/patients/${patient.id}`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth,
        gender,
        contact_number: contactNumber.trim(),
        email: email.trim() || null,
      });
      onUpdated(res.data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to update patient. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Edit Patient</h3>
          <button className="btn-icon" onClick={onClose}><i className="pi pi-times" /></button>
        </div>
        <div className="dialog-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field-group">
              <label className="label">First Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="text" className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="form-field-group">
              <label className="label">Last Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="text" className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="form-field-group">
              <label className="label">Date of Birth <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="date" className="form-control" value={dateOfBirth} max={maxDob} onChange={(e) => setDateOfBirth(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="form-field-group">
              <label className="label">Gender <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <select className="form-control" value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: '100%' }}>
                <option value="" disabled>Select gender</option>
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-field-group">
              <label className="label">Contact Number <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="tel" className="form-control" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="form-field-group">
              <label className="label">Email</label>
              <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
              {emailInvalid && <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Enter a valid email address</span>}
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 12, color: 'var(--color-error)', fontSize: 13 }}>{error}</div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={invalid || saving} onClick={save}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PDF Export (mirrors Angular ExportService.exportAssessmentPdf) ──────────
function safeStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function safeDateFormat(value: unknown): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function exportAssessmentPdf(assessmentId: number): Promise<void> {
  const raw = (await apiClient.get<Record<string, unknown>>(`/exports/assessments/${assessmentId}/pdf-data`)).data;

  const assessment = (raw['assessment'] ?? {}) as Record<string, unknown>;
  const patient = (raw['patient'] ?? {}) as Record<string, unknown>;
  const disease = (raw['disease'] ?? {}) as Record<string, unknown>;
  const prescRows = (raw['prescription_rows'] ?? []) as Record<string, unknown>[];

  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 14;

  const HEADER_HEIGHT = 32;
  const drawHeader = () => {
    const headerY = 6;
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('MEDRecords Portal', MARGIN, headerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text('Patient Assessment Report', MARGIN, headerY + 13);

    doc.setDrawColor(237, 28, 36);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, HEADER_HEIGHT, PAGE_W - MARGIN, HEADER_HEIGHT);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = PAGE_H - 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    const timestamp = new Date().toLocaleString('en-IN');
    doc.text(`Generated: ${timestamp}  |  MEDRecords Portal  |  Page ${pageNum} of ${totalPages}`, MARGIN, footerY);
    doc.text('DISCLAIMER: This document is confidential and intended solely for the named recipient.', MARGIN, footerY + 4);
  };

  drawHeader();
  let y = HEADER_HEIGHT + 8;

  // Patient Information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(237, 28, 36);
  doc.text('Patient Information', MARGIN, y);
  y += 5;

  const patientRows: [string, string][] = [
    ['Patient UID', safeStr(patient['patient_uid'])],
    ['Full Name', `${safeStr(patient['first_name'])} ${safeStr(patient['last_name'])}`.trim()],
    ['Date of Birth', safeDateFormat(patient['date_of_birth'])],
    ['Gender', safeStr(patient['gender'])],
    ['Contact', safeStr(patient['contact_number'])],
    ['Email', safeStr(patient['email'])],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: patientRows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [60, 60, 60] }, 1: { textColor: [60, 60, 60] } },
    margin: { left: MARGIN, right: MARGIN },
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // Assessment Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(237, 28, 36);
  doc.text('Assessment Details', MARGIN, y);
  y += 5;

  const visitDate = safeDateFormat(assessment['submitted_at'] ?? assessment['created_at']);
  const assessmentRows: [string, string][] = [
    ['Disease', safeStr(disease['name'])],
    ['Status', safeStr(assessment['status'])],
    ['Visit Date', visitDate],
    ['Consent', assessment['consent_given'] ? 'Yes' : 'No'],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: assessmentRows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [60, 60, 60] }, 1: { textColor: [60, 60, 60] } },
    margin: { left: MARGIN, right: MARGIN },
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // Clinical Assessment (dynamic form fields)
  const formData = (assessment['form_data'] ?? {}) as Record<string, unknown>;
  const templateSnapshot = (assessment['template_snapshot'] ?? {}) as Record<string, unknown>;

  const labelMap: Record<string, string> = {};
  const sections = (templateSnapshot['sections'] ?? []) as Array<Record<string, unknown>>;
  for (const section of sections) {
    const fields = (section['fields'] ?? []) as Array<Record<string, unknown>>;
    for (const field of fields) {
      const key = String(field['field_key'] ?? '');
      if (key) {
        labelMap[key] = String(field['label'] ?? key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      }
    }
  }

  if (formData && Object.keys(formData).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('Clinical Assessment', MARGIN, y);
    y += 5;

    const formRows: [string, string][] = [];
    for (const [key, value] of Object.entries(formData)) {
      const label = labelMap[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const val = Array.isArray(value) ? (value as unknown[]).join(', ') : safeStr(value);
      formRows.push([label, val]);
    }

    autoTable(doc, {
      startY: y,
      head: [],
      body: formRows,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65, textColor: [60, 60, 60] }, 1: { textColor: [40, 40, 40] } },
      alternateRowStyles: { fillColor: [252, 245, 245] },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => { drawHeader(); },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  }

  // Prescription Grid
  if (prescRows.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('Prescriptions', MARGIN, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions']],
      body: prescRows.map(p => [
        safeStr(p['medicine_name']),
        safeStr(p['dosage']),
        safeStr(p['frequency']),
        safeStr(p['duration']),
        safeStr(p['instructions']),
      ]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [237, 28, 36], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 248, 248] },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => { drawHeader(); },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const patientUid = safeStr(patient['patient_uid']) || String(assessmentId);
  const rawVisit = String(assessment['submitted_at'] ?? assessment['created_at'] ?? '');
  let visitDateFn = '';
  if (rawVisit) {
    const d = new Date(rawVisit);
    if (!isNaN(d.getTime())) visitDateFn = d.toISOString().slice(0, 10);
  }
  const fileName = `MEDRecords_Patient_${patientUid}_Visit_${visitDateFn || 'unknown'}.pdf`;
  doc.save(fileName);
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

export default PatientDetailPage;
