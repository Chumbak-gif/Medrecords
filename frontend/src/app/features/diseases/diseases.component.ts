import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

export interface Disease {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubDisease {
  id: number;
  disease_id: number;
  name: string;
  is_active: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

@Component({
  selector: 'app-diseases',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    PaginatorModule,
    BadgeModule,
    TagModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">Disease Management</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">Manage diseases and their sub-classifications</p>
      </div>
      <button class="btn-primary" (click)="openAddDialog()">
        <i class="pi pi-plus"></i> Add Disease
      </button>
    </div>

    <div class="card">
      <!-- Search bar -->
      <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
        <span class="p-input-icon-left" style="flex:1;max-width:360px">
          <i class="pi pi-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-neutral-500)"></i>
          <input
            pInputText
            type="text"
            placeholder="Search diseases..."
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            style="padding-left:36px;width:100%"
          />
        </span>
        <span style="font-size:13px;color:var(--color-neutral-500)">{{ totalRecords }} record(s)</span>
      </div>

      <!-- Table -->
      <p-table
        [value]="diseases()"
        [loading]="loading()"
        dataKey="id"
        [expandedRowKeys]="expandedRows"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th style="width:3rem"></th>
            <th>Name</th>
            <th>Description</th>
            <th style="width:110px">Status</th>
            <th style="width:160px">Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-disease let-expanded="expanded">
          <tr>
            <td>
              <button
                type="button"
                pButton
                [pRowToggler]="disease"
                class="p-button-text p-button-rounded p-button-plain"
                [icon]="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                style="width:28px;height:28px"
              ></button>
            </td>
            <td>
              <span style="font-weight:600">{{ disease.name }}</span>
            </td>
            <td>
              <span style="color:var(--color-neutral-600)">{{ disease.description || '—' }}</span>
            </td>
            <td>
              @if (disease.is_active) {
                <span class="badge-active">Active</span>
              } @else {
                <span class="badge-inactive">Inactive</span>
              }
            </td>
            <td>
              <div style="display:flex;gap:6px">
                <button
                  type="button"
                  pButton
                  icon="pi pi-pencil"
                  class="p-button-text p-button-sm p-button-secondary"
                  title="Edit"
                  (click)="openEditDialog(disease)"
                ></button>
                @if (disease.is_active) {
                  <button
                    type="button"
                    pButton
                    icon="pi pi-trash"
                    class="p-button-text p-button-sm p-button-danger"
                    title="Deactivate"
                    (click)="confirmDelete(disease)"
                  ></button>
                } @else {
                  <button
                    type="button"
                    pButton
                    icon="pi pi-refresh"
                    class="p-button-text p-button-sm p-button-success"
                    title="Restore"
                    (click)="restore(disease)"
                  ></button>
                }
              </div>
            </td>
          </tr>
        </ng-template>

        <!-- Expandable sub-diseases row -->
        <ng-template pTemplate="rowexpansion" let-disease>
          <tr>
            <td colspan="5">
              <div style="padding:16px 40px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                  <h4 style="margin:0;font-size:13px;font-weight:700;color:var(--color-neutral-600);text-transform:uppercase;letter-spacing:.06em">
                    Sub-Diseases
                  </h4>
                  <button class="btn-secondary btn-sm" (click)="openAddSubDisease(disease)">
                    <i class="pi pi-plus"></i> Add Sub-Disease
                  </button>
                </div>

                @if (subDiseaseLoading[disease.id]) {
                  <p style="color:var(--color-neutral-500);font-size:13px">Loading...</p>
                } @else if (!subDiseases[disease.id]?.length) {
                  <p style="color:var(--color-neutral-400);font-size:13px;font-style:italic">No sub-diseases found.</p>
                } @else {
                  <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                      <tr style="border-bottom:1px solid var(--color-neutral-200)">
                        <th style="text-align:left;padding:6px 12px;font-weight:600;color:var(--color-neutral-600)">Name</th>
                        <th style="text-align:left;padding:6px 12px;font-weight:600;color:var(--color-neutral-600);width:100px">Status</th>
                        <th style="width:80px;padding:6px 12px"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (sub of subDiseases[disease.id]; track sub.id) {
                        <tr style="border-bottom:1px solid var(--color-neutral-100)">
                          <td style="padding:6px 12px">{{ sub.name }}</td>
                          <td style="padding:6px 12px">
                            @if (sub.is_active) {
                              <span class="badge-active">Active</span>
                            } @else {
                              <span class="badge-inactive">Inactive</span>
                            }
                          </td>
                          <td style="padding:6px 12px;text-align:right">
                            <button
                              type="button"
                              pButton
                              icon="pi pi-trash"
                              class="p-button-text p-button-sm p-button-danger"
                              title="Delete sub-disease"
                              (click)="deleteSubDisease(disease.id, sub.id)"
                            ></button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" style="text-align:center;padding:32px;color:var(--color-neutral-400)">
              No diseases found.
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

    <!-- Add/Edit Disease Dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      [header]="editingDisease ? 'Edit Disease' : 'Add Disease'"
      [modal]="true"
      [style]="{ width: '480px' }"
      [closable]="true"
    >
      <form [formGroup]="diseaseForm" (ngSubmit)="saveDisease()" novalidate>
        <div class="form-field-group">
          <label class="label">Name <span style="color:var(--color-error)">*</span></label>
          <input
            pInputText
            type="text"
            formControlName="name"
            placeholder="Disease name"
            style="width:100%"
          />
          @if (diseaseForm.get('name')?.invalid && diseaseForm.get('name')?.touched) {
            <span style="color:var(--color-error);font-size:12px">Name is required</span>
          }
        </div>

        <div class="form-field-group" style="margin-top:16px">
          <label class="label">Description</label>
          <textarea
            pInputTextarea
            formControlName="description"
            placeholder="Optional description"
            rows="3"
            style="width:100%"
          ></textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
          <button type="button" class="btn-secondary" (click)="dialogVisible = false">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="diseaseForm.invalid || saving()">
            @if (saving()) { Saving... } @else { {{ editingDisease ? 'Update' : 'Create' }} }
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- Add Sub-Disease Dialog -->
    <p-dialog
      [(visible)]="subDiseaseDialogVisible"
      header="Add Sub-Disease"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <div style="margin-bottom:8px;font-size:13px;color:var(--color-neutral-600)">
        Disease: <strong>{{ subDiseaseParent?.name }}</strong>
      </div>
      <div class="form-field-group">
        <label class="label">Sub-Disease Name <span style="color:var(--color-error)">*</span></label>
        <input
          pInputText
          type="text"
          [(ngModel)]="newSubDiseaseName"
          placeholder="Sub-disease name"
          style="width:100%"
        />
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
        <button type="button" class="btn-secondary" (click)="subDiseaseDialogVisible = false">Cancel</button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="!newSubDiseaseName.trim() || saving()"
          (click)="saveSubDisease()"
        >
          @if (saving()) { Saving... } @else { Add }
        </button>
      </div>
    </p-dialog>
  `,
  styles: [`
    .form-field-group { display:flex; flex-direction:column; gap:6px; }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; }
  `]
})
export class DiseasesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // State
  diseases = signal<Disease[]>([]);
  loading = signal(false);
  saving = signal(false);
  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  searchTerm = '';

  // Expanded rows
  expandedRows: Record<string, boolean> = {};
  subDiseases: Record<number, SubDisease[]> = {};
  subDiseaseLoading: Record<number, boolean> = {};

  // Dialog state
  dialogVisible = false;
  editingDisease: Disease | null = null;
  diseaseForm = this.fb.group({
    name: ['', Validators.required],
    description: ['']
  });

  subDiseaseDialogVisible = false;
  subDiseaseParent: Disease | null = null;
  newSubDiseaseName = '';

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadDiseases();
    });
    this.loadDiseases();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  loadDiseases(): void {
    this.loading.set(true);
    let params = new HttpParams()
      .set('page', this.currentPage)
      .set('page_size', this.pageSize)
      .set('include_inactive', 'true');
    if (this.searchTerm.trim()) {
      params = params.set('search', this.searchTerm.trim());
    }
    this.http.get<PaginatedResponse<Disease>>(`${API}/api/v1/diseases`, { params })
      .subscribe({
        next: (res) => {
          this.diseases.set(res.items);
          this.totalRecords = res.total;
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load diseases' });
          this.loading.set(false);
        }
      });
  }

  onPageChange(event: { page?: number; rows?: number }): void {
    this.currentPage = (event.page ?? 0) + 1;
    this.pageSize = event.rows ?? this.pageSize;
    this.loadDiseases();
  }

  openAddDialog(): void {
    this.editingDisease = null;
    this.diseaseForm.reset();
    this.dialogVisible = true;
  }

  openEditDialog(disease: Disease): void {
    this.editingDisease = disease;
    this.diseaseForm.patchValue({ name: disease.name, description: disease.description ?? '' });
    this.dialogVisible = true;
  }

  saveDisease(): void {
    if (this.diseaseForm.invalid) return;
    this.saving.set(true);
    const payload = this.diseaseForm.getRawValue();

    const request = this.editingDisease
      ? this.http.patch<Disease>(`${API}/api/v1/diseases/${this.editingDisease.id}`, payload)
      : this.http.post<Disease>(`${API}/api/v1/diseases`, payload);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success', summary: 'Success',
          detail: `Disease ${this.editingDisease ? 'updated' : 'created'} successfully`
        });
        this.dialogVisible = false;
        this.saving.set(false);
        this.loadDiseases();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Operation failed' });
        this.saving.set(false);
      }
    });
  }

  confirmDelete(disease: Disease): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to deactivate <strong>${disease.name}</strong>?`,
      header: 'Confirm Deactivate',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteDisease(disease)
    });
  }

