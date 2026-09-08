import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { PasswordModule } from 'primeng/password';
import { MessageService, ConfirmationService } from 'primeng/api';

// Shared
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

// Feature service
import { DoctorService, Doctor } from './doctor.service';

/** Validates: min 8 chars, at least one digit */
function passwordComplexityValidator(control: AbstractControl): ValidationErrors | null {
  const val: string = control.value ?? '';
  if (!val) return null; // let `required` handle blank
  if (val.length < 8) return { tooShort: true };
  if (!/\d/.test(val)) return { noDigit: true };
  return null;
}

@Component({
  selector: 'app-doctors',
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
    TooltipModule,
    PasswordModule,
    StatusBadgeComponent,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">Doctor Accounts</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Manage doctor accounts — create, edit, reset passwords and deactivate
        </p>
      </div>
      <button class="btn-primary" (click)="openAddDialog()">
        <i class="pi pi-plus"></i> Add Doctor
      </button>
    </div>

    <!-- Main Table Card -->
    <div class="card">
      <!-- Toolbar -->
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <span style="position:relative;flex:1;max-width:360px">
          <i class="pi pi-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-neutral-500);z-index:1"></i>
          <input
            pInputText
            type="text"
            placeholder="Search by name, username…"
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            style="padding-left:36px;width:100%"
          />
        </span>
        <span style="font-size:13px;color:var(--color-neutral-500);margin-left:auto">
          {{ totalRecords }} record(s)
        </span>
      </div>

      <!-- Table -->
      <p-table
        [value]="doctors()"
        [loading]="loading()"
        dataKey="id"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th style="min-width:200px">Full Name</th>
            <th style="min-width:140px">Username</th>
            <th style="min-width:160px">Specialty</th>
            <th style="width:110px">Status</th>
            <th style="width:160px">Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-doctor>
          <tr [class.opacity-50]="!doctor.is_active">
            <td>
              <span style="font-weight:600">{{ doctor.full_name }}</span>
              <br />
              <span style="font-size:12px;color:var(--color-neutral-500)">{{ doctor.email }}</span>
            </td>
            <td>
              <span style="color:var(--color-neutral-700);font-family:monospace">{{ doctor.username }}</span>
            </td>
            <td>
              <span style="color:var(--color-neutral-600)">{{ doctor.specialty || '—' }}</span>
            </td>
            <td>
              <app-status-badge [status]="doctor.is_active ? 'active' : 'inactive'" />
            </td>
            <td>
              <div style="display:flex;gap:4px">
                <button
                  type="button"
                  pButton
                  icon="pi pi-pencil"
                  class="p-button-text p-button-sm p-button-secondary"
                  pTooltip="Edit"
                  tooltipPosition="top"
                  (click)="openEditDialog(doctor)"
                ></button>
                <button
                  type="button"
                  pButton
                  icon="pi pi-key"
                  class="p-button-text p-button-sm p-button-warning"
                  pTooltip="Reset Password"
                  tooltipPosition="top"
                  (click)="openResetPasswordDialog(doctor)"
                ></button>
                @if (doctor.is_active) {
                  <button
                    type="button"
                    pButton
                    icon="pi pi-trash"
                    class="p-button-text p-button-sm p-button-danger"
                    pTooltip="Deactivate"
                    tooltipPosition="top"
                    (click)="confirmDelete(doctor)"
                  ></button>
                }
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" style="text-align:center;padding:40px;color:var(--color-neutral-400)">
              <i class="pi pi-users" style="font-size:2rem;display:block;margin-bottom:8px"></i>
              No doctors found.
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

    <!-- ─────────────────── Add / Edit Doctor Dialog ─────────────────── -->
    <p-dialog
      [(visible)]="doctorDialogVisible"
      [header]="editingDoctor ? 'Edit Doctor' : 'Add Doctor'"
      [modal]="true"
      [style]="{ width: '520px' }"
      [closable]="true"
      [draggable]="false"
    >
      <form [formGroup]="doctorForm" (ngSubmit)="saveDoctor()" novalidate>

        <!-- Full Name -->
        <div class="form-field-group">
          <label class="label">
            Full Name <span style="color:var(--color-error)">*</span>
          </label>
          <input
            pInputText
            type="text"
            formControlName="full_name"
            placeholder="e.g. Dr. Priya Sharma"
            style="width:100%"
          />
          @if (doctorForm.get('full_name')?.invalid && doctorForm.get('full_name')?.touched) {
            <span class="field-error">Full name is required</span>
          }
        </div>

        <!-- Username (create only) -->
        @if (!editingDoctor) {
          <div class="form-field-group" style="margin-top:16px">
            <label class="label">
              Username <span style="color:var(--color-error)">*</span>
            </label>
            <input
              pInputText
              type="text"
              formControlName="username"
              placeholder="e.g. dr.priya"
              style="width:100%"
              autocomplete="username"
            />
            @if (doctorForm.get('username')?.invalid && doctorForm.get('username')?.touched) {
              <span class="field-error">Username is required</span>
            }
          </div>
        }

        <!-- Email -->
        <div class="form-field-group" style="margin-top:16px">
          <label class="label">
            Email <span style="color:var(--color-error)">*</span>
          </label>
          <input
            pInputText
            type="email"
            formControlName="email"
            placeholder="e.g. priya@hospital.com"
            style="width:100%"
            autocomplete="email"
          />
          @if (doctorForm.get('email')?.errors?.['required'] && doctorForm.get('email')?.touched) {
            <span class="field-error">Email is required</span>
          }
          @if (doctorForm.get('email')?.errors?.['email'] && doctorForm.get('email')?.touched) {
            <span class="field-error">Enter a valid email address</span>
          }
        </div>

        <!-- Specialty -->
        <div class="form-field-group" style="margin-top:16px">
          <label class="label">Specialty</label>
          <input
            pInputText
            type="text"
            formControlName="specialty"
            placeholder="e.g. Cardiology, Neurology"
            style="width:100%"
          />
        </div>

        <!-- Password (create only) -->
        @if (!editingDoctor) {
          <div class="form-field-group" style="margin-top:16px">
            <label class="label">
              Password <span style="color:var(--color-error)">*</span>
            </label>
            <p-password
              formControlName="password"
              placeholder="Min 8 chars, at least one digit"
              [toggleMask]="true"
              [feedback]="false"
              styleClass="w-full"
              inputStyleClass="w-full"
              autocomplete="new-password"
            />
            @if (doctorForm.get('password')?.errors?.['required'] && doctorForm.get('password')?.touched) {
              <span class="field-error">Password is required</span>
            }
            @if (doctorForm.get('password')?.errors?.['tooShort'] && doctorForm.get('password')?.touched) {
              <span class="field-error">Password must be at least 8 characters</span>
            }
            @if (doctorForm.get('password')?.errors?.['noDigit'] && doctorForm.get('password')?.touched) {
              <span class="field-error">Password must contain at least one digit</span>
            }
          </div>
        }

        <!-- Actions -->
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
          <button type="button" class="btn-secondary" (click)="doctorDialogVisible = false">
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="doctorForm.invalid || saving()"
          >
            @if (saving()) { Saving… }
            @else { {{ editingDoctor ? 'Update' : 'Create' }} }
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- ─────────────────── Reset Password Dialog ─────────────────── -->
    <p-dialog
      [(visible)]="resetPasswordDialogVisible"
      header="Reset Password"
      [modal]="true"
      [style]="{ width: '440px' }"
      [closable]="true"
      [draggable]="false"
    >
      @if (resetTargetDoctor) {
        <p style="margin:0 0 16px;font-size:13px;color:var(--color-neutral-600)">
          Setting new password for <strong>{{ resetTargetDoctor.full_name }}</strong>
          ({{ resetTargetDoctor.username }})
        </p>
      }

      <form [formGroup]="resetPasswordForm" (ngSubmit)="submitResetPassword()" novalidate>
        <div class="form-field-group">
          <label class="label">
            New Password <span style="color:var(--color-error)">*</span>
          </label>
          <p-password
            formControlName="new_password"
            placeholder="Min 8 chars, at least one digit"
            [toggleMask]="true"
            [feedback]="false"
            styleClass="w-full"
            inputStyleClass="w-full"
            autocomplete="new-password"
          />
          @if (resetPasswordForm.get('new_password')?.errors?.['required'] && resetPasswordForm.get('new_password')?.touched) {
            <span class="field-error">Password is required</span>
          }
          @if (resetPasswordForm.get('new_password')?.errors?.['tooShort'] && resetPasswordForm.get('new_password')?.touched) {
            <span class="field-error">Password must be at least 8 characters</span>
          }
          @if (resetPasswordForm.get('new_password')?.errors?.['noDigit'] && resetPasswordForm.get('new_password')?.touched) {
            <span class="field-error">Password must contain at least one digit</span>
          }
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
          <button type="button" class="btn-secondary" (click)="resetPasswordDialogVisible = false">
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="resetPasswordForm.invalid || resetting()"
          >
            @if (resetting()) { Resetting… }
            @else { Reset Password }
          </button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: [`
    .form-field-group { display:flex; flex-direction:column; gap:6px; }
    .field-error { color:var(--color-error); font-size:12px; }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; }
    .opacity-50 { opacity: 0.55; }
    :host ::ng-deep .p-password { width: 100%; }
    :host ::ng-deep .p-password .p-inputtext { width: 100%; }
  `],
})
export class DoctorsComponent implements OnInit, OnDestroy {
  private doctorService = inject(DoctorService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // ── State signals ──────────────────────────────────────────────────────
  doctors = signal<Doctor[]>([]);
  loading = signal(false);
  saving = signal(false);
  resetting = signal(false);

  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  searchTerm = '';

  // ── Doctor add/edit dialog ─────────────────────────────────────────────
  doctorDialogVisible = false;
  editingDoctor: Doctor | null = null;

  doctorForm = this.fb.group({
    full_name: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    specialty: [''],
    password: ['', [Validators.required, passwordComplexityValidator]],
  });

  // ── Reset password dialog ──────────────────────────────────────────────
  resetPasswordDialogVisible = false;
  resetTargetDoctor: Doctor | null = null;

  resetPasswordForm = this.fb.group({
    new_password: ['', [Validators.required, passwordComplexityValidator]],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadDoctors();
    });
    this.loadDoctors();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Search & pagination ────────────────────────────────────────────────
  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  onPageChange(event: { page?: number; rows?: number }): void {
    this.currentPage = (event.page ?? 0) + 1;
    this.pageSize = event.rows ?? this.pageSize;
    this.loadDoctors();
  }

  // ── Data loading ───────────────────────────────────────────────────────
  loadDoctors(): void {
    this.loading.set(true);
    this.doctorService.getDoctors({
      page: this.currentPage,
      page_size: this.pageSize,
      search: this.searchTerm,
    }).subscribe({
      next: (res) => {
        this.doctors.set(res.items);
        this.totalRecords = res.total;
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load doctors' });
        this.loading.set(false);
      },
    });
  }

  // ── Add / Edit dialog ──────────────────────────────────────────────────
  openAddDialog(): void {
    this.editingDoctor = null;
    this.doctorForm.reset();
    // Re-enable username and password for create mode
    this.doctorForm.get('username')?.enable();
    this.doctorForm.get('password')?.enable();
    this.doctorForm.get('password')?.setValidators([Validators.required, passwordComplexityValidator]);
    this.doctorForm.get('password')?.updateValueAndValidity();
    this.doctorDialogVisible = true;
  }

  openEditDialog(doctor: Doctor): void {
    this.editingDoctor = doctor;
    this.doctorForm.patchValue({
      full_name: doctor.full_name,
      username: doctor.username,
      email: doctor.email,
      specialty: doctor.specialty ?? '',
      password: '',
    });
    // Username and password are not editable
    this.doctorForm.get('username')?.disable();
    this.doctorForm.get('password')?.clearValidators();
    this.doctorForm.get('password')?.updateValueAndValidity();
    this.doctorDialogVisible = true;
  }

  saveDoctor(): void {
    if (this.doctorForm.invalid) {
      this.doctorForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.doctorForm.getRawValue();

    if (this.editingDoctor) {
      const payload = {
        full_name: raw.full_name!.trim(),
        email: raw.email!.trim(),
        specialty: raw.specialty?.trim() || null,
      };
      this.doctorService.updateDoctor(this.editingDoctor.id, payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Doctor updated successfully' });
          this.doctorDialogVisible = false;
          this.saving.set(false);
          this.loadDoctors();
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.detail ?? 'Update failed',
          });
          this.saving.set(false);
        },
      });
    } else {
      const payload = {
        full_name: raw.full_name!.trim(),
        username: raw.username!.trim(),
        email: raw.email!.trim(),
        specialty: raw.specialty?.trim() || null,
        password: raw.password!,
        role: 'doctor' as const,
      };
      this.doctorService.createDoctor(payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Doctor account created successfully' });
          this.doctorDialogVisible = false;
          this.saving.set(false);
          this.loadDoctors();
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err?.error?.detail ?? 'Create failed',
          });
          this.saving.set(false);
        },
      });
    }
  }

  // ── Reset Password dialog ──────────────────────────────────────────────
  openResetPasswordDialog(doctor: Doctor): void {
    this.resetTargetDoctor = doctor;
    this.resetPasswordForm.reset();
    this.resetPasswordDialogVisible = true;
  }

  submitResetPassword(): void {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }
    if (!this.resetTargetDoctor) return;

    this.resetting.set(true);
    const payload = { password: this.resetPasswordForm.value.new_password! };

    this.doctorService.resetPassword(this.resetTargetDoctor.id, payload).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Password reset for ${this.resetTargetDoctor!.full_name}`,
        });
        this.resetPasswordDialogVisible = false;
        this.resetting.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.detail ?? 'Password reset failed',
        });
        this.resetting.set(false);
      },
    });
  }

  // ── Soft-delete ────────────────────────────────────────────────────────
  confirmDelete(doctor: Doctor): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to deactivate <strong>${doctor.full_name}</strong>?
        <br/><small style="color:var(--color-neutral-500)">The doctor will lose access to the portal.</small>`,
      header: 'Confirm Deactivate',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteDoctor(doctor),
    });
  }

  deleteDoctor(doctor: Doctor): void {
    this.doctorService.softDeleteDoctor(doctor.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `${doctor.full_name} deactivated` });
        this.loadDoctors();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.detail ?? 'Delete failed',
        });
      },
    });
  }
}
