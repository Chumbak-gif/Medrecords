import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

// ── Models ────────────────────────────────────────────────────────────────────

export interface Patient {
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

export interface AssessmentSummary {
  id: number;
  visit_date: string;
  disease_name: string;
  sub_disease_name: string | null;
  status: 'draft' | 'submitted' | 'locked';
}

export interface PatientDetail {
  patient: Patient;
  assessments: AssessmentSummary[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PatientPageParams {
  page: number;
  page_size: number;
  search?: string;
}

export interface RegisterPatientDto {
  first_name: string;
  last_name: string;
  date_of_birth: string;  // ISO date string YYYY-MM-DD
  gender: string;
  contact_number: string;
  email?: string | null;
}

export interface UpdatePatientDto {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  contact_number?: string;
  email?: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PatientService {
  private http = inject(HttpClient);

  getPatients(params: PatientPageParams): Observable<PaginatedResponse<Patient>> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('page_size', params.page_size);
    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    return this.http.get<PaginatedResponse<Patient>>(`${API}/api/v1/patients/`, { params: httpParams });
  }

  getPatient(id: number): Observable<PatientDetail> {
    return this.http.get<PatientDetail>(`${API}/api/v1/patients/${id}`);
  }

  registerPatient(payload: RegisterPatientDto): Observable<Patient> {
    return this.http.post<Patient>(`${API}/api/v1/patients/`, payload);
  }

  updatePatient(id: number, payload: UpdatePatientDto): Observable<Patient> {
    return this.http.patch<Patient>(`${API}/api/v1/patients/${id}`, payload);
  }

  deletePatient(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/api/v1/patients/${id}`);
  }

  /** Lightweight contact-number duplicate check */
  searchByContact(contact: string): Observable<PaginatedResponse<Patient>> {
    const params = new HttpParams().set('search', contact).set('page', 1).set('page_size', 5);
    return this.http.get<PaginatedResponse<Patient>>(`${API}/api/v1/patients/`, { params });
  }
}
