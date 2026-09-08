import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { BadgeModule } from 'primeng/badge';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

interface Disease {
  id: number;
  name: string;
  is_active: boolean;
}

interface FormTemplate {
  id: number;
  disease_id: number;
  disease_name?: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

@Component({
  selector: 'app-templates-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DropdownModule,
    BadgeModule,
    ConfirmDialogModule,
    ToastModule,
    PaginatorModule,
    TooltipModule,
    StatusBadgeComponent,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">Form Templates</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Manage disease-specific form schemas
        </p>
      </div>
      <button class="btn-primary" (click)="goNew()">
        <i class="pi pi-plus"></i> New Template
      </button>
    </div>

    <div class="card">
      <!-- Filters bar -->
      <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <p-dropdown
          [options]="diseases()"
          optionLabel="name"
          optionValue="id"
          placeholder="All diseases"
          [(ngModel)]="selectedDiseaseId"
          (ngModelChange)="onDiseaseFilter()"
          [showClear]="true"
          [style]="{'min-width':'220px'}"
        />
        <span style="font-size:13px;color:var(--color-neutral-500)">{{ totalRecords }} record(s)</span>
      </div>

      <!-- Table -->
      <p-table
        [value]="templates()"
        [loading]="loading()"
        dataKey="id"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>Disease</th>
            <th style="width:110px;text-align:center">Version</th>
            <th style="width:120px">Status</th>
            <th style="width:170px">Created At</th>
            <th style="width:130px">Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-tmpl>
          <tr>
            <td>
              <span style="font-weight:600">{{ tmpl.disease_name ?? '—' }}</span>
            </td>
            <td style="text-align:center">
              <p-badge
                [value]="'v' + tmpl.version"
                [severity]="tmpl.is_active ? 'success' : 'secondary'"
                styleClass="text-xs"
              />
            </td>
            <td>
              <app-status-badge [status]="tmpl.is_active ? 'active' : 'inactive'" />
            </td>
            <td>
              <span style="color:var(--color-neutral-600);font-size:12px">
                {{ tmpl.created_at | date:'dd MMM yyyy, HH:mm' }}
              </span>
            </td>
            <td>
              <div style="display:flex;gap:6px">
                <button
                  type="button"
                  pButton
                  icon="pi pi-pencil"
                  class="p-button-text p-button-sm p-button-secondary"
                  pTooltip="Edit schema"
                  tooltipPosition="top"
                  (click)="goEdit(tmpl.id)"
                ></button>
                <button
                  type="button"
                  pButton
                  icon="pi pi-trash"
                  class="p-button-text p-button-sm p-button-danger"
                  pTooltip="Delete"
                  tooltipPosition="top"
                  (click)="confirmDelete(tmpl)"
                ></button>
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" style="text-align:center;padding:40px;color:var(--color-neutral-400)">
              @if (loading()) {
                Loading...
              } @else {
                No templates found. <button class="btn-link" (click)="goNew()">Create one?</button>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>

      <!-- Paginator -->
      <p-paginator
        [rows]="pageSize"
        [totalRecords]="totalRecords"
        [first]="(currentPage - 1) * pageSize"
        (onPageChange)="onPageChange($event)"
        [rowsPerPageOptions]="[10, 20, 50]"
        styleClass="mt-3"
      />
    </div>
  `,
  styles: [`
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; }
    .btn-link {
      background: none;
      border: none;
      color: var(--color-primary);
      cursor: pointer;
      font-size: inherit;
      padding: 0;
      text-decoration: underline;
    }
  `]
})
export class TemplatesListComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private destroy$ = new Subject<void>();

  templates = signal<FormTemplate[]>([]);
  diseases = signal<Disease[]>([]);
  loading = signal(false);

  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  selectedDiseaseId: number | null = null;

  ngOnInit(): void {
    this.loadDiseases();
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDiseases(): void {
    this.http
      .get<PaginatedResponse<Disease>>(`${API}/api/v1/diseases`, {
        params: new HttpParams().set('page_size', '200').set('include_inactive', 'false')
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.diseases.set(res.items),
        error: (err: any) => console.error('[API Error]', err)
      });
  }

  loadTemplates(): void {
    this.loading.set(true);
    let params = new HttpParams()
      .set('page', this.currentPage)
      .set('page_size', this.pageSize)
      .set('include_inactive', 'true');
    if (this.selectedDiseaseId) {
      params = params.set('disease_id', this.selectedDiseaseId);
    }
    this.http
      .get<PaginatedResponse<FormTemplate>>(`${API}/api/v1/templates/`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const diseaseMap = new Map(this.diseases().map(d => [d.id, d.name]));
          this.templates.set(
            res.items.map(t => ({
              ...t,
              disease_name:
                t.disease_name ?? diseaseMap.get(t.disease_id) ?? `Disease #${t.disease_id}`
            }))
          );
          this.totalRecords = res.total;
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load templates' });
          this.loading.set(false);
        }
      });
  }

  onDiseaseFilter(): void {
    this.currentPage = 1;
    this.loadTemplates();
  }

  onPageChange(event: { page?: number; rows?: number }): void {
    this.currentPage = (event.page ?? 0) + 1;
    this.pageSize = event.rows ?? this.pageSize;
    this.loadTemplates();
  }

  goNew(): void {
    this.router.navigate(['/admin/templates/new']);
  }

  goEdit(id: number): void {
    this.router.navigate(['/admin/templates', id]);
  }

  confirmDelete(tmpl: FormTemplate): void {
    this.confirmationService.confirm({
      message: `Delete template <strong>v${tmpl.version}</strong> for "${tmpl.disease_name}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteTemplate(tmpl.id)
    });
  }

  deleteTemplate(id: number): void {
    this.http
      .delete(`${API}/api/v1/templates/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Template deleted.' });
          this.loadTemplates();
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.detail ?? 'Delete failed'
          });
        }
      });
  }
}
