import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

// Shared
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

// Feature
import { PatientService, Patient } from './patient.service';

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    PaginatorModule,
    ToastModule,
    TagModule,
    TooltipModule,
    StatusBadgeComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">Patients</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Manage your registered patients
        </p>
      </div>
      <button class="btn-primary" (click)="goToRegister()">
        <i class="pi pi-plus"></i> New Patient
      </button>
    </div>

    <!-- Table Card -->
    <div class="card">
      <!-- Toolbar -->
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <span style="position:relative;flex:1;max-width:400px">
          <i class="pi pi-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-neutral-500);z-index:1"></i>
          <input
            pInputText
            type="text"
            placeholder="Search by name or Patient ID..."
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)"
            style="padding-left:36px;width:100%"
          />
        </span>
        <span style="font-size:13px;color:var(--color-neutral-500);margin-left:auto">
          {{ totalRecords }} patient(s)
        </span>
      </div>

      <!-- Table -->
      <p-table
        [value]="patients()"
        [loading]="loading()"
        dataKey="id"
        styleClass="p-datatable-sm"
        [rowHover]="true"
      >
        <ng-template pTemplate="header">
          <tr>
            <th style="min-width:130px">Patient UID</th>
            <th style="min-width:200px">Full Name</th>
            <th style="width:100px">Gender</th>
            <th style="min-width:150px">Contact</th>
            <th style="width:110px">Status</th>
            <th style="width:100px">Actions</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-patient>
          <tr
            style="cursor:pointer"
            [class.opacity-50]="!patient.is_active"
            (click)="goToDetail(patient.id)"
          >
            <td>
              <span style="font-family:monospace;font-size:12px;background:var(--color-neutral-100);padding:2px 8px;border-radius:4px;font-weight:600">
                {{ patient.patient_uid }}
              </span>
            </td>
            <td>
              <span style="font-weight:600">{{ patient.first_name }} {{ patient.last_name }}</span>
            </td>
            <td>
              <span style="color:var(--color-neutral-600)">{{ patient.gender }}</span>
            </td>
            <td>
              <span style="color:var(--color-neutral-600)">{{ patient.contact_number }}</span>
            </td>
            <td>
              <app-status-badge [status]="patient.is_active ? 'active' : 'inactive'" />
            </td>
            <td>
              <button
                type="button"
                pButton
                icon="pi pi-eye"
                class="p-button-text p-button-sm p-button-secondary"
                pTooltip="View Patient"
                tooltipPosition="top"
                (click)="$event.stopPropagation(); goToDetail(patient.id)"
              ></button>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="6" style="text-align:center;padding:40px;color:var(--color-neutral-400)">
              <i class="pi pi-users" style="font-size:2rem;display:block;margin-bottom:8px"></i>
              No patients found.
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
    .opacity-50 { opacity: 0.55; }
  `]
})
export class PatientsListComponent implements OnInit, OnDestroy {
  private patientService = inject(PatientService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // ── State ──────────────────────────────────────────────────────────────
  patients = signal<Patient[]>([]);
  loading = signal(false);

  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  searchTerm = '';

  // ── Lifecycle ──────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadPatients();
    });
    this.loadPatients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Search & Pagination ────────────────────────────────────────────────
  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  onPageChange(event: { page?: number; rows?: number }): void {
    this.currentPage = (event.page ?? 0) + 1;
    this.pageSize = event.rows ?? this.pageSize;
    this.loadPatients();
  }

  // ── Data Loading ───────────────────────────────────────────────────────
  loadPatients(): void {
    this.loading.set(true);
    this.patientService.getPatients({
      page: this.currentPage,
      page_size: this.pageSize,
      search: this.searchTerm,
    }).subscribe({
      next: (res) => {
        this.patients.set(res.items);
        this.totalRecords = res.total;
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load patients' });
        this.loading.set(false);
      }
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  goToRegister(): void {
    // Navigate relative to current route prefix (works for both /doctor and /admin)
    const prefix = this.router.url.startsWith('/admin') ? '/admin' : '/doctor';
    this.router.navigate([`${prefix}/patients/new`]);
  }

  goToDetail(id: number): void {
    const prefix = this.router.url.startsWith('/admin') ? '/admin' : '/doctor';
    this.router.navigate([`${prefix}/patients`, id]);
  }
}
