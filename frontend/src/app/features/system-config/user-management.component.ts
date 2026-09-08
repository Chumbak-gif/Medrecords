import {
  Component, OnInit, OnDestroy, inject, signal
} from '@angular/core';
import {
  FormsModule, ReactiveFormsModule, FormBuilder, Validators,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { PaginatorModule } from 'primeng/paginator';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { PasswordModule } from 'primeng/password';
import { MessageService, ConfirmationService } from 'primeng/api';

// Shared
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Password complexity: min 8 chars, >=1 uppercase, >=1 digit, >=1 special char */
function passwordComplexityValidator(control: AbstractControl): ValidationErrors | null {
  const val: string = control.value ?? '';
  if (!val) return null;
  if (val.length < 8)             return { tooShort: true };
  if (!/[A-Z]/.test(val))         return { noUppercase: true };
  if (!/[0-9]/.test(val))         return { noDigit: true };
  if (!/[^A-Za-z0-9]/.test(val))  return { noSpecial: true };
  return null;
}

const ROLE_OPTIONS = [
  { label: 'Doctor',    value: 'doctor' },
  { label: 'Admin',     value: 'admin' },
  { label: 'Pharma',    value: 'pharma_viewer' },
  { label: 'Sys Admin', value: 'sys_admin' },
];

const ROLE_FILTER_OPTIONS = [
  { label: 'All Roles', value: null },
  ...ROLE_OPTIONS,
];

const STATUS_OPTIONS = [
  { label: 'All Status', value: null  },
  { label: 'Active',     value: true  },
  { label: 'Inactive',   value: false },
];

const ROLE_LABEL_MAP: Record<string, string> = {
  doctor:        'Doctor',
  admin:         'Admin',
  pharma_viewer: 'Pharma',
  sys_admin:     'Sys Admin',
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  doctor:        'badge-role-doctor',
  admin:         'badge-role-admin',
  pharma_viewer: 'badge-role-pharma',
  sys_admin:     'badge-role-sysadmin',
};

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    TableModule, ButtonModule, InputTextModule,
    DialogModule, ConfirmDialogModule, ToastModule,
    PaginatorModule, DropdownModule, TooltipModule,
    PasswordModule, StatusBadgeComponent,
  ],
  providers: [MessageService, ConfirmationService],
  styles: [`
    .form-field-group { display:flex; flex-direction:column; gap:6px; }
    .field-error { color:var(--color-error); font-size:12px; }
    .badge-role-doctor   { background:#e0f2fe; color:#0369a1; font-size:11px; padding:2px 8px; border-radius:999px; font-weight:600; }
    .badge-role-admin    { background:#fef9c3; color:#854d0e; font-size:11px; padding:2px 8px; border-radius:999px; font-weight:600; }
    .badge-role-pharma   { background:#f0fdf4; color:#166534; font-size:11px; padding:2px 8px; border-radius:999px; font-weight:600; }
    .badge-role-sysadmin { background:#fce7f3; color:#9d174d; font-size:11px; padding:2px 8px; border-radius:999px; font-weight:600; }
    .opacity-50 { opacity: 0.55; }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; }
    :host ::ng-deep .p-password { width: 100%; }
    :host ::ng-deep .p-password .p-inputtext { width: 100%; }
    :host ::ng-deep .p-dropdown { width: 100%; }
  `],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">User Management</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Manage all platform users — create, edit, reset passwords and deactivate
        </p>
      </div>
      <button class="btn-primary" (click)="openAddDialog()">
        <i class="pi pi-plus"></i> Create User
      </button>
    </div>

    <div class="card">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <span style="position:relative;flex:1;min-width:200px;max-width:320px">
          <i class="pi pi-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-neutral-500);z-index:1"></i>
          <input pInputText type="text"
            placeholder="Search name, username, email…"
            [(ngModel)]="searchTerm" (ngModelChange)="onSearchChange($event)"
            style="padding-left:36px;width:100%" />
        </span>
        <p-dropdown [options]="roleFilterOptions" [(ngModel)]="selectedRole"
          optionLabel="label" optionValue="value" placeholder="All Roles"
          [style]="{'min-width':'160px'}" (onChange)="onFilterChange()" />
        <p-dropdown [options]="statusOptions" [(ngModel)]="selectedStatus"
          optionLabel="label" optionValue="value" placeholder="All Status"
          [style]="{'min-width':'140px'}" (onChange)="onFilterChange()" />
        <span style="font-size:13px;color:var(--color-neutral-500);margin-left:auto">
          {{ totalRecords }} record(s)
        </span>
      </div>

      <p-table [value]="users()" [loading]="loading()" dataKey="id" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th style="width:60px">ID</th>
            <th style="min-width:180px">Full Name</th>
            <th style="min-width:130px">Username</th>
            <th style="min-width:180px">Email</th>
            <th style="width:120px">Role</th>
            <th style="width:100px">Status</th>
            <th style="width:120px">Created</th>
            <th style="width:130px">Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-user>
          <tr [class.opacity-50]="!user.is_active">
            <td style="color:var(--color-neutral-400);font-size:12px">#{{ user.id }}</td>
            <td><span style="font-weight:600">{{ user.full_name }}</span></td>
            <td><span style="font-family:monospace;font-size:13px;color:var(--color-neutral-700)">{{ user.username }}</span></td>
            <td><span style="font-size:13px;color:var(--color-neutral-600)">{{ user.email }}</span></td>
            <td><span [class]="getRoleBadgeClass(user.role)">{{ getRoleLabel(user.role) }}</span></td>
            <td><app-status-badge [status]="user.is_active ? 'active' : 'inactive'" /></td>
            <td style="font-size:12px;color:var(--color-neutral-500)">{{ user.created_at | date:'dd MMM yyyy' }}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button type="button" pButton icon="pi pi-pencil"
                  class="p-button-text p-button-sm p-button-secondary"
                  pTooltip="Edit" tooltipPosition="top"
                  (click)="openEditDialog(user)"></button>
                <button type="button" pButton icon="pi pi-key"
                  class="p-button-text p-button-sm p-button-warning"
                  pTooltip="Reset Password" tooltipPosition="top"
                  (click)="openResetPasswordDialog(user)"></button>
                @if (user.is_active) {
                  <button type="button" pButton icon="pi pi-trash"
                    class="p-button-text p-button-sm p-button-danger"
                    pTooltip="Deactivate" tooltipPosition="top"
                    (click)="confirmDelete(user)"></button>
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="8" style="text-align:center;padding:40px;color:var(--color-neutral-400)">
              <i class="pi pi-users" style="font-size:2rem;display:block;margin-bottom:8px"></i>
              No users found.
            </td>
          </tr>
        </ng-template>
      </p-table>

      <p-paginator [rows]="pageSize" [totalRecords]="totalRecords"
        [first]="(currentPage - 1) * pageSize"
        (onPageChange)="onPageChange($event)"
        [rowsPerPageOptions]="[10, 20, 50]" styleClass="mt-3" />
    </div>

    <!-- Create / Edit Dialog -->
    <p-dialog [(visible)]="userDialogVisible"
      [header]="editingUser ? 'Edit User' : 'Create User'"
      [modal]="true" [style]="{ width: '520px' }"
      [closable]="true" [draggable]="false">
      <form [formGroup]="userForm" (ngSubmit)="saveUser()" novalidate>
        <div class="form-field-group">
          <label class="label">Full Name <span style="color:var(--color-error)">*</span></label>
          <input pInputText type="text" formControlName="full_name"
            placeholder="e.g. Dr. Anjali Mehta" style="width:100%" />
          @if (userForm.get('full_name')?.invalid && userForm.get('full_name')?.touched) {
            <span class="field-error">Full name is required</span>
          }
        </div>
        @if (!editingUser) {
          <div class="form-field-group" style="margin-top:16px">
            <label class="label">Username <span style="color:var(--color-error)">*</span></label>
            <input pInputText type="text" formControlName="username"
              placeholder="e.g. anjali.mehta" style="width:100%" autocomplete="username" />
            @if (userForm.get('username')?.invalid && userForm.get('username')?.touched) {
              <span class="field-error">Username is required</span>
            }
          </div>
        }
        <div class="form-field-group" style="margin-top:16px">
          <label class="label">Email <span style="color:var(--color-error)">*</span></label>
          <input pInputText type="email" formControlName="email"
            placeholder="e.g. anjali@hospital.com" style="width:100%" autocomplete="email" />
          @if (userForm.get('email')?.errors?.['required'] && userForm.get('email')?.touched) {
            <span class="field-error">Email is required</span>
          }
          @if (userForm.get('email')?.errors?.['email'] && userForm.get('email')?.touched) {
            <span class="field-error">Enter a valid email address</span>
          }
        </div>
        <div class="form-field-group" style="margin-top:16px">
          <label class="label">Role <span style="color:var(--color-error)">*</span></label>
          <p-dropdown formControlName="role" [options]="roleOptions"
            optionLabel="label" optionValue="value"
            placeholder="Select role" [style]="{'width':'100%'}" />
          @if (userForm.get('role')?.invalid && userForm.get('role')?.touched) {
            <span class="field-error">Role is required</span>
          }
        </div>
        @if (userForm.get('role')?.value === 'doctor') {
          <div class="form-field-group" style="margin-top:16px">
            <label class="label">Specialty</label>
            <input pInputText type="text" formControlName="specialty"
              placeholder="e.g. Cardiology" style="width:100%" />
          </div>
        }
        @if (!editingUser) {
          <div class="form-field-group" style="margin-top:16px">
            <label class="label">Password <span style="color:var(--color-error)">*</span></label>
            <p-password formControlName="password"
              placeholder="Min 8 chars, uppercase, digit, special char"
              [toggleMask]="true" [feedback]="false"
              styleClass="w-full" inputStyleClass="w-full" autocomplete="new-password" />
            @if (userForm.get('password')?.errors?.['required'] && userForm.get('password')?.touched) {
              <span class="field-error">Password is required</span>
            }
            @if (userForm.get('password')?.errors?.['tooShort'] && userForm.get('password')?.touched) {
              <span class="field-error">Minimum 8 characters</span>
            }
            @if (userForm.get('password')?.errors?.['noUppercase'] && userForm.get('password')?.touched) {
              <span class="field-error">Must contain at least one uppercase letter</span>
            }
            @if (userForm.get('password')?.errors?.['noDigit'] && userForm.get('password')?.touched) {
              <span class="field-error">Must contain at least one number</span>
            }
            @if (userForm.get('password')?.errors?.['noSpecial'] && userForm.get('password')?.touched) {
              <span class="field-error">Must contain at least one special character</span>
            }
          </div>
        }
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
          <button type="button" class="btn-secondary" (click)="userDialogVisible = false">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="userForm.invalid || saving()">
            @if (saving()) { Saving… } @else { {{ editingUser ? 'Update' : 'Create' }} }
          </button>
        </div>
      </form>
    </p-dialog>

    <!-- Reset Password Dialog -->
    <p-dialog [(visible)]="resetPwdDialogVisible"
      header="Reset Password" [modal]="true"
      [style]="{ width: '440px' }" [closable]="true" [draggable]="false">
      @if (resetTargetUser) {
        <p style="margin:0 0 16px;font-size:13px;color:var(--color-neutral-600)">
          Setting new password for <strong>{{ resetTargetUser.full_name }}</strong>
          (<span style="font-family:monospace">{{ resetTargetUser.username }}</span>)
        </p>
      }
      <form [formGroup]="resetPwdForm" (ngSubmit)="submitResetPassword()" novalidate>
        <div class="form-field-group">
          <label class="label">New Password <span style="color:var(--color-error)">*</span></label>
          <p-password formControlName="new_password"
            placeholder="Min 8 chars, uppercase, digit, special char"
            [toggleMask]="true" [feedback]="false"
            styleClass="w-full" inputStyleClass="w-full" autocomplete="new-password" />
          @if (resetPwdForm.get('new_password')?.errors?.['required'] && resetPwdForm.get('new_password')?.touched) {
            <span class="field-error">Password is required</span>
          }
          @if (resetPwdForm.get('new_password')?.errors?.['tooShort'] && resetPwdForm.get('new_password')?.touched) {
            <span class="field-error">Minimum 8 characters</span>
          }
          @if (resetPwdForm.get('new_password')?.errors?.['noUppercase'] && resetPwdForm.get('new_password')?.touched) {
            <span class="field-error">Must contain at least one uppercase letter</span>
          }
          @if (resetPwdForm.get('new_password')?.errors?.['noDigit'] && resetPwdForm.get('new_password')?.touched) {
            <span class="field-error">Must contain at least one number</span>
          }
          @if (resetPwdForm.get('new_password')?.errors?.['noSpecial'] && resetPwdForm.get('new_password')?.touched) {
            <span class="field-error">Must contain at least one special character</span>
          }
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
          <button type="button" class="btn-secondary" (click)="resetPwdDialogVisible = false">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="resetPwdForm.invalid || resetting()">
            @if (resetting()) { Resetting… } @else { Reset Password }
          </button>
        </div>
      </form>
    </p-dialog>
  `,
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // State
  users = signal<UserRecord[]>([]);
  loading = signal(false);
  saving = signal(false);
  resetting = signal(false);

  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  searchTerm = '';
  selectedRole: string | null = null;
  selectedStatus: boolean | null = null;

  // Option lists
  readonly roleOptions = ROLE_OPTIONS;
  readonly roleFilterOptions = ROLE_FILTER_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;

  // Create/Edit dialog
  userDialogVisible = false;
  editingUser: UserRecord | null = null;

  userForm = this.fb.group({
    full_name: ['', Validators.required],
    username:  ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    role:      ['', Validators.required],
    specialty: [''],
    password:  ['', [Validators.required, passwordComplexityValidator]],
  });

  // Reset password dialog
  resetPwdDialogVisible = false;
  resetTargetUser: UserRecord | null = null;

  resetPwdForm = this.fb.group({
    new_password: ['', [Validators.required, passwordComplexityValidator]],
  });

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadUsers();
    });
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  getRoleLabel(role: string): string {
    return ROLE_LABEL_MAP[role] ?? role;
  }

  getRoleBadgeClass(role: string): string {
    return ROLE_BADGE_CLASS[role] ?? 'badge-role-doctor';
  }

  // ── Filters ──────────────────────────────────────────────────────────
  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  onPageChange(event: { page?: number; rows?: number }): void {
    this.currentPage = (event.page ?? 0) + 1;
    this.pageSize = event.rows ?? this.pageSize;
    this.loadUsers();
  }

  // ── Data loading ─────────────────────────────────────────────────────
  loadUsers(): void {
    this.loading.set(true);
    let params = new HttpParams()
      .set('page', this.currentPage)
      .set('page_size', this.pageSize);

    if (this.searchTerm.trim()) {
      params = params.set('search', this.searchTerm.trim());
    }
    if (this.selectedRole !== null && this.selectedRole !== undefined) {
      params = params.set('role', this.selectedRole);
    }

    this.http.get<PaginatedResponse<UserRecord>>(`${API}/api/v1/users/`, { params })
      .subscribe({
        next: (res) => {
          let items = res.items;
          // Client-side active/inactive filter (API doesn't support is_active filter directly)
          if (this.selectedStatus !== null && this.selectedStatus !== undefined) {
            items = items.filter(u => u.is_active === this.selectedStatus);
          }
          this.users.set(items);
          this.totalRecords = res.total;
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load users' });
          this.loading.set(false);
        },
      });
  }

  // ── Create / Edit ────────────────────────────────────────────────────
  openAddDialog(): void {
    this.editingUser = null;
    this.userForm.reset();
    this.userForm.get('username')?.enable();
    this.userForm.get('password')?.setValidators([Validators.required, passwordComplexityValidator]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.userDialogVisible = true;
  }

  openEditDialog(user: UserRecord): void {
    this.editingUser = user;
    this.userForm.patchValue({
      full_name: user.full_name,
      username:  user.username,
      email:     user.email,
      role:      user.role,
      specialty: user.specialty ?? '',
      password:  '',
    });
    this.userForm.get('username')?.disable();
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.userDialogVisible = true;
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.userForm.getRawValue();

    if (this.editingUser) {
      const payload: Record<string, unknown> = {
        full_name: raw.full_name!.trim(),
        email:     raw.email!.trim(),
        role:      raw.role!,
        specialty: raw.specialty?.trim() || null,
      };
      this.http.patch<UserRecord>(`${API}/api/v1/users/${this.editingUser.id}`, payload)
        .subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'User updated successfully' });
            this.userDialogVisible = false;
            this.saving.set(false);
            this.loadUsers();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Update failed' });
            this.saving.set(false);
          },
        });
    } else {
      const payload = {
        full_name: raw.full_name!.trim(),
        username:  raw.username!.trim(),
        email:     raw.email!.trim(),
        role:      raw.role!,
        specialty: raw.specialty?.trim() || null,
        password:  raw.password!,
      };
      this.http.post<UserRecord>(`${API}/api/v1/users/`, payload)
        .subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'User created successfully' });
            this.userDialogVisible = false;
            this.saving.set(false);
            this.loadUsers();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Create failed' });
            this.saving.set(false);
          },
        });
    }
  }

  // ── Reset Password ───────────────────────────────────────────────────
  openResetPasswordDialog(user: UserRecord): void {
    this.resetTargetUser = user;
    this.resetPwdForm.reset();
    this.resetPwdDialogVisible = true;
  }

  submitResetPassword(): void {
    if (this.resetPwdForm.invalid) {
      this.resetPwdForm.markAllAsTouched();
      return;
    }
    if (!this.resetTargetUser) return;
    this.resetting.set(true);
    const payload = { password: this.resetPwdForm.value.new_password! };

    this.http.post<void>(`${API}/api/v1/users/${this.resetTargetUser.id}/reset-password`, payload)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success', summary: 'Success',
            detail: `Password reset for ${this.resetTargetUser!.full_name}`,
          });
          this.resetPwdDialogVisible = false;
          this.resetting.set(false);
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Password reset failed' });
          this.resetting.set(false);
        },
      });
  }

  // ── Soft Delete ──────────────────────────────────────────────────────
  confirmDelete(user: UserRecord): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to deactivate <strong>${user.full_name}</strong>?
        <br/><small style="color:var(--color-neutral-500)">The user will lose access to the portal.</small>`,
      header: 'Confirm Deactivate',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.softDeleteUser(user),
    });
  }

  softDeleteUser(user: UserRecord): void {
    this.http.delete<void>(`${API}/api/v1/users/${user.id}`)
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: `${user.full_name} deactivated` });
          this.loadUsers();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Delete failed' });
        },
      });
  }
}
