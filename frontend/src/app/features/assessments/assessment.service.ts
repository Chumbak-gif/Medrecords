import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FormSchema } from '../templates/template.service';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

// ─── Models ──────────────────────────────────────────────────────────────────

export interface AssessmentPatient {
  first_name: string;
  last_name: string;
  patient_uid: string;
  date_of_birth: string;
  gender: string;
  contact_number: string;
  email: string | null;
}

export interface PrescriptionRow {
  medicine_id: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Assessment {
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

export interface AssessmentDetail extends Assessment {
  template_snapshot: FormSchema;
  form_data: Record<string, unknown>;
  prescriptions: PrescriptionRow[];
  patient: AssessmentPatient;
}

export interface CreateAssessmentDto {
  patient_id: number;
  doctor_id: number;
  disease_id: number;
  sub_disease_id?: number | null;
  template_id: number;
  form_data: Record<string, unknown>;
  consent_given: boolean;
}

export interface UpdateAssessmentDto {
  disease_id?: number;
  sub_disease_id?: number | null;
  template_id?: number;
  form_data?: Record<string, unknown>;
  consent_given?: boolean;
}

export interface UpsertPrescriptionsDto {
  rows: PrescriptionRow[];
}

export interface AssessmentQueryParams {
  page?: number;
  page_size?: number;
  patient_id?: number;
  status?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DoctorKpis {
  total_patients: number;
  this_month_submitted: number;
  drafts: number;
  locked: number;
  today_visits: number;
  pending_followups: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AssessmentService {
  private http = inject(HttpClient);

  // Signals for shared reactive state
  activeAssessment = signal<AssessmentDetail | null>(null);
  assessmentStatus = computed(() => this.activeAssessment()?.status ?? null);

  // ─── Assessment CRUD ──────────────────────────────────────────────────────

  getAssessments(params: AssessmentQueryParams = {}): Observable<PaginatedResponse<Assessment>> {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 1)
      .set('page_size', params.page_size ?? 20);
    if (params.patient_id) {
      httpParams = httpParams.set('patient_id', params.patient_id);
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    return this.http.get<PaginatedResponse<Assessment>>(`${API}/api/v1/assessments/`, { params: httpParams });
  }

  getAssessment(id: number): Observable<AssessmentDetail> {
    return this.http.get<AssessmentDetail>(`${API}/api/v1/assessments/${id}`);
  }

  createDraft(payload: CreateAssessmentDto): Observable<Assessment> {
    return this.http.post<Assessment>(`${API}/api/v1/assessments/`, payload);
  }

  saveDraft(id: number, payload: UpdateAssessmentDto): Observable<Assessment> {
    return this.http.put<Assessment>(`${API}/api/v1/assessments/${id}`, payload);
  }

  submitAssessment(id: number): Observable<Assessment> {
    return this.http.post<Assessment>(`${API}/api/v1/assessments/${id}/submit`, {});
  }

  getDashboardKpis(): Observable<DoctorKpis> {
    return this.http.get<DoctorKpis>(`${API}/api/v1/assessments/dashboard/kpis`);
  }

  // ─── Prescription CRUD ────────────────────────────────────────────────────

  getPrescriptions(assessmentId: number): Observable<PrescriptionRow[]> {
    return this.http.get<PrescriptionRow[]>(`${API}/api/v1/prescriptions/assessment/${assessmentId}`);
  }

  upsertPrescriptions(assessmentId: number, rows: PrescriptionRow[]): Observable<PrescriptionRow[]> {
    return this.http.post<PrescriptionRow[]>(
      `${API}/api/v1/prescriptions/assessment/${assessmentId}`,
      rows
    );
  }
}
