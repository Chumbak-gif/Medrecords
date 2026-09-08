import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

// ─── Models ──────────────────────────────────────────────────────────────────

export interface FormField {
  field_key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'radio' | 'checkbox_group' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minDate?: string;
    maxDate?: string;
  };
  order: number;
}

export interface FormSection {
  section_key: string;
  label: string;
  order: number;
  fields: FormField[];
}

export interface FormSchema {
  version: number;
  disease_id: number;
  sections: FormSection[];
}

export interface FormTemplate {
  id: number;
  disease_id: number;
  disease_name?: string;
  version: number;
  is_active: boolean;
  schema: FormSchema;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateTemplateDto {
  disease_id: number;
  schema: FormSchema;
}

export interface UpdateTemplateDto {
  schema: FormSchema;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private http = inject(HttpClient);

  getTemplates(params: { page?: number; page_size?: number; disease_id?: number | null }): Observable<PaginatedResponse<FormTemplate>> {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 1)
      .set('page_size', params.page_size ?? 20);
    if (params.disease_id) {
      httpParams = httpParams.set('disease_id', params.disease_id);
    }
    return this.http.get<PaginatedResponse<FormTemplate>>(`${API}/api/v1/templates/`, { params: httpParams });
  }

  getTemplate(id: number): Observable<FormTemplate> {
    return this.http.get<FormTemplate>(`${API}/api/v1/templates/${id}`);
  }

  getActiveTemplateForDisease(diseaseId: number): Observable<FormTemplate> {
    return this.http.get<FormTemplate>(`${API}/api/v1/templates/disease/${diseaseId}/active`);
  }

  createTemplate(payload: CreateTemplateDto): Observable<FormTemplate> {
    return this.http.post<FormTemplate>(`${API}/api/v1/templates/`, payload);
  }

  updateTemplate(id: number, payload: UpdateTemplateDto): Observable<FormTemplate> {
    return this.http.put<FormTemplate>(`${API}/api/v1/templates/${id}`, payload);
  }

  softDeleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/api/v1/templates/${id}`);
  }
}
