import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

// Shared
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { FollowupDialogComponent } from '../../shared/components/followup-dialog/followup-dialog.component';

// Core services
import { FollowupService, Followup } from '../../core/services/followup.service';
import { ExportService } from '../../core/services/export.service';

// Feature
import { PatientService, Patient, AssessmentSummary } from './patient.service';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    ToastModule,
    SkeletonModule,
    TooltipModule,
    ConfirmDialogModule,
    StatusBadgeComponent,
    FollowupDialogComponent,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    @if (loading()) {
      <!-- Skeleton loader -->
      <div class="page-header">
        <p-skeleton width="200px" height="28px" />
        <p-skeleton width="120px" height="36px" />
      </div>
      <div class="card" style="margin-bottom:20px">
        <p-skeleton height="120px" />
      </div>
      <div class="card">
        <p-skeleton height="200px" />
      </div>
    } @else if (patient()) {
      <!-- Page Header -->
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button
            type="button"
            pButton
            icon="pi pi-arrow-left"
            class="p-button-text p-button-secondary p-button-sm"
            pTooltip="Back to Patients"
            tooltipPosition="right"
            (click)="goBack()"
          ></button>
          <div>
            <h2 style="margin:0;font-size:1.25rem;font-weight:700">
              {{ patient()!.first_name }} {{ patient()!.last_name }}
            </h2>
            <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
              Patient Profile
            </p>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" (click)="goToEdit()">
            <i class="pi pi-pencil"></i> Edit Patient
          </button>
          <button class="btn-secondary" (click)="showFollowupDialog = true">
            <i class="pi pi-calendar-plus"></i> Schedule Follow-up
          </button>
          <button class="btn-primary" (click)="newAssessment()">
            <i class="pi pi-plus"></i> New Assessment
          </button>
        </div>
      </div>

      <!-- Demographics Card -->
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <span style="font-family:monospace;font-size:13px;background:var(--color-primary);color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;letter-spacing:0.5px">
            {{ patient()!.patient_uid }}
          </span>
          <app-status-badge [status]="patient()!.is_active ? 'active' : 'inactive'" />
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:20px">
          <div class="info-field">
            <span class="info-label">Full Name</span>
            <span class="info-value">{{ patient()!.first_name }} {{ patient()!.last_name }}</span>
          </div>
          <div class="info-field">
            <span class="info-label">Date of Birth</span>
            <span class="info-value">{{ patient()!.date_of_birth | date:'dd MMM yyyy' }}</span>
          </div>
          <div class="info-field">
            <span class="info-label">Gender</span>
            <span class="info-value">{{ patient()!.gender }}</span>
          </div>
          <div class="info-field">
            <span class="info-label">Contact Number</span>
            <span class="info-value">{{ patient()!.contact_number }}</span>
          </div>
          <div class="info-field">
            <span class="info-label">Email</span>
            <span class="info-value">{{ patient()!.email || '—' }}</span>
          </div>
          <div class="info-field">
            <span class="info-label">Registered On</span>
            <span class="info-value">{{ patient()!.created_at | date:'dd MMM yyyy' }}</span>
          </div>
        </div>
      </div>

      <!-- Visit History Card -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <h3 style="margin:0;font-size:1rem;font-weight:700">Visit History</h3>
            <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
              {{ assessments().length }} visit(s) recorded
            </p>
          </div>
        </div>

        <p-table
          [value]="assessments()"
          dataKey="id"
          styleClass="p-datatable-sm"
        >
          <ng-template pTemplate="header">
            <tr>
              <th style="min-width:130px">Visit Date</th>
              <th style="min-width:180px">Disease</th>
              <th style="min-width:160px">Sub-Disease</th>
              <th style="width:120px">Status</th>
              <th style="width:120px">Actions</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-assessment>
            <tr>
              <td>
                <span style="font-weight:600">{{ assessment.visit_date | date:'dd MMM yyyy' }}</span>
              </td>
              <td>
                <span>{{ assessment.disease_name }}</span>
              </td>
              <td>
                <span style="color:var(--color-neutral-600)">{{ assessment.sub_disease_name || '—' }}</span>
              </td>
              <td>
                <app-status-badge [status]="assessment.status" />
              </td>
              <td>
                <button
                  type="button"
                  pButton
                  icon="pi pi-eye"
                  class="p-button-text p-button-sm p-button-secondary"
                  pTooltip="View Assessment"
                  tooltipPosition="top"
                  (click)="viewAssessment(assessment.id)"
                ></button>
                <button
                  type="button"
                  pButton
                  icon="pi pi-file-pdf"
                  class="p-button-text p-button-sm p-button-danger"
                  pTooltip="Download PDF"
                  tooltipPosition="top"
                  (click)="downloadPdf(assessment.id)"
                ></button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5" style="text-align:center;padding:40px;color:var(--color-neutral-400)">
                <i class="pi pi-file-o" style="font-size:2rem;display:block;margin-bottom:8px"></i>
                No visits recorded yet.
                <br />
                <button
                  type="button"
                  class="btn-primary"
                  style="margin-top:12px"
                  (click)="newAssessment()"
                >
                  <i class="pi pi-plus"></i> Start First Visit
                </button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>

      <!-- Follow-up Dialog -->
      <app-followup-dialog
        [(visible)]="showFollowupDialog"
        [patientId]="patient()!.id"
        (created)="onFollowupCreated()"
      />

      <!-- Follow-ups Section -->
      <div class="card" style="margin-top:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <h3 style="margin:0;font-size:1rem;font-weight:700">Follow-ups</h3>
            <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
              {{ followups().length }} follow-up(s) scheduled
            </p>
          </div>
        </div>

        <p-table
          [value]="followups()"
          dataKey="id"
          styleClass="p-datatable-sm"
        >
          <ng-template pTemplate="header">
            <tr>
              <th style="min-width:130px">Scheduled Date</th>
              <th style="min-width:200px">Notes</th>
              <th style="width:120px">Status</th>
              <th style="width:160px">Actions</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-followup>
            <tr>
              <td>
                <span style="font-weight:600">{{ followup.scheduled_date | date:'dd MMM yyyy' }}</span>
              </td>
              <td>
                <span style="color:var(--color-neutral-600)">{{ truncateNotes(followup.notes) }}</span>
              </td>
              <td>
                <span [class]="getFollowupBadgeClass(followup.status)">{{ followup.status | titlecase }}</span>
              </td>
              <td>
                @if (followup.status === 'pending') {
                  <button
                    type="button"
                    pButton
                    icon="pi pi-check"
                    class="p-button-text p-button-sm p-button-success"
                    pTooltip="Mark Complete"
                    tooltipPosition="top"
                    (click)="markComplete(followup)"
                  ></button>
                  <button
                    type="button"
                    pButton
                    icon="pi pi-times"
                    class="p-button-text p-button-sm p-button-danger"
                    pTooltip="Cancel Follow-up"
                    tooltipPosition="top"
                    (click)="markCancelled(followup)"
                  ></button>
                }
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="4" style="text-align:center;padding:40px;color:var(--color-neutral-400)">
                <i class="pi pi-calendar" style="font-size:2rem;display:block;margin-bottom:8px"></i>
                No follow-ups scheduled for this patient.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>

    } @else {
      <!-- Error / Not Found state -->
      <div class="card" style="text-align:center;padding:60px">
        <i class="pi pi-user-minus" style="font-size:3rem;color:var(--color-neutral-300);display:block;margin-bottom:12px"></i>
        <h3 style="margin:0 0 8px;color:var(--color-neutral-600)">Patient not found</h3>
        <p style="color:var(--color-neutral-500);margin:0 0 20px">
          The patient you're looking for doesn't exist or has been removed.
        </p>
        <button class="btn-secondary" (click)="goBack()">
          <i class="pi pi-arrow-left"></i> Back to Patients
        </button>
      </div>
    }
  `,
  styles: [`
    .info-field { display:flex; flex-direction:column; gap:4px; }
    .info-label { font-size:11px; font-weight:700; text-transform:uppercase; color:var(--color-neutral-500); letter-spacing:0.5px; }
    .info-value { font-size:14px; color:var(--color-neutral-800); font-weight:500; }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; }
  `]
})
export class PatientDetailComponent implements OnInit {
  private patientService = inject(PatientService);
  private followupService = inject(FollowupService);
  private exportService = inject(ExportService);
  private confirmationService = inject(ConfirmationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messageService = inject(MessageService);

  loading = signal(true);
  patient = signal<Patient | null>(null);
  assessments = signal<AssessmentSummary[]>([]);
  followups = signal<Followup[]>([]);
  showFollowupDialog = false;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.loadPatient(id);
  }

  loadPatient(id: number): void {
    this.loading.set(true);
    this.patientService.getPatient(id).subscribe({
      next: (detail: any) => {
        // Handle both response shapes:
        // Shape 1 (expected): { patient: {...}, assessments: [...] }
        // Shape 2 (actual API): { id, first_name, ..., visits: [...] }
        if (detail.patient) {
          this.patient.set(detail.patient);
          this.assessments.set(detail.assessments ?? []);
        } else {
          // Flat response — extract patient fields and map visits to assessments
          const { visits, ...patientData } = detail;
          this.patient.set(patientData as any);
          this.assessments.set((visits ?? []).map((v: any) => ({
            id: v.assessment_id ?? v.id,
            visit_date: v.visit_date ?? v.created_at,
            disease_name: v.disease_name ?? '',
            sub_disease_name: v.sub_disease_name ?? null,
            status: v.status,
          })));
        }
        this.loading.set(false);
        this.loadFollowups();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load patient details' });
        this.patient.set(null);
        this.loading.set(false);
      }
    });
  }

  loadFollowups(): void {
    const patientId = this.patient()?.id;
    if (!patientId) return;

    this.followupService.list({ patient_id: patientId, page_size: 100 }).subscribe({
      next: (response) => {
        const sorted = this.sortFollowups(response.items);
        this.followups.set(sorted);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load follow-ups' });
      }
    });
  }

  private sortFollowups(items: Followup[]): Followup[] {
    const pending = items
      .filter(f => f.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

    const others = items
      .filter(f => f.status !== 'pending')
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());

    return [...pending, ...others];
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  goBack(): void {
    const prefix = this.router.url.startsWith('/admin') ? '/admin' : '/doctor';
    this.router.navigate([`${prefix}/patients`]);
  }

  goToEdit(): void {
    const prefix = this.router.url.startsWith('/admin') ? '/admin' : '/doctor';
    this.router.navigate([`${prefix}/patients`, this.patient()?.id], { queryParams: { edit: true } });
  }

  newAssessment(): void {
    this.router.navigate(['/doctor/assessments/new'], {
      queryParams: { patientId: this.patient()?.id }
    });
  }

  viewAssessment(assessmentId: number): void {
    this.router.navigate(['/doctor/assessments', assessmentId]);
  }

  downloadPdf(assessmentId: number): void {
    this.exportService.exportAssessmentPdf(assessmentId).catch(() => {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate PDF' });
    });
  }

  onFollowupCreated(): void {
    this.showFollowupDialog = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Follow-up Scheduled',
      detail: 'Follow-up has been scheduled successfully.',
      life: 5000,
    });
    this.loadFollowups();
  }

  // ── Follow-up Actions ──────────────────────────────────────────────────
  markComplete(followup: Followup): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to mark this follow-up as <strong>completed</strong>?`,
      header: 'Confirm Complete',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.followupService.update(followup.id, { status: 'completed' }).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Follow-up Completed',
              detail: 'Follow-up has been marked as completed.',
              life: 5000,
            });
            this.loadFollowups();
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update follow-up status. Please try again.',
            });
          }
        });
      }
    });
  }

  markCancelled(followup: Followup): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to <strong>cancel</strong> this follow-up?`,
      header: 'Confirm Cancel',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.followupService.update(followup.id, { status: 'cancelled' }).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Follow-up Cancelled',
              detail: 'Follow-up has been cancelled.',
              life: 5000,
            });
            this.loadFollowups();
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update follow-up status. Please try again.',
            });
          }
        });
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  truncateNotes(notes: string | null): string {
    if (!notes) return '—';
    return notes.length > 100 ? notes.substring(0, 100) + '…' : notes;
  }

  getFollowupBadgeClass(status: string): string {
    switch (status) {
      case 'pending': return 'badge-submitted';
      case 'completed': return 'badge-active';
      case 'cancelled': return 'badge-expired';
      default: return 'badge-default';
    }
  }
}