  deleteDisease(disease: Disease): void {
    this.http.delete(`${API}/api/v1/diseases/${disease.id}`).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Disease deactivated' });
        this.loadDiseases();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Delete failed' });
      }
    });
  }

  restore(disease: Disease): void {
    this.http.post<Disease>(`${API}/api/v1/diseases/${disease.id}/restore`, {}).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Disease restored' });
        this.loadDiseases();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Restore failed' });
      }
    });
  }

  // Sub-disease management
  loadSubDiseases(diseaseId: number): void {
    this.subDiseaseLoading[diseaseId] = true;
    this.http.get<SubDisease[]>(`${API}/api/v1/diseases/${diseaseId}/sub-diseases`)
      .subscribe({
        next: (subs) => {
          this.subDiseases[diseaseId] = subs;
          this.subDiseaseLoading[diseaseId] = false;
        },
        error: () => {
          this.subDiseaseLoading[diseaseId] = false;
        }
      });
  }

  openAddSubDisease(disease: Disease): void {
    this.subDiseaseParent = disease;
    this.newSubDiseaseName = '';
    this.subDiseaseDialogVisible = true;
    if (!this.subDiseases[disease.id]) {
      this.loadSubDiseases(disease.id);
    }
  }

  saveSubDisease(): void {
    if (!this.subDiseaseParent || !this.newSubDiseaseName.trim()) return;
    this.saving.set(true);
    this.http.post<SubDisease>(
      `${API}/api/v1/diseases/${this.subDiseaseParent.id}/sub-diseases`,
      { name: this.newSubDiseaseName.trim() }
    ).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Sub-disease added' });
        this.loadSubDiseases(this.subDiseaseParent!.id);
        this.subDiseaseDialogVisible = false;
        this.saving.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Failed to add sub-disease' });
        this.saving.set(false);
      }
    });
  }

  deleteSubDisease(diseaseId: number, subId: number): void {
    this.http.delete(`${API}/api/v1/diseases/${diseaseId}/sub-diseases/${subId}`).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Sub-disease removed' });
        this.loadSubDiseases(diseaseId);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Delete failed' });
      }
    });
  }
}
