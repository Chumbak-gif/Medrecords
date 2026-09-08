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
import { TagModule } from 'primeng/tag';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageService, ConfirmationService } from 'primeng/api';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

export interface Medicine {
  id: number;
  name: string;
  brand_name: string | null;
  generic_name: string | null;
  strength: string | null;
  form: string | null;
  manufacturer: string | null;
  category: string | null;
  unit: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  errors: ImportError[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

@Component({
  selector: 'app-medicines',
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
    TagModule,
    FileUploadModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">Medicine Management</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">Manage medicines catalogue, bulk import, and restore</p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" (click)="downloadTemplate()">
          <i class="pi pi-download"></i> Import Template
        </button>
        <button class="btn-secondary" (click)="importDialogVisible = true">
          <i class="pi pi-upload"></i> Bulk Import
        </button>
        <button class="btn-primary" (click)="openAddDialog()">
          <i class="pi pi-plus"></i> Add Medicine
        </button>
      </div>
    </div>

    <div class="card">
      <!-- Search bar -->
      <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
        <span class="p-input-icon-left" style="flex:1;max-width:360px">
          <i class="pi pi-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-neutral-500)"></i>
          <input
            pInputText
            type="text"
            placeholder="Search medicines..."
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            style="padding-left:36px;width:100%"
          />
        </span>
        <span style="font-size:13px;color:var(--color-neutral-500)">{{ totalRecords }} record(s)</span>
      </div>

      <!-- Table -->
      <p-table
        [value]="medicines()"
        [loading]="loading()"
        dataKey="id"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>Name</th>
            <th>Brand Name</th>
            <th>Generic Name</th>
            <th>Strength</th>
            <th>Form</th>
            <th>Manufacturer</th>
            <th style="width:90px">Status</th>
            <th style="width:130px">Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-medicine>
          <tr>
            <td><span style="font-weight:600">{{ medicine.name }}</span></td>
            <td>{{ medicine.brand_name || '—' }}</td>
            <td>{{ medicine.generic_name || '—' }}</td>
            <td>{{ medicine.strength || '—' }}</td>
            <td>{{ medicine.form || '—' }}</td>
            <td>{{ medicine.manufacturer || '—' }}</td>
            <td>
              @if (medicine.is_active) {
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
                  (click)="openEditDialog(medicine)"
                ></button>
                @if (medicine.is_active) {
                  <button
                    type="button"
                    pButton
                    icon="pi pi-trash"
                    class="p-button-text p-button-sm p-button-danger"
                    title="Deactivate"
                    (click)="confirmDelete(medicine)"
                  ></button>
                } @else {
                  <button
                    type="button"
                    pButton
                    icon="pi pi-refresh"
                    class="p-button-text p-button-sm p-button-success"
                    title="Restore"
                    (click)="restore(medicine)"
                  ></button>
                }
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="8" style="text-align:center;padding:32px;color:var(--color-neutral-400)">
              No medicines found.
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

    <!-- Add/Edit Medicine Dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      [header]="editingMedicine ? 'Edit Medicine' : 'Add Medicine'"
      [modal]="true"
      [style]="{ width: '560px' }"
      [closable]="true"
    >
      <form [formGroup]="medicineForm" (ngSubmit)="saveMedicine()" novalidate>
        <div class="form-field-group">
          <label class="label">Name <span style="color:var(--color-error)">*</span></label>
          <input pInputText type="text" formControlName="name" placeholder="Medicine name" style="width:100%" />
          @if (medicineForm.get('name')?.invalid && medicineForm.get('name')?.touched) {
            <span style="color:var(--color-error);font-size:12px">Name is required</span>
          }
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
          <div class="form-field-group">
            <label class="label">Brand Name</label>
            <input pInputText type="text" formControlName="brand_name" placeholder="Brand name" style="width:100%" />
          </div>
          <div class="form-field-group">
            <label class="label">Generic Name</label>
            <input pInputText type="text" formControlName="generic_name" placeholder="Generic name" style="width:100%" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
          <div class="form-field-group">
            <label class="label">Strength</label>
            <input pInputText type="text" formControlName="strength" placeholder="e.g. 500mg" style="width:100%" />
          </div>
          <div class="form-field-group">
            <label class="label">Dosage Form</label>
            <input pInputText type="text" formControlName="form" placeholder="e.g. Tablet" style="width:100%" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
          <div class="form-field-group">
            <label class="label">Manufacturer</label>
            <input pInputText type="text" formControlName="manufacturer" placeholder="Manufacturer" style="width:100%" />
          </div>
          <div class="form-field-group">
            <label class="label">Unit</label>
            <input pInputText type="text" formControlName="unit" placeholder="e.g. mg, ml" style="width:100%" />
          </div>
        </div>

        <div class="form-field-group" style="margin-top:16px">
          <label class="label">Category</label>
          <input pInputText type="text" formControlName="category" placeholder="Category" style="width:100%" />
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
          <button type="button" class="btn-secondary" (click)="dialogVisible = false">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="medicineForm.invalid || saving()">
            @if (saving()) { Saving... } @else { {{ editingMedicine ? 'Update' : 'Create' }} }
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- Bulk Import Dialog -->
    <p-dialog
      [(visible)]="importDialogVisible"
      header="Bulk Import Medicines"
      [modal]="true"
      [style]="{ width: '560px' }"
      [closable]="true"
      (onHide)="resetImport()"
    >
      <div style="margin-bottom:16px">
        <p style="font-size:13px;color:var(--color-neutral-600);margin:0 0 12px">
          Upload an Excel (.xlsx) file with the required columns. Download the
          <a href="javascript:void(0)" (click)="downloadTemplate()" style="color:var(--color-primary);font-weight:600">import template</a>
          for the correct format.
        </p>

        <p-fileUpload
          mode="basic"
          name="file"
          accept=".xlsx"
          [maxFileSize]="10000000"
          chooseLabel="Choose File"
          chooseIcon="pi pi-upload"
          [auto]="false"
          (onSelect)="onFileSelect($event)"
          #fileUpload
        />
        @if (selectedFileName) {
          <p style="font-size:12px;color:var(--color-neutral-500);margin-top:8px">
            <i class="pi pi-file"></i> {{ selectedFileName }}
          </p>
        }
      </div>

      <!-- Import result -->
      @if (importResult) {
        @if (importResult.errors.length === 0) {
          <div style="background:var(--color-success-bg, #ecfdf5);border:1px solid var(--color-success, #10b981);border-radius:8px;padding:12px;margin-bottom:16px">
            <p style="margin:0;font-size:13px;color:var(--color-success, #10b981);font-weight:600">
              <i class="pi pi-check-circle"></i> Import successful: {{ importResult.inserted }} inserted, {{ importResult.updated }} updated.
            </p>
          </div>
        } @else {
          <div style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:12px;margin-bottom:16px">
            <p style="margin:0 0 8px;font-size:13px;color:#ef4444;font-weight:600">
              <i class="pi pi-times-circle"></i> Import failed — {{ importResult.errors.length }} row(s) with errors:
            </p>
            <div style="max-height:200px;overflow-y:auto">
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                  <tr style="border-bottom:1px solid #fecaca">
                    <th style="text-align:left;padding:4px 8px;font-weight:600">Row</th>
                    <th style="text-align:left;padding:4px 8px;font-weight:600">Field</th>
                    <th style="text-align:left;padding:4px 8px;font-weight:600">Error</th>
                  </tr>
                </thead>
                <tbody>
                  @for (err of importResult.errors; track err.row) {
                    <tr style="border-bottom:1px solid #fecaca">
                      <td style="padding:4px 8px">{{ err.row }}</td>
                      <td style="padding:4px 8px">{{ err.field }}</td>
                      <td style="padding:4px 8px">{{ err.message }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button type="button" class="btn-secondary" (click)="importDialogVisible = false">Close</button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="!selectedFile || importing()"
          (click)="uploadFile()"
        >
          @if (importing()) { Importing... } @else { Import }
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
export class MedicinesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // State
  medicines = signal<Medicine[]>([]);
  loading = signal(false);
  saving = signal(false);
  importing = signal(false);
  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  searchTerm = '';

  // Add/Edit Dialog state
  dialogVisible = false;
  editingMedicine: Medicine | null = null;
  medicineForm = this.fb.group({
    name: ['', Validators.required],
    brand_name: [''],
    generic_name: [''],
    strength: [''],
    form: [''],
    manufacturer: [''],
    category: [''],
    unit: [''],
  });

  // Import Dialog state
  importDialogVisible = false;
  selectedFile: File | null = null;
  selectedFileName = '';
  importResult: ImportResult | null = null;

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadMedicines();
    });
    this.loadMedicines();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  loadMedicines(): void {
    this.loading.set(true);
    let params = new HttpParams()
      .set('page', this.currentPage)
      .set('page_size', this.pageSize)
      .set('include_inactive', 'true');
    if (this.searchTerm.trim()) {
      params = params.set('search', this.searchTerm.trim());
    }
    this.http.get<PaginatedResponse<Medicine>>(`${API}/api/v1/medicines`, { params })
      .subscribe({
        next: (res) => {
          this.medicines.set(res.items);
          this.totalRecords = res.total;
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load medicines' });
          this.loading.set(false);
        }
      });
  }

  onPageChange(event: { page?: number; rows?: number }): void {
    this.currentPage = (event.page ?? 0) + 1;
    this.pageSize = event.rows ?? this.pageSize;
    this.loadMedicines();
  }

  // ───── Add/Edit Dialog ─────

  openAddDialog(): void {
    this.editingMedicine = null;
    this.medicineForm.reset();
    this.dialogVisible = true;
  }

  openEditDialog(medicine: Medicine): void {
    this.editingMedicine = medicine;
    this.medicineForm.patchValue({
      name: medicine.name,
      brand_name: medicine.brand_name ?? '',
      generic_name: medicine.generic_name ?? '',
      strength: medicine.strength ?? '',
      form: medicine.form ?? '',
      manufacturer: medicine.manufacturer ?? '',
      category: medicine.category ?? '',
      unit: medicine.unit ?? '',
    });
    this.dialogVisible = true;
  }

  saveMedicine(): void {
    if (this.medicineForm.invalid) return;
    this.saving.set(true);
    const raw = this.medicineForm.getRawValue();
    const payload = {
      name: raw.name,
      brand_name: raw.brand_name || null,
      generic_name: raw.generic_name || null,
      strength: raw.strength || null,
      form: raw.form || null,
      manufacturer: raw.manufacturer || null,
      category: raw.category || null,
      unit: raw.unit || null,
    };

    const request = this.editingMedicine
      ? this.http.patch<Medicine>(`${API}/api/v1/medicines/${this.editingMedicine.id}`, payload)
      : this.http.post<Medicine>(`${API}/api/v1/medicines`, payload);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success', summary: 'Success',
          detail: `Medicine ${this.editingMedicine ? 'updated' : 'created'} successfully`
        });
        this.dialogVisible = false;
        this.saving.set(false);
        this.loadMedicines();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Operation failed' });
        this.saving.set(false);
      }
    });
  }

  // ───── Soft-delete & Restore ─────

  confirmDelete(medicine: Medicine): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to deactivate <strong>${medicine.name}</strong>?`,
      header: 'Confirm Deactivate',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteMedicine(medicine)
    });
  }

  deleteMedicine(medicine: Medicine): void {
    this.http.delete(`${API}/api/v1/medicines/${medicine.id}`).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Medicine deactivated' });
        this.loadMedicines();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Delete failed' });
      }
    });
  }

  restore(medicine: Medicine): void {
    this.http.patch<Medicine>(`${API}/api/v1/medicines/${medicine.id}`, { is_active: true }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Medicine restored' });
        this.loadMedicines();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Restore failed' });
      }
    });
  }

  // ───── Bulk Import ─────

  onFileSelect(event: any): void {
    const file = event.files?.[0] ?? event.currentFiles?.[0];
    if (file) {
      this.selectedFile = file;
      this.selectedFileName = file.name;
      this.importResult = null;
    }
  }

  uploadFile(): void {
    if (!this.selectedFile) return;
    this.importing.set(true);
    this.importResult = null;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<ImportResult>(`${API}/api/v1/medicines/import`, formData).subscribe({
      next: (result) => {
        this.importResult = result;
        this.importing.set(false);
        if (result.errors.length === 0) {
          this.messageService.add({
            severity: 'success', summary: 'Import Successful',
            detail: `${result.inserted} inserted, ${result.updated} updated`
          });
          this.loadMedicines();
        }
      },
      error: (err) => {
        this.importing.set(false);
        const detail = err?.error?.detail ?? 'Import failed';
        this.messageService.add({ severity: 'error', summary: 'Import Error', detail });
      }
    });
  }

  resetImport(): void {
    this.selectedFile = null;
    this.selectedFileName = '';
    this.importResult = null;
  }

  // ───── Download Template ─────

  downloadTemplate(): void {
    this.http.get(`${API}/api/v1/medicines/template`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'medicines_template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to download template' });
      }
    });
  }
}
