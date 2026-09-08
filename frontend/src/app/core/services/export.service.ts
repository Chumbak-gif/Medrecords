import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

export interface ExportFilters {
  month?: number;
  year?: number;
  doctor_id?: number;
  start_date?: string;
  end_date?: string;
}

export interface AuditFilters {
  start_date?: string;
  end_date?: string;
  actor_id?: number;
  event_type?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ExportService {
  private http = inject(HttpClient);

  /**
   * Export doctor's monthly assessment data as .xlsx
   * Fetches from GET /api/v1/exports/assessments/excel?month=&year=
   * File naming: MEDRecords_DoctorExport_YYYY-MM-DD.xlsx
   */
  async exportDoctorExcel(month: number, year: number): Promise<void> {
    const params = new HttpParams()
      .set('month', month)
      .set('year', year);

    const data = await firstValueFrom(
      this.http.get<Record<string, unknown>[]>(`${API}/api/v1/exports/assessments/excel`, { params })
    );

    if (!data || data.length === 0) {
      throw new Error('No data available for the selected month/year.');
    }

    // Flatten nested form_data fields into top-level columns for dynamic headers
    const flatRows = data.map(row => this.flattenRecord(row));

    const worksheet = XLSX.utils.json_to_sheet(flatRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assessments');

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `MEDRecords_DoctorExport_${today}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    // Log export event via audit endpoint (fire-and-forget, non-blocking)
    const monthStr = String(month).padStart(2, '0');
    this.logAuditEvent('export', 'assessment', undefined,
      `Doctor exported monthly assessments: ${year}-${monthStr}, rows: ${data.length}`
    );
  }

  /**
   * Export admin consolidated assessment data as .xlsx
   * Fetches from GET /api/v1/exports/assessments/excel with date range filters
   * File naming: MEDRecords_AdminExport_YYYY-MM-DD.xlsx
   */
  async exportAdminExcel(filters: ExportFilters): Promise<void> {
    let params = new HttpParams();
    // Backend uses from_date / to_date for admin range exports
    if (filters.start_date) params = params.set('from_date', filters.start_date);
    if (filters.end_date) params = params.set('to_date', filters.end_date);
    if (filters.doctor_id) params = params.set('doctor_id', filters.doctor_id);

    const data = await firstValueFrom(
      this.http.get<Record<string, unknown>[]>(`${API}/api/v1/exports/assessments/excel`, { params })
    );

    if (!data || data.length === 0) {
      throw new Error('No data available for the selected filters.');
    }

    // Flatten nested form_data fields into top-level columns for dynamic headers
    const flatRows = data.map(row => this.flattenRecord(row));

    const worksheet = XLSX.utils.json_to_sheet(flatRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assessments');

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `MEDRecords_AdminExport_${today}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    // Log export event via audit endpoint (fire-and-forget, non-blocking)
    const filterDesc = [
      filters.start_date ? `from ${filters.start_date}` : null,
      filters.end_date   ? `to ${filters.end_date}` : null,
      filters.doctor_id  ? `doctor_id=${filters.doctor_id}` : null,
    ].filter(Boolean).join(', ') || 'all data';
    this.logAuditEvent('export', 'assessment', undefined,
      `Admin exported consolidated assessments: ${filterDesc}, rows: ${data.length}`
    );
  }

  /**
   * Export individual assessment as PDF using jspdf + jspdf-autotable.
   * Fetches data payload from GET /api/v1/exports/assessments/{id}/pdf-data
   *
   * Response shape:
   *   { assessment: { id, status, form_data, template_snapshot, submitted_at, created_at, ... },
   *     patient: { patient_uid, first_name, last_name, date_of_birth, gender, contact_number, email },
   *     disease: { id, name },
   *     prescription_rows: [{ medicine_name, dosage, frequency, duration, instructions }] }
   */
  async exportAssessmentPdf(assessmentId: number): Promise<void> {
    // ── 1. Fetch data ────────────────────────────────────────────────────────
    const raw = await firstValueFrom(
      this.http.get<Record<string, unknown>>(`${API}/api/v1/exports/assessments/${assessmentId}/pdf-data`)
    );

    const assessment  = (raw['assessment']  ?? {}) as Record<string, unknown>;
    const patient     = (raw['patient']     ?? {}) as Record<string, unknown>;
    const disease     = (raw['disease']     ?? {}) as Record<string, unknown>;
    const prescRows   = (raw['prescription_rows'] ?? []) as Record<string, unknown>[];

    // ── 2. Lazy-load jspdf ───────────────────────────────────────────────────
    const { jsPDF } = await import('jspdf');
    const autoTable  = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PAGE_W  = doc.internal.pageSize.getWidth();
    const PAGE_H  = doc.internal.pageSize.getHeight();
    const MARGIN  = 14;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ── 3. Try to embed Emcure logo ──────────────────────────────────────────
    let logoBase64: string | null = null;
    try {
      const response = await fetch('/assets/logo.png');
      if (response.ok) {
        const blob   = await response.blob();
        logoBase64   = await this.blobToBase64(blob);
      }
    } catch {
      // Logo is optional — continue without it
    }

    // ── 4. Header builder (called once per page via didDrawPage hook) ────────
    const HEADER_HEIGHT = 32; // mm
    const drawHeader = () => {
      const headerY = 6;

      // Logo (top-left) — 22 × 10 mm if available
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', MARGIN, headerY, 22, 10);
        } catch {
          /* skip if image data is invalid */
        }
      }

      // Portal name (centered or right-of-logo)
      const titleX = logoBase64 ? MARGIN + 26 : MARGIN;
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(237, 28, 36);
      doc.text('MEDRecords Portal', titleX, headerY + 7);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      doc.text('Patient Assessment Report', titleX, headerY + 13);

      // Horizontal red divider
      doc.setDrawColor(237, 28, 36);
      doc.setLineWidth(0.6);
      doc.line(MARGIN, HEADER_HEIGHT, PAGE_W - MARGIN, HEADER_HEIGHT);
    };

    // Footer builder
    const drawFooter = (pageNum: number, totalPages: number) => {
      const footerY = PAGE_H - 10;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      const timestamp = new Date().toLocaleString('en-IN');
      doc.text(`Generated: ${timestamp}  |  MEDRecords Portal  |  Page ${pageNum} of ${totalPages}`, MARGIN, footerY);
      doc.text(
        'DISCLAIMER: This document is confidential and intended solely for the named recipient.',
        MARGIN, footerY + 4
      );
    };

    // ── 5. Draw page 1 header immediately ───────────────────────────────────
    drawHeader();
    let y = HEADER_HEIGHT + 8;

    // ── 6. Patient Information ───────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('Patient Information', MARGIN, y);
    y += 5;

    const patientRows: [string, string][] = [
      ['Patient UID',    this.safeStr(patient['patient_uid'])],
      ['Full Name',      `${this.safeStr(patient['first_name'])} ${this.safeStr(patient['last_name'])}`.trim()],
      ['Date of Birth',  this.safeDateFormat(patient['date_of_birth'])],
      ['Gender',         this.safeStr(patient['gender'])],
      ['Contact',        this.safeStr(patient['contact_number'])],
      ['Email',          this.safeStr(patient['email'])],
    ];

    autoTable(doc, {
      startY: y,
      head: [],
      body: patientRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [60, 60, 60] }, 1: { textColor: [60, 60, 60] } },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: (d: any) => { drawHeader(); },
    });
    y = (doc as any).lastAutoTable.finalY + 7;

    // ── 7. Assessment Details ────────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('Assessment Details', MARGIN, y);
    y += 5;

    const visitDate = this.safeDateFormat(assessment['submitted_at'] ?? assessment['created_at']);
    const assessmentRows: [string, string][] = [
      ['Disease',    this.safeStr(disease['name'])],
      ['Status',     this.safeStr(assessment['status'])],
      ['Visit Date', visitDate],
      ['Consent',    assessment['consent_given'] ? 'Yes' : 'No'],
    ];

    autoTable(doc, {
      startY: y,
      head: [],
      body: assessmentRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [60, 60, 60] }, 1: { textColor: [60, 60, 60] } },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: (d: any) => { drawHeader(); },
    });
    y = (doc as any).lastAutoTable.finalY + 7;

    // ── 8. Clinical Assessment (dynamic form fields) ─────────────────────────
    const formData = (assessment['form_data'] ?? {}) as Record<string, unknown>;
    const templateSnapshot = (assessment['template_snapshot'] ?? {}) as Record<string, unknown>;

    // Build a label map from template_snapshot sections/fields
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
        const val   = Array.isArray(value)
          ? (value as unknown[]).join(', ')
          : this.safeStr(value);
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
        didDrawPage: (d: any) => { drawHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 7;
    }

    // ── 9. Prescription Grid ─────────────────────────────────────────────────
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
          this.safeStr(p['medicine_name']),
          this.safeStr(p['dosage']),
          this.safeStr(p['frequency']),
          this.safeStr(p['duration']),
          this.safeStr(p['instructions']),
        ]),
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [237, 28, 36], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: (d: any) => { drawHeader(); },
      });
    }

    // ── 10. Stamp footer on every page ───────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }

    // ── 11. Save with standardised file name ─────────────────────────────────
    const patientUid  = this.safeStr(patient['patient_uid']) || String(assessmentId);
    const visitDateFn = this.formatDate(String(assessment['submitted_at'] ?? assessment['created_at'] ?? ''));
    const fileName    = `MEDRecords_Patient_${patientUid}_Visit_${visitDateFn || 'unknown'}.pdf`;
    doc.save(fileName);

    // Fire-and-forget audit entry
    this.logAuditEvent('export', 'assessment', assessmentId,
      `PDF export for assessment ${assessmentId} — patient ${patientUid}`
    );
  }

  /**
   * Export audit log as .xlsx
   */
  async exportAuditLog(filters: AuditFilters): Promise<void> {
    let params = new HttpParams();
    if (filters.start_date) params = params.set('from_date', filters.start_date);
    if (filters.end_date) params = params.set('to_date', filters.end_date);
    if (filters.actor_id) params = params.set('actor_id', filters.actor_id);
    if (filters.event_type) params = params.set('event_type', filters.event_type);

    const data = await firstValueFrom(
      this.http.get<Record<string, unknown>[]>(`${API}/api/v1/exports/audit/excel`, { params })
    );

    const worksheet = XLSX.utils.json_to_sheet(data ?? []);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Log');

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `MEDRecords_AuditLog_${today}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Flatten a record that may contain nested form_data into a single flat object.
   * form_data keys are prefixed with "form_" to avoid collisions.
   * All other nested objects are JSON-stringified.
   */
  private flattenRecord(record: Record<string, unknown>): Record<string, unknown> {
    const flat: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (key === 'form_data' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Expand form_data fields as individual columns with "form_" prefix
        const formObj = value as Record<string, unknown>;
        for (const [fKey, fVal] of Object.entries(formObj)) {
          const colName = `form_${fKey}`;
          flat[colName] = Array.isArray(fVal) ? fVal.join(', ') : (fVal ?? '');
        }
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Stringify other nested objects
        flat[key] = JSON.stringify(value);
      } else if (Array.isArray(value)) {
        flat[key] = value.join(', ');
      } else {
        flat[key] = value;
      }
    }

    return flat;
  }

  /**
   * Fire-and-forget audit log event via POST /api/v1/audit/
   * Errors are silently swallowed to avoid disrupting the export flow.
   */
  private logAuditEvent(
    eventType: string,
    entityType?: string,
    entityId?: number,
    description?: string,
  ): void {
    const body: Record<string, unknown> = { event_type: eventType };
    if (entityType) body['entity_type'] = entityType;
    if (entityId != null) body['entity_id'] = entityId;
    if (description) body['description'] = description;

    this.http.post(`${API}/api/v1/audit/`, body).subscribe({
      error: (err) => {
        // Non-critical: log to console only, never surface to user
        console.warn('[ExportService] Audit log failed:', err?.message ?? err);
      },
    });
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().slice(0, 10);
    } catch {
      return dateStr;
    }
  }

  /**
   * Null-safe string coercion — returns empty string for null/undefined.
   */
  private safeStr(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  /**
   * Null-safe date formatter matching SafeDatePipe logic.
   * Returns '—' for null/undefined/invalid, otherwise 'dd MMM yyyy' in en-IN locale.
   */
  private safeDateFormat(value: unknown): string {
    if (!value) return '—';
    try {
      const d = value instanceof Date ? value : new Date(String(value));
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  /**
   * Convert a Blob to a base64 data URL string for use with jsPDF addImage.
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = reject;
      reader.readAsDataURL(blob);
    });
  }
}
