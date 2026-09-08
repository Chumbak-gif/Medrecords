import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

export interface Doctor {
  id: number;
  full_name: string;
  username: string;
  email: string;
  specialty: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DoctorPageParams {
  page: number;
  page_size: number;
  search?: string;
}

export interface CreateDoctorDto {
  full_name: string;
  username: string;
  email: string;
  specialty?: string | null;
  password: string;
  role: 'doctor';
}

export interface UpdateDoctorDto {
  full_name?: string;
  email?: string;
  specialty?: string | null;
}

export interface ResetPasswordDto {
  password: string;
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private http = inject(HttpClient);

  getDoctors(params: DoctorPageParams): Observable<PaginatedResponse<Doctor>> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('page_size', params.page_size)
      .set('role', 'doctor');
    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    return this.http.get<PaginatedResponse<Doctor>>(`${API}/api/v1/users/`, { params: httpParams });
  }

  getDoctor(id: number): Observable<Doctor> {
    return this.http.get<Doctor>(`${API}/api/v1/users/${id}`);
  }

  createDoctor(payload: CreateDoctorDto): Observable<Doctor> {
    return this.http.post<Doctor>(`${API}/api/v1/users/`, payload);
  }

  updateDoctor(id: number, payload: UpdateDoctorDto): Observable<Doctor> {
    return this.http.patch<Doctor>(`${API}/api/v1/users/${id}`, payload);
  }

  softDeleteDoctor(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/api/v1/users/${id}`);
  }

  resetPassword(id: number, payload: ResetPasswordDto): Observable<void> {
    return this.http.post<void>(`${API}/api/v1/users/${id}/reset-password`, payload);
  }
}
