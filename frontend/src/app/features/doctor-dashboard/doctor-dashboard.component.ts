import {
  Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

// Shared
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

// Services
import { AssessmentService, Assessment, DoctorKpis } from '../assessments/assessment.service';
import { ExportService } from '../../core/services/export.service';
import { AuthService } from '../../core/auth/auth.service';
import { FollowupService, FollowupDashboard, Followup } from '../../core/services/followup.service';

// ─── Models ──────────────────────────────────────────────────────────────────

interface AssessmentRow extends Assessment {
  patient_name?: string;
  patient_uid?: string;
  visit_date?: string | null;
}

interface MonthOption {
  label: string;
  value: number;
}

interface YearOption {
  label: string;
  value: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  providers: [MessageService, DatePipe],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    ToastModule,
    TooltipModule,
    DialogModule,
    DropdownModule,
    SkeletonModule,
    KpiCardComponent,
    StatusBadgeComponent,
  ],
  template: `
<p-toast position="top-right" />

<div class="dashboard-page">

  <!-- ── Page Header ── -->
  <div class="page-header">
    <div>
      <h2 class="page-title">Doctor Dashboard</h2>
      <p class="page-subtitle">
        Welcome back, <strong>{{ doctorName() }}</strong> — here's your activity summary.
      </p>
    </div>
    <div class="header-actions">
      <button class="btn-secondary" (click)="openExportDialog()">
        <i class="pi pi-file-excel"></i>
        Export Monthly Excel
      </button>
      <button class="btn-primary" (click)="goToNewVisit()">
        <i class="pi pi-plus"></i>
        New Visit
      </button>
    </div>
  </div>

  <!-- ── KPI Cards ── -->
  <div class="kpi-grid">
    @if (kpiLoading()) {
      @for (i of [1,2,3,4]; track i) {
        <div class="kpi-card">
          <p-skeleton shape="circle" size="56px" />
          <div style="flex:1">
            <p-skeleton height="1.5rem" width="60%" styleClass="mb-2" />
            <p-skeleton height="0.75rem" width="40%" />
          </div>
        </div>
      }
    } @else {
      <app-kpi-card
        title="Total Patients"
        [value]="kpis()?.total_patients ?? 0"
        icon="pi-users"
        color="#ed1c24"
      />
      <app-kpi-card
        title="This Month Assessments"
        [value]="kpis()?.this_month_submitted ?? 0"
        icon="pi-calendar-plus"
        color="#3b82f6"
      />
      <app-kpi-card
        title="Drafts"
        [value]="kpis()?.drafts ?? 0"
        icon="pi-file-edit"
        color="#f59e0b"
      />
      <app-kpi-card
        title="Locked"
        [value]="kpis()?.locked ?? 0"
        icon="pi-lock"
        color="#10b981"
      />
    }
  </div>

  <!-- ── Today's Follow-ups ── -->
  <div class="card">
    <div class="table-header">
      <div>
        <h3 class="table-title">Today's Follow-ups</h3>
        <p class="table-subtitle">Patients scheduled for follow-up today</p>
      </div>
    </div>

    @if (todayFollowups().length === 0) {
      <div class="empty-state">
        <i class="pi pi-calendar" style="font-size:2rem;display:block;margin-bottom:8px"></i>
        No follow-ups scheduled for today.
      </div>
    } @else {
      <div class="followup-list">
        @for (fu of todayFollowups(); track fu.id) {
          <div class="followup-item" [class.followup-overdue]="isOverdue(fu)">
            <div class="followup-patient">
              <span class="patient-name">{{ fu.patient_name || '—' }}</span>
              @if (fu.patient_uid) {
                <span class="uid-badge">{{ fu.patient_uid }}</span>
              }
            </div>
            <div class="followup-details">
              <span class="followup-disease">{{ fu.disease_name || '—' }}</span>
              <span class="followup-date text-muted">
                <i class="pi pi-calendar"></i>
                {{ fu.scheduled_date | date:'dd MMM yyyy' }}
              </span>
            </div>
          </div>
        }
      </div>
    }
  </div>

  <!-- ── Recent Assessments Table ── -->
  <div class="card">
    <div class="table-header">
      <div>
        <h3 class="table-title">Recent Assessments</h3>
        <p class="table-subtitle">Your 20 most recent records, sorted by last modified</p>
      </div>
      <button
        class="btn-ghost btn-sm"
        (click)="loadAssessments()"
        [disabled]="tableLoading()"
      >
        <i class="pi pi-refresh" [class.spin]="tableLoading()"></i>
        Refresh
      </button>
    </div>

    <p-table
      [value]="assessments()"
      [loading]="tableLoading()"
      [virtualScroll]="assessments().length > 50"
      [virtualScrollItemSize]="46"
      [scrollHeight]="assessments().length > 50 ? '480px' : undefined"
      dataKey="id"
      styleClass="p-datatable-sm"
      [rowHover]="true"
    >
      <ng-template pTemplate="header">
        <tr>
          <th style="min-width:160px">Patient Name</th>
          <th style="min-width:130px">Patient ID</th>
          <th style="min-width:120px">Visit Date</th>
          <th style="min-width:150px">Disease</th>
          <th style="min-width:150px">Sub-Disease</th>
          <th style="width:110px">Status</th>
          <th style="width:90px;text-align:center">PDF</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-row>
        <tr class="table-row" (click)="openAssessment(row)">
          <td>
            <span class="patient-name">{{ row.patient_name || '—' }}</span>
          </td>
          <td>
            @if (row.patient_uid) {
              <span class="uid-badge">{{ row.patient_uid }}</span>
            } @else {
              <span class="text-muted">—</span>
            }
          </td>
          <td>
            <span class="text-muted">
              {{ (row.submitted_at || row.updated_at) | date:'dd MMM yyyy' }}
            </span>
          </td>
          <td>
            <span>{{ row.disease_name || '—' }}</span>
          </td>
          <td>
            <span class="text-muted">{{ row.sub_disease_name || '—' }}</span>
          </td>
          <td>
            <app-status-badge [status]="row.status" />
          </td>
          <td style="text-align:center">
            <button
              type="button"
              pButton
              icon="pi pi-file-pdf"
              class="p-button-text p-button-sm p-button-danger"
              pTooltip="Export PDF"
              tooltipPosition="top"
              [loading]="exportingPdfId() === row.id"
              (click)="$event.stopPropagation(); exportPdf(row)"
            ></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td colspan="7" class="empty-state">
            <i class="pi pi-clipboard" style="font-size:2rem;display:block;margin-bottom:8px"></i>
            No recent assessments found.
            <br />
            <button class="btn-primary btn-sm" style="margin-top:12px" (click)="goToNewVisit()">
              <i class="pi pi-plus"></i> Start a New Visit
            </button>
          </td>
        </tr>
      </ng-template>
    </p-table>
  </div>

</div>

<!-- ── Export Monthly Excel Dialog ── -->
<p-dialog
  header="Export Monthly Excel"
  [(visible)]="exportDialogVisible"
  [modal]="true"
  [draggable]="false"
  [resizable]="false"
  [style]="{ width: '380px' }"
  styleClass="export-dialog"
>
  <div class="export-dialog-body">
    <p class="export-dialog-hint">
      Select the month and year to export your patient assessment records.
    </p>

    <div class="export-fields">
      <div class="export-field">
        <label class="label">Month <span style="color:var(--color-error)">*</span></label>
        <p-dropdown
          [options]="monthOptions"
          optionLabel="label"
          optionValue="value"
          [(ngModel)]="selectedMonth"
          placeholder="Select month"
          [style]="{ width: '100%' }"
          appendTo="body"
        />
      </div>
      <div class="export-field">
        <label class="label">Year <span style="color:var(--color-error)">*</span></label>
        <p-dropdown
          [options]="yearOptions"
          optionLabel="label"
          optionValue="value"
          [(ngModel)]="selectedYear"
          placeholder="Select year"
          [style]="{ width: '100%' }"
          appendTo="body"
        />
      </div>
    </div>
  </div>

  <ng-template pTemplate="footer">
    <button class="btn-secondary" (click)="exportDialogVisible = false">Cancel</button>
    <button
      class="btn-primary"
      [disabled]="!selectedMonth || !selectedYear || exporting()"
      (click)="runExport()"
    >
      @if (exporting()) {
        <i class="pi pi-spin pi-spinner"></i>
      } @else {
        <i class="pi pi-download"></i>
      }
      {{ exporting() ? 'Exporting…' : 'Export' }}
    </button>
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* ── Header ── */
    .page-title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--color-neutral-900);
    }
    .page-subtitle {
      margin: 4px 0 0;
      color: var(--color-neutral-600);
      font-size: 13px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* ── KPI Grid ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    @media (max-width: 1100px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .kpi-grid { grid-template-columns: 1fr; }
    }

    /* ── Table Card ── */
    .table-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .table-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-neutral-900);
    }
    .table-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--color-neutral-500);
    }
    .table-row {
      cursor: pointer;
    }
    .patient-name {
      font-weight: 600;
      color: var(--color-neutral-900);
    }
    .uid-badge {
      font-family: monospace;
      font-size: 12px;
      background: var(--color-neutral-100);
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }

    /* ── Empty state ── */
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: var(--color-neutral-400);
      font-size: 14px;
    }

    /* ── Refresh icon animation ── */
    .spin {
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* ── Export dialog ── */
    .export-dialog-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 4px 0;
    }
    .export-dialog-hint {
      margin: 0;
      font-size: 13px;
      color: var(--color-neutral-600);
    }
    .export-fields {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .export-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* PrimeNG table cell overrides */
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      padding: 10px 12px;
      vertical-align: middle;
    }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 700;
      background: var(--color-neutral-50);
      color: var(--color-neutral-600);
    }
    :host ::ng-deep .p-dialog .p-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    /* ── Today's Follow-ups ── */
    .followup-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .followup-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid var(--color-neutral-200);
      background: var(--color-neutral-50);
      transition: border-color 0.2s;
    }
    .followup-item:hover {
      border-color: var(--color-neutral-300);
    }
    .followup-overdue {
      border-color: #fca5a5;
      background: #fef2f2;
    }
    .followup-overdue:hover {
      border-color: #f87171;
    }
    .followup-patient {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .followup-details {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 13px;
    }
    .followup-disease {
      color: var(--color-neutral-700);
      font-weight: 500;
    }
    .followup-date {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
    }
  `]
})
export class DoctorDashboardComponent implements OnInit, OnDestroy {
  private assessmentService = inject(AssessmentService);
  private exportService = inject(ExportService);
  private authService = inject(AuthService);
  private followupService = inject(FollowupService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  private destroy$ = new Subject<void>();

  // ── Signals ────────────────────────────────────────────────────────────────
  kpis = signal<DoctorKpis | null>(null);
  kpiLoading = signal(true);
  assessments = signal<AssessmentRow[]>([]);
  tableLoading = signal(false);
  exporting = signal(false);
  exportingPdfId = signal<number | null>(null);
  followupDashboard = signal<FollowupDashboard | null>(null);

  doctorName = computed(() => {
    const user = this.authService.currentUser();
    return user?.full_name ?? user?.username ?? 'Doctor';
  });

  todayFollowups = computed(() => {
    return this.followupDashboard()?.today_followups ?? [];
  });

  // ── Export Dialog ──────────────────────────────────────────────────────────
  exportDialogVisible = false;
  selectedMonth: number | null = null;
  selectedYear: number | null = null;

  monthOptions: MonthOption[] = [
    { label: 'January',   value: 1  },
    { label: 'February',  value: 2  },
    { label: 'March',     value: 3  },
    { label: 'April',     value: 4  },
    { label: 'May',       value: 5  },
    { label: 'June',      value: 6  },
    { label: 'July',      value: 7  },
    { label: 'August',    value: 8  },
    { label: 'September', value: 9  },
    { label: 'October',   value: 10 },
    { label: 'November',  value: 11 },
    { label: 'December',  value: 12 },
  ];

  yearOptions: YearOption[] = this.buildYearOptions();

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadKpis();
    this.loadAssessments();
    this.loadFollowupDashboard();

    // Default export dialog to current month/year
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data Loading ───────────────────────────────────────────────────────────

  loadKpis(): void {
    this.kpiLoading.set(true);
    this.assessmentService.getDashboardKpis()
      .pipe(takeUntil(this.destroy$), finalize(() => this.kpiLoading.set(false)))
      .subscribe({
        next: (data) => this.kpis.set(data),
        error: () => {
          this.messageService.add({
            severity: 'warn',
            summary: 'KPI Load Failed',
            detail: 'Could not load dashboard KPIs. Please refresh.',
          });
        }
      });
  }

  loadAssessments(): void {
    this.tableLoading.set(true);
    this.assessmentService.getAssessments({ page: 1, page_size: 20 })
      .pipe(takeUntil(this.destroy$), finalize(() => this.tableLoading.set(false)))
      .subscribe({
        next: (res) => {
          // Map patient data to flat row structure if present
          const rows: AssessmentRow[] = (res.items ?? []).map((a: any) => ({
            ...a,
            patient_name: a.patient
              ? `${a.patient.first_name} ${a.patient.last_name}`.trim()
              : a.patient_name ?? undefined,
            patient_uid: a.patient?.patient_uid ?? a.patient_uid ?? undefined,
            visit_date: a.submitted_at ?? a.updated_at ?? a.created_at,
          }));
          this.assessments.set(rows);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load recent assessments.',
          });
        }
      });
  }

  loadFollowupDashboard(): void {
    this.followupService.getDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.followupDashboard.set(data),
        error: () => {
          this.messageService.add({
            severity: 'warn',
            summary: 'Follow-up Load Failed',
            detail: 'Could not load follow-up dashboard data.',
          });
        }
      });
  }

  isOverdue(followup: Followup): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduled = new Date(followup.scheduled_date);
    scheduled.setHours(0, 0, 0, 0);
    return scheduled < today;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  goToNewVisit(): void {
    this.router.navigate(['/doctor/assessments/new']);
  }

  openAssessment(row: AssessmentRow): void {
    this.router.navigate(['/doctor/assessments', row.id]);
  }

  // ── PDF Export ─────────────────────────────────────────────────────────────

  async exportPdf(row: AssessmentRow): Promise<void> {
    if (this.exportingPdfId() !== null) return;
    this.exportingPdfId.set(row.id);
    try {
      await this.exportService.exportAssessmentPdf(row.id);
      this.messageService.add({
        severity: 'success',
        summary: 'PDF Exported',
        detail: `Assessment PDF downloaded successfully.`,
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: err?.message ?? 'Could not export assessment PDF.',
      });
    } finally {
      this.exportingPdfId.set(null);
    }
  }

  // ── Excel Export Dialog ────────────────────────────────────────────────────

  openExportDialog(): void {
    this.exportDialogVisible = true;
  }

  async runExport(): Promise<void> {
    if (!this.selectedMonth || !this.selectedYear || this.exporting()) return;

    this.exporting.set(true);
    try {
      await this.exportService.exportDoctorExcel(this.selectedMonth, this.selectedYear);
      this.messageService.add({
        severity: 'success',
        summary: 'Export Successful',
        detail: `Monthly Excel exported for ${this.getMonthLabel(this.selectedMonth)} ${this.selectedYear}.`,
      });
      this.exportDialogVisible = false;
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: err?.message ?? 'Could not export Excel file.',
      });
    } finally {
      this.exporting.set(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildYearOptions(): YearOption[] {
    const currentYear = new Date().getFullYear();
    const years: YearOption[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push({ label: String(y), value: y });
    }
    return years;
  }

  private getMonthLabel(month: number): string {
    return this.monthOptions.find(m => m.value === month)?.label ?? String(month);
  }
}
