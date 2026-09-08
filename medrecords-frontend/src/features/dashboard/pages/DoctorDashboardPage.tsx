/**
 * Doctor Dashboard page.
 * Replicates the Angular DoctorDashboardComponent 1:1 (KPI cards, today's
 * follow-ups, recent assessments table with PDF export, and the monthly
 * Excel export dialog).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTypedApiClient } from '@/shared/services/api/apiClient';
import { useAppSelector } from '@/app/store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DoctorKpis {
  total_patients: number;
  this_month_submitted: number;
  drafts: number;
  locked: number;
  today_visits: number;
  pending_followups: number;
}

interface Assessment {
  id: number;
  patient_id: number;
  doctor_id: number;
  disease_id: number;
  sub_disease_id: number | null;
  template_id: number;
  status: 'draft' | 'submitted' | 'locked';
  consent_given: boolean;
  submitted_at: string | null;
  lock_expires_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  disease_name?: string;
  sub_disease_name?: string | null;
}

interface AssessmentRow extends Assessment {
  patient_name?: string;
  patient_uid?: string;
  visit_date?: string | null;
}

interface AssessmentPatientLike {
  first_name?: string;
  last_name?: string;
  patient_uid?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
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
  patient_name?: string;
  patient_uid?: string;
  disease_name?: string;
}

interface FollowupDashboard {
  pending_count: number;
  today_followups: Followup[];
}

interface MonthOption {
  label: string;
  value: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_OPTIONS: MonthOption[] = [
  { label: 'January', value: 1 },
  { label: 'February', value: 2 },
  { label: 'March', value: 3 },
  { label: 'April', value: 4 },
  { label: 'May', value: 5 },
  { label: 'June', value: 6 },
  { label: 'July', value: 7 },
  { label: 'August', value: 8 },
  { label: 'September', value: 9 },
  { label: 'October', value: 10 },
  { label: 'November', value: 11 },
  { label: 'December', value: 12 },
];

function buildYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 4; y--) years.push(y);
  return years;
}

const apiClient = createTypedApiClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format an ISO date as 'dd MMM yyyy' (matches Angular DatePipe usage). */
function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

function isoDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

/** Fire-and-forget audit log — errors are swallowed to avoid disrupting flow. */
function logAuditEvent(eventType: string, entityType?: string, entityId?: number, description?: string): void {
  const body: Record<string, unknown> = { event_type: eventType };
  if (entityType) body.entity_type = entityType;
  if (entityId != null) body.entity_id = entityId;
  if (description) body.description = description;
  apiClient.post('/audit/', body).catch(() => { /* non-critical */ });
}

/** Flatten a record whose form_data should be expanded into prefixed columns. */
function flattenRecord(record: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'form_data' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [fKey, fVal] of Object.entries(value as Record<string, unknown>)) {
        flat[`form_${fKey}`] = Array.isArray(fVal) ? fVal.join(', ') : (fVal ?? '');
      }
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flat[key] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      flat[key] = value.join(', ');
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

// ─── Export logic (client-side, matches Angular ExportService) ────────────────

