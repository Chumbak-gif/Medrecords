import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_BASE = `${environment.apiBaseUrl}/api/v1/followups`;

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Followup {
  id: number;
  patient_id: number;
  doctor_id: number;
  assessment_id: number | null;
  scheduled_date: string; // ISO date (yyyy-MM-dd)
  notes: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  patient_name?: string;
  patient_uid?: string;
  disease_name?: string;
}

export interface FollowupCreatePayload {
  patient_id: number;
  assessment_id?: number;
  scheduled_date: string; // yyyy-MM-dd
  notes?: string;
}

export interface FollowupUpdatePayload {
  status?: 'pending' | 'completed' | 'cancelled';
  scheduled_date?: string;
  notes?: string;
}

export interface FollowupListParams {
  page?: number;
  page_size?: number;
  status?: 'pending' | 'completed' | 'cancelled';
  patient_id?: number;
}

export interface FollowupCalendarParams {
  start_date: string;  // yyyy-MM-dd
  end_date: string;    // yyyy-MM-dd
}

export interface FollowupDashboard {
  pending_count: number;
  today_followups: Followup[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FollowupService {
  private http = inject(HttpClient);

  create(payload: FollowupCreatePayload): Observable<Followup> {
    return this.http.post<Followup>(API_BASE, payload);
  }

  list(params: FollowupListParams): Observable<PaginatedResponse<Followup>> {
    let httpParams = new HttpParams();
    if (params.page != null) {
      httpParams = httpParams.set('page', params.page);
    }
    if (params.page_size != null) {
      httpParams = httpParams.set('page_size', params.page_size);
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.patient_id != null) {
      httpParams = httpParams.set('patient_id', params.patient_id);
    }
    return this.http.get<PaginatedResponse<Followup>>(API_BASE, { params: httpParams });
  }

  getById(id: number): Observable<Followup> {
    return this.http.get<Followup>(`${API_BASE}/${id}`);
  }

  update(id: number, payload: FollowupUpdatePayload): Observable<Followup> {
    return this.http.patch<Followup>(`${API_BASE}/${id}`, payload);
  }

  getDashboard(): Observable<FollowupDashboard> {
    return this.http.get<FollowupDashboard>(`${API_BASE}/dashboard`);
  }

  getCalendar(params: FollowupCalendarParams): Observable<Followup[]> {
    const httpParams = new HttpParams()
      .set('start_date', params.start_date)
      .set('end_date', params.end_date);
    return this.http.get<Followup[]>(`${API_BASE}/calendar`, { params: httpParams });
  }
}