async function exportDoctorExcel(month: number, year: number): Promise<void> {
  const res = await apiClient.get<Record<string, unknown>[]>('/exports/assessments/excel', {
    params: { month, year },
  });
  const data = res.data;
  if (!data || data.length === 0) {
    throw new Error('No data available for the selected month/year.');
  }

  const XLSX = await import('xlsx');
  const flatRows = data.map(flattenRecord);
  const worksheet = XLSX.utils.json_to_sheet(flatRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assessments');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `MEDRecords_DoctorExport_${today}.xlsx`);

  const monthStr = String(month).padStart(2, '0');
  logAuditEvent('export', 'assessment', undefined,
    `Doctor exported monthly assessments: ${year}-${monthStr}, rows: ${data.length}`);
}

async function exportAssessmentPdf(assessmentId: number): Promise<void> {
  const res = await apiClient.get<Record<string, unknown>>(`/exports/assessments/${assessmentId}/pdf-data`);
  const raw = res.data;

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
    const titleX = MARGIN;
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('MEDRecords Portal', titleX, headerY + 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text('Patient Assessment Report', titleX, headerY + 13);
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

  const assessmentRows: [string, string][] = [
    ['Disease', safeStr(disease['name'])],
    ['Status', safeStr(assessment['status'])],
    ['Visit Date', safeDateFormat(assessment['submitted_at'] ?? assessment['created_at'])],
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
        labelMap[key] = String(field['label'] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
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
      const label = labelMap[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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

  // Prescription grid
  if (prescRows.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('Prescriptions', MARGIN, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions']],
      body: prescRows.map((p) => [
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
  const visitDateFn = isoDay(String(assessment['submitted_at'] ?? assessment['created_at'] ?? ''));
  doc.save(`MEDRecords_Patient_${patientUid}_Visit_${visitDateFn || 'unknown'}.pdf`);

  logAuditEvent('export', 'assessment', assessmentId,
    `PDF export for assessment ${assessmentId} — patient ${patientUid}`);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DoctorDashboardPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  // KPI state
  const [kpis, setKpis] = useState<DoctorKpis | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  // Assessments table state
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [exportingPdfId, setExportingPdfId] = useState<number | null>(null);

  // Follow-up dashboard state
  const [followupDashboard, setFollowupDashboard] = useState<FollowupDashboard | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  // Export dialog state
  const now = useMemo(() => new Date(), []);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number | null>(now.getFullYear());
  const [exporting, setExporting] = useState(false);

  const yearOptions = useMemo(() => buildYearOptions(), []);

  const doctorName = user?.fullName ?? user?.username ?? 'Doctor';
  const todayFollowups = followupDashboard?.today_followups ?? [];

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Data loading ──
  const loadKpis = useCallback(async () => {
    setKpiLoading(true);
    try {
      const res = await apiClient.get<DoctorKpis>('/assessments/dashboard/kpis');
      setKpis(res.data);
    } catch {
      showToast('warn', 'Could not load dashboard KPIs. Please refresh.');
    }
    setKpiLoading(false);
  }, []);

  const loadAssessments = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<Assessment>>('/assessments/', {
        params: { page: 1, page_size: 20 },
      });
      const rows: AssessmentRow[] = (res.data.items ?? []).map((a) => {
        const withPatient = a as Assessment & { patient?: AssessmentPatientLike; patient_name?: string; patient_uid?: string };
        return {
          ...a,
          patient_name: withPatient.patient
            ? `${withPatient.patient.first_name ?? ''} ${withPatient.patient.last_name ?? ''}`.trim()
            : withPatient.patient_name ?? undefined,
          patient_uid: withPatient.patient?.patient_uid ?? withPatient.patient_uid ?? undefined,
          visit_date: a.submitted_at ?? a.updated_at ?? a.created_at,
        };
      });
      setAssessments(rows);
    } catch {
      showToast('error', 'Failed to load recent assessments.');
    }
    setTableLoading(false);
  }, []);

  const loadFollowupDashboard = useCallback(async () => {
    try {
      const res = await apiClient.get<FollowupDashboard>('/followups/dashboard');
      setFollowupDashboard(res.data);
    } catch {
      showToast('warn', 'Could not load follow-up dashboard data.');
    }
  }, []);

  useEffect(() => {
    loadKpis();
    loadAssessments();
    loadFollowupDashboard();
  }, [loadKpis, loadAssessments, loadFollowupDashboard]);

  // ── Helpers ──
  function isOverdue(followup: Followup): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = new Date(followup.scheduled_date);
    scheduled.setHours(0, 0, 0, 0);
    return scheduled < today;
  }

  function goToNewVisit() {
    navigate('/doctor/assessments/new');
  }

  function openAssessment(row: AssessmentRow) {
    navigate(`/doctor/assessments/${row.id}`);
  }

  // ── PDF export ──
  async function exportPdf(row: AssessmentRow) {
    if (exportingPdfId !== null) return;
    setExportingPdfId(row.id);
    try {
      await exportAssessmentPdf(row.id);
      showToast('success', 'Assessment PDF downloaded successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not export assessment PDF.';
      showToast('error', message);
    } finally {
      setExportingPdfId(null);
    }
  }

  // ── Excel export ──
  function openExportDialog() {
    setExportDialogVisible(true);
  }

  function getMonthLabel(month: number): string {
    return MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month);
  }

  async function runExport() {
    if (!selectedMonth || !selectedYear || exporting) return;
    setExporting(true);
    try {
      await exportDoctorExcel(selectedMonth, selectedYear);
      showToast('success', `Monthly Excel exported for ${getMonthLabel(selectedMonth)} ${selectedYear}.`);
      setExportDialogVisible(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not export Excel file.';
      showToast('error', message);
    } finally {
      setExporting(false);
    }
  }

  // ── Render ──
  return (
    <div className="analytics-page">
      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Doctor Dashboard</h2>
          <p className="page-subtitle">
            Welcome back, <strong>{doctorName}</strong> — here's your activity summary.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={openExportDialog}>
            <i className="pi pi-file-excel" /> Export Monthly Excel
          </button>
          <button className="btn-primary" onClick={goToNewVisit}>
            <i className="pi pi-plus" /> New Visit
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpiLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi-card">
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--color-neutral-100)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '1.5rem', width: '60%', background: 'var(--color-neutral-100)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: '0.75rem', width: '40%', background: 'var(--color-neutral-100)', borderRadius: 4 }} />
              </div>
            </div>
          ))
        ) : (
          <>
            <KpiCard title="Total Patients" value={kpis?.total_patients ?? 0} icon="pi-users" color="#ed1c24" />
            <KpiCard title="This Month Assessments" value={kpis?.this_month_submitted ?? 0} icon="pi-calendar-plus" color="#3b82f6" />
            <KpiCard title="Drafts" value={kpis?.drafts ?? 0} icon="pi-file-edit" color="#f59e0b" />
            <KpiCard title="Locked" value={kpis?.locked ?? 0} icon="pi-lock" color="#10b981" />
          </>
        )}
      </div>

      {/* Today's Follow-ups */}
      <div className="card">
        <div className="table-header">
          <div>
            <h3 className="table-title">Today's Follow-ups</h3>
            <p className="table-subtitle">Patients scheduled for follow-up today</p>
          </div>
        </div>

        {todayFollowups.length === 0 ? (
          <div className="empty-state">
            <i className="pi pi-calendar" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
            No follow-ups scheduled for today.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayFollowups.map((fu) => {
              const overdue = isOverdue(fu);
              return (
                <div
                  key={fu.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: `1px solid ${overdue ? '#fca5a5' : 'var(--color-neutral-200)'}`,
                    background: overdue ? '#fef2f2' : 'var(--color-neutral-50)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-neutral-900)' }}>{fu.patient_name || '—'}</span>
                    {fu.patient_uid && (
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-neutral-100)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                        {fu.patient_uid}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
                    <span style={{ color: 'var(--color-neutral-700)', fontWeight: 500 }}>{fu.disease_name || '—'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-neutral-500)' }}>
                      <i className="pi pi-calendar" />
                      {formatDate(fu.scheduled_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Assessments Table */}
      <div className="card">
        <div className="table-header">
          <div>
            <h3 className="table-title">Recent Assessments</h3>
            <p className="table-subtitle">Your 20 most recent records, sorted by last modified</p>
          </div>
          <button className="btn-ghost btn-sm" onClick={loadAssessments} disabled={tableLoading}>
            <i className={`pi pi-refresh ${tableLoading ? 'spin' : ''}`} /> Refresh
          </button>
        </div>

        {tableLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '1.5rem' }} />
            <p style={{ marginTop: 8, fontSize: 13 }}>Loading…</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, minWidth: 160 }}>Patient Name</th>
                  <th style={{ ...thStyle, minWidth: 130 }}>Patient ID</th>
                  <th style={{ ...thStyle, minWidth: 120 }}>Visit Date</th>
                  <th style={{ ...thStyle, minWidth: 150 }}>Disease</th>
                  <th style={{ ...thStyle, minWidth: 150 }}>Sub-Disease</th>
                  <th style={{ ...thStyle, width: 110 }}>Status</th>
                  <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {assessments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      <i className="pi pi-clipboard" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                      No recent assessments found.
                      <br />
                      <button className="btn-primary btn-sm" style={{ marginTop: 12 }} onClick={goToNewVisit}>
                        <i className="pi pi-plus" /> Start a New Visit
                      </button>
                    </td>
                  </tr>
                ) : (
                  assessments.map((row) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid var(--color-neutral-100)', cursor: 'pointer' }}
                      onClick={() => openAssessment(row)}
                    >
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: 'var(--color-neutral-900)' }}>{row.patient_name || '—'}</span>
                      </td>
                      <td style={tdStyle}>
                        {row.patient_uid ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-neutral-100)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            {row.patient_uid}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-neutral-500)' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--color-neutral-500)' }}>{formatDate(row.submitted_at ?? row.updated_at)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span>{row.disease_name || '—'}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--color-neutral-500)' }}>{row.sub_disease_name || '—'}</span>
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          className="btn-icon btn-icon-danger"
                          title="Export PDF"
                          disabled={exportingPdfId === row.id}
                          onClick={(e) => { e.stopPropagation(); exportPdf(row); }}
                        >
                          <i className={`pi ${exportingPdfId === row.id ? 'pi-spin pi-spinner' : 'pi-file-pdf'}`} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Monthly Excel Dialog */}
      {exportDialogVisible && (
        <div className="dialog-overlay" onClick={() => setExportDialogVisible(false)}>
          <div className="dialog" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Export Monthly Excel</h3>
              <button className="btn-icon" onClick={() => setExportDialogVisible(false)}><i className="pi pi-times" /></button>
            </div>
            <div className="dialog-body">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-neutral-600)' }}>
                Select the month and year to export your patient assessment records.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-field-group">
                  <label className="label">Month <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <select
                    className="form-control"
                    style={{ width: '100%' }}
                    value={selectedMonth ?? ''}
                    onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select month</option>
                    {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="form-field-group">
                  <label className="label">Year <span style={{ color: 'var(--color-error)' }}>*</span></label>
                  <select
                    className="form-control"
                    style={{ width: '100%' }}
                    value={selectedYear ?? ''}
                    onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select year</option>
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setExportDialogVisible(false)}>Cancel</button>
              <button className="btn-primary" disabled={!selectedMonth || !selectedYear || exporting} onClick={runExport}>
                <i className={`pi ${exporting ? 'pi-spin pi-spinner' : 'pi-download'}`} />
                {exporting ? ' Exporting…' : ' Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status badge (matches Angular StatusBadgeComponent) ──────────────────────

function StatusBadge({ status }: { status: string }) {
  const key = (status || '').toLowerCase();
  const colorMap: Record<string, { bg: string; text: string }> = {
    active: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    approved: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    completed: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    success: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    pending: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
    warning: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
    overdue: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
    rejected: { bg: 'var(--color-error-bg)', text: 'var(--color-error-text)' },
    error: { bg: 'var(--color-error-bg)', text: 'var(--color-error-text)' },
    cancelled: { bg: 'var(--color-error-bg)', text: 'var(--color-error-text)' },
    expired: { bg: 'var(--color-error-bg)', text: 'var(--color-error-text)' },
    draft: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' },
    submitted: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' },
    info: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' },
    locked: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' },
    inactive: { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' },
    default: { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' },
  };
  const config = colorMap[key] ?? colorMap.default;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: config.bg,
        color: config.text,
      }}
    >
      {label}
    </span>
  );
}

// ─── KPI Card (matches DashboardPage / Angular app-kpi-card) ──────────────────

function KpiCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: `${color}18`, color }}>
        <i className={`pi ${icon}`} aria-hidden="true" />
      </div>
      <div className="kpi-content">
        <span className="kpi-value">{value}</span>
        <span className="kpi-label">{title}</span>
      </div>
      <style>{`
        .kpi-icon {
          width: 56px; height: 56px; border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: var(--text-xl);
        }
        .kpi-content { display: flex; flex-direction: column; }
        .kpi-value { font-size: var(--text-xl); font-weight: var(--font-bold); color: var(--color-neutral-900); }
        .kpi-label { font-size: var(--text-sm); color: var(--color-neutral-600); }
      `}</style>
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

export default DoctorDashboardPage;
