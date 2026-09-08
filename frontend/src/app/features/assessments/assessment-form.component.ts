import {
  Component, OnInit, OnDestroy, ViewChild, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil } from 'rxjs/operators';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { FieldsetModule } from 'primeng/fieldset';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

// Shared components
import { DynamicFormComponent } from '../../shared/components/dynamic-form/dynamic-form.component';
import { PrescriptionGridComponent } from '../../shared/components/prescription-grid/prescription-grid.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { FollowupDialogComponent } from '../../shared/components/followup-dialog/followup-dialog.component';

// Services & models
import { AuthService } from '../../core/auth/auth.service';
import { PatientService, Patient, RegisterPatientDto } from '../patients/patient.service';
import { TemplateService, FormSchema, FormTemplate } from '../templates/template.service';
import { AssessmentService, AssessmentDetail, PrescriptionRow } from './assessment.service';
import { ExportService } from '../../core/services/export.service';
import { Followup } from '../../core/services/followup.service';
import { environment } from '../../../environments/environment';

// ─── Local Models ──────────────────────────────────────────────────────────

const API_DISEASES = `${environment.apiBaseUrl}/api/v1/diseases`;

export interface Disease {
  id: number;
  name: string;
  is_active: boolean;
}

export interface SubDisease {
  id: number;
  disease_id: number;
  name: string;
  is_active: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-assessment-form',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    InputTextModule,
    FieldsetModule,
    ProgressSpinnerModule,
    ToastModule,
    MessageModule,
    DividerModule,
    TagModule,
    DynamicFormComponent,
    PrescriptionGridComponent,
    StatusBadgeComponent,
    FollowupDialogComponent,
  ],
  template: `
<p-toast position="top-right"></p-toast>

<div class="assessment-form-page">
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-left">
      <button pButton type="button" icon="pi pi-arrow-left" class="p-button-text p-button-secondary"
        label="Back" (click)="goBack()"></button>
      <div class="header-title">
        <h1 class="page-title">
          @if (isNewMode()) { New Assessment }
          @else if (isLockedMode()) { View Assessment }
          @else { Edit Assessment }
        </h1>
        @if (assessment()) {
          <app-status-badge [status]="assessment()!.status"></app-status-badge>
        }
      </div>
    </div>
    <!-- Lock countdown for submitted records -->
    @if (assessment()?.status === 'submitted' && lockCountdown()) {
      <div class="lock-countdown" role="status" aria-live="polite">
        <i class="pi pi-clock"></i>
        <span>Locks in: <strong>{{ lockCountdown() }}</strong></span>
      </div>
    }
  </div>

  <!-- Loading spinner -->
  @if (loading()) {
    <div class="loading-wrapper">
      <p-progressSpinner strokeWidth="4" [style]="{'width':'48px','height':'48px'}"></p-progressSpinner>
      <p class="loading-text">Loading assessment...</p>
    </div>
  }

  @if (!loading()) {
    <div class="form-content">

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- STEP 1: Consent Section                                   -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <p-fieldset legend="Step 1 — Consent" styleClass="form-section" [toggleable]="false">
        <div class="consent-section">
          <div class="consent-statement">
            <p>
              I, the undersigned doctor, confirm that I have obtained informed consent from the patient
              for collecting, processing, and storing their medical data in the MEDRecords portal.
              The patient has been informed of their rights regarding data access, correction, and deletion
              in accordance with applicable data protection regulations.
            </p>
          </div>
          <div class="consent-checkbox-row">
            <input
              type="checkbox"
              id="consent-checkbox"
              [(ngModel)]="consentGiven"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="isLockedMode()"
              (change)="onConsentChange($any($event.target).checked)"
              class="consent-checkbox-input"
            />
            <label for="consent-checkbox" class="consent-label">
              I confirm the patient has given their informed consent. <span class="required-marker">*</span>
            </label>
          </div>
          @if (submitAttempted && !consentGiven) {
            <span class="field-error">Consent is required before submitting.</span>
          }
        </div>
      </p-fieldset>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- STEP 2: Patient Demographics                              -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <p-fieldset legend="Step 2 — Patient Demographics" styleClass="form-section" [toggleable]="false">

        <!-- New / Existing patient toggle (only shown in new-assessment mode) -->
        @if (isNewMode()) {
          <div class="patient-mode-toggle">
            <button type="button"
              class="pill-btn"
              [class.active]="patientMode === 'new'"
              (click)="setPatientMode('new')">
              New Patient
            </button>
            <button type="button"
              class="pill-btn"
              [class.active]="patientMode === 'existing'"
              (click)="setPatientMode('existing')">
              Existing Patient
            </button>
          </div>
        }

        <!-- Existing patient search dropdown -->
        @if (patientMode === 'existing') {
          <div class="existing-patient-search">
            <div class="form-field" style="max-width: 420px;">
              <label>Search Patient <span class="required-marker">*</span></label>
              <p-dropdown
                [options]="patientSearchResults()"
                optionLabel="displayLabel"
                optionValue="id"
                placeholder="Type to search by name or UID..."
                [(ngModel)]="selectedExistingPatientId"
                [ngModelOptions]="{ standalone: true }"
                [filter]="true"
                filterBy="displayLabel"
                [editable]="false"
                appendTo="body"
                [style]="{'width': '100%'}"
                (onFilter)="onPatientSearch($event.filter)"
                (onChange)="onExistingPatientSelect($event.value)"
                [showClear]="true"
              ></p-dropdown>
            </div>
          </div>
        }

        <!-- Demographics form -->
        @if (patientForm) {
          <form [formGroup]="patientForm" class="demographics-grid">
            <div class="form-row">
              <div class="form-field">
                <label>First Name <span class="required-marker">*</span></label>
                <input pInputText formControlName="first_name" placeholder="First name"
                  [readonly]="isLockedMode() || patientMode === 'existing'" />
              </div>
              <div class="form-field">
                <label>Last Name <span class="required-marker">*</span></label>
                <input pInputText formControlName="last_name" placeholder="Last name"
                  [readonly]="isLockedMode() || patientMode === 'existing'" />
              </div>
              <div class="form-field">
                <label>Patient UID</label>
                <input pInputText formControlName="patient_uid" readonly />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>Date of Birth <span class="required-marker">*</span></label>
                <input pInputText formControlName="date_of_birth" placeholder="YYYY-MM-DD"
                  [readonly]="isLockedMode() || patientMode === 'existing'" />
              </div>
              <div class="form-field">
                <label>Gender <span class="required-marker">*</span></label>
                <input pInputText formControlName="gender" placeholder="Gender"
                  [readonly]="isLockedMode() || patientMode === 'existing'" />
              </div>
              <div class="form-field">
                <label>Contact Number <span class="required-marker">*</span></label>
                <input pInputText formControlName="contact_number" placeholder="Contact number"
                  [readonly]="isLockedMode() || patientMode === 'existing'" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>Email</label>
                <input pInputText formControlName="email" placeholder="Email address"
                  [readonly]="isLockedMode() || patientMode === 'existing'" />
              </div>
            </div>
          </form>
        }
      </p-fieldset>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- STEP 3: Disease Selector + Dynamic Form                   -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <p-fieldset legend="Step 3 — Disease & Clinical Form" styleClass="form-section" [toggleable]="false">
        <div class="disease-selectors">
          <div class="form-field">
            <label for="disease-select">Disease <span class="required-marker">*</span></label>
            <p-dropdown
              inputId="disease-select"
              [options]="diseases()"
              optionLabel="name"
              optionValue="id"
              placeholder="Select disease..."
              [(ngModel)]="selectedDiseaseId"
              [ngModelOptions]="{ standalone: true }"
              [disabled]="isLockedMode() || diseaseLoadError()"
              [filter]="true"
              filterBy="name"
              appendTo="body"
              [style]="{'width': '100%', 'max-width': '360px'}"
              (onChange)="onDiseaseChange($event.value)"
            ></p-dropdown>
            @if (submitAttempted && !selectedDiseaseId) {
              <span class="field-error">Disease is required.</span>
            }
          </div>

          @if (subDiseases().length > 0) {
            <div class="form-field">
              <label for="subdisease-select">Sub-Disease</label>
              <p-dropdown
                inputId="subdisease-select"
                [options]="subDiseases()"
                optionLabel="name"
                optionValue="id"
                placeholder="Select sub-disease (optional)..."
                [(ngModel)]="selectedSubDiseaseId"
                [ngModelOptions]="{ standalone: true }"
                [disabled]="isLockedMode()"
                [showClear]="true"
                appendTo="body"
                [style]="{'width': '100%', 'max-width': '360px'}"
              ></p-dropdown>
            </div>
          }
        </div>

        <!-- Template loading state -->
        @if (templateLoading()) {
          <div class="template-loading">
            <p-progressSpinner strokeWidth="4" [style]="{'width':'28px','height':'28px'}"></p-progressSpinner>
            <span>Loading form template...</span>
          </div>
        }

        <!-- No active template message -->
        @if (!templateLoading() && selectedDiseaseId && !activeTemplate() && !templateLoadError()) {
          <div class="no-template-msg" role="alert">
            <i class="pi pi-info-circle"></i>
            No active template found for the selected disease. Form submission is disabled until
            an admin activates a template for this disease.
          </div>
        }

        <!-- Template load error -->
        @if (templateLoadError()) {
          <div class="no-template-msg template-error" role="alert">
            <i class="pi pi-exclamation-triangle"></i>
            Failed to load form template. Please try re-selecting the disease.
          </div>
        }

        <!-- Dynamic form rendered from template schema -->
        @if (activeTemplate() && !templateLoading()) {
          <div class="dynamic-form-wrapper">
            <app-dynamic-form
              #dynamicForm
              [schema]="activeTemplate()!.schema"
              [initialData]="initialFormData()"
              [isReadonly]="isLockedMode()"
            ></app-dynamic-form>
          </div>
        }
      </p-fieldset>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- STEP 4: Prescription Grid                                 -->
      <!-- ══════════════════════════════════════════════════════════ -->
      <p-fieldset legend="Step 4 — Prescriptions" styleClass="form-section" [toggleable]="false">
        <app-prescription-grid
          #prescriptionGrid
          [isReadonly]="isLockedMode()"
          [initialRows]="initialPrescriptionRows()"
        ></app-prescription-grid>
      </p-fieldset>

      <!-- ══════════════════════════════════════════════════════════ -->
      <!-- STEP 5: Action Bar                                        -->
      <!-- ══════════════════════════════════════════════════════════ -->
      @if (!isLockedMode()) {
        <div class="action-bar">
          <div class="action-bar-left">
            <button type="button" class="btn-secondary" [disabled]="savingDraft() || submitting()" (click)="saveDraft()">
              @if (savingDraft()) { <i class="pi pi-spin pi-spinner"></i> Saving... }
              @else { <i class="pi pi-save"></i> Save Draft }
            </button>
            @if (assessment()?.status === 'submitted') {
              <button type="button" class="btn-secondary" (click)="showFollowupDialog = true">
                <i class="pi pi-calendar-plus"></i> Schedule Follow-up
              </button>
            }
          </div>
          <div class="action-bar-right">
            <button type="button" class="btn-secondary" [disabled]="!assessment()?.id" (click)="exportPdf()">
              <i class="pi pi-file-pdf"></i> Export PDF
            </button>
            <button type="button" class="btn-primary" [disabled]="savingDraft() || !canSubmit() || submitting()" (click)="submitAssessment()">
              @if (submitting()) { <i class="pi pi-spin pi-spinner"></i> Submitting... }
              @else { <i class="pi pi-check-circle"></i> Submit Assessment }
            </button>
          </div>
        </div>
      }

      <!-- Locked view: export-only action bar -->
      @if (isLockedMode()) {
        <div class="action-bar">
          <div class="action-bar-left">
            <button type="button" class="btn-secondary" (click)="showFollowupDialog = true">
              <i class="pi pi-calendar-plus"></i> Schedule Follow-up
            </button>
          </div>
          <div class="action-bar-right">
            <button type="button" class="btn-secondary" (click)="exportPdf()">
              <i class="pi pi-file-pdf"></i> Export PDF
            </button>
          </div>
        </div>
      }

      <!-- Follow-up scheduling dialog -->
      @if (assessment()?.status === 'submitted' || assessment()?.status === 'locked') {
        <app-followup-dialog
          [(visible)]="showFollowupDialog"
          [patientId]="assessment()!.patient_id"
          [assessmentId]="assessment()!.id"
          (created)="onFollowupCreated($event)"
        ></app-followup-dialog>
      }

    </div>
  }
</div>
  `,
  styles: [`
    .assessment-form-page {
      padding: 24px;
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--color-neutral-900, #111827);
    }

    .lock-countdown {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 8px;
      color: #854d0e;
      font-size: 14px;
      font-weight: 500;
    }

    .loading-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 60px 0;
    }

    .loading-text {
      color: var(--color-neutral-500, #6b7280);
      font-size: 14px;
    }

    .form-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    :host ::ng-deep .form-section .p-fieldset-legend {
      font-weight: 700;
      font-size: 14px;
      color: var(--color-neutral-700, #374151);
    }

    .consent-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .consent-statement {
      background: var(--color-neutral-50, #f9fafb);
      border: 1px solid var(--color-neutral-200, #e5e7eb);
      border-radius: 8px;
      padding: 16px;
      color: var(--color-neutral-700, #374151);
      font-size: 14px;
      line-height: 1.6;
    }

    .consent-statement p { margin: 0; }

    .consent-checkbox-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .consent-label {
      font-size: 14px;
      color: var(--color-neutral-800, #1f2937);
      cursor: pointer;
      font-weight: 500;
    }

    .demographics-grid form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-width: 200px;
    }

    .form-field label {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-neutral-600, #4b5563);
    }

    .required-marker {
      color: var(--color-error, #dc2626);
    }

    .field-error {
      font-size: 12px;
      color: var(--color-error, #dc2626);
      margin-top: 2px;
    }

    .disease-selectors {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 16px;
    }

    .template-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
      color: var(--color-neutral-500, #6b7280);
      font-size: 14px;
    }

    .no-template-msg {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1d4ed8;
      font-size: 14px;
      margin-top: 8px;
    }

    .no-template-msg.template-error {
      background: #fef2f2;
      border-color: #fecaca;
      color: #dc2626;
    }

    .dynamic-form-wrapper {
      margin-top: 16px;
    }

    .action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-5);
      background: var(--surface-card);
      border: 1px solid var(--color-neutral-200);
      border-radius: var(--radius-lg);
      position: sticky;
      bottom: 16px;
      z-index: 10;
      box-shadow: var(--shadow-md);
      flex-wrap: wrap;
      gap: 12px;
    }

    .action-bar-left, .action-bar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* ─── Plain checkbox styling (Fix 1) ─────────────────────────────────── */
    .consent-checkbox-input {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--color-primary);
      flex-shrink: 0;
    }

    /* ─── Patient mode toggle pills (Fix 2) ──────────────────────────────── */
    .patient-mode-toggle {
      display: flex;
      gap: 0;
      margin-bottom: 18px;
      border-radius: 8px;
      overflow: hidden;
      border: 1.5px solid #dee2e6;
      width: fit-content;
    }

    .pill-btn {
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      background: #fff;
      color: var(--color-neutral-600, #4b5563);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .pill-btn:first-child {
      border-right: 1px solid #dee2e6;
    }

    .pill-btn.active {
      background: var(--color-primary);
      color: #fff;
    }

    .pill-btn:hover:not(.active) {
      background: #f9fafb;
    }

    .existing-patient-search {
      margin-bottom: 16px;
    }

    /* ─── Action bar custom buttons (Fix 4) ──────────────────────────────── */
    .btn-primary,
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1.5px solid transparent;
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
      white-space: nowrap;
    }

    .btn-primary {
      background: var(--color-primary);
      color: #fff;
      border-color: var(--color-primary);
    }

    .btn-primary:hover:not(:disabled) {
      background: #c71118;
      border-color: #c71118;
    }

    .btn-secondary {
      background: #fff;
      color: var(--color-neutral-700, #374151);
      border-color: #dee2e6;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #f3f4f6;
    }

    .btn-primary:disabled,
    .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ─── Date picker flat styling (Fix 3) ───────────────────────────────── */
    :host ::ng-deep .p-calendar {
      width: 100% !important;
    }
    :host ::ng-deep .p-calendar .p-inputtext {
      width: 100% !important;
      border: 1.5px solid #dee2e6 !important;
      border-radius: 7px !important;
      padding: 9px 12px !important;
      min-height: 40px !important;
      box-shadow: none !important;
      background: #ffffff !important;
      font-size: 14px !important;
    }
    :host ::ng-deep .p-calendar .p-inputtext:focus {
      border-color: var(--color-primary) !important;
      box-shadow: 0 0 0 3px rgba(6,182,212,0.12) !important;
    }
  `],
})
export class AssessmentFormComponent implements OnInit, OnDestroy {
  @ViewChild('dynamicForm') dynamicFormRef?: DynamicFormComponent;
  @ViewChild('prescriptionGrid') prescriptionGridRef?: PrescriptionGridComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private patientService = inject(PatientService);
  private templateService = inject(TemplateService);
  private assessmentService = inject(AssessmentService);
  private messageService = inject(MessageService);
  private exportService = inject(ExportService);

  private destroy$ = new Subject<void>();
  private countdownInterval?: ReturnType<typeof setInterval>;

  // ─── Signals ───────────────────────────────────────────────────────────────

  loading = signal(true);
  savingDraft = signal(false);
  submitting = signal(false);
  templateLoading = signal(false);

  assessment = signal<AssessmentDetail | null>(null);
  diseases = signal<Disease[]>([]);
  subDiseases = signal<SubDisease[]>([]);
  activeTemplate = signal<FormTemplate | null>(null);
  initialFormData = signal<Record<string, unknown>>({});
  initialPrescriptionRows = signal<PrescriptionRow[]>([]);

  diseaseLoadError = signal(false);
  templateLoadError = signal(false);

  lockCountdown = signal<string | null>(null);

  // ─── Patient mode (Fix 2) ──────────────────────────────────────────────────
  patientMode: 'new' | 'existing' = 'new';
  patientSearchResults = signal<(Patient & { displayLabel: string })[]>([]);
  selectedExistingPatientId: number | null = null;
  private allPatientsLoaded = false;

  // ─── Form state ────────────────────────────────────────────────────────────

  patientForm!: FormGroup;
  consentGiven = false;
  selectedDiseaseId: number | null = null;
  selectedSubDiseaseId: number | null = null;
  submitAttempted = false;

  /** Assess id from route (null = new mode) */
  assessmentId: number | null = null;
  /** patient id from query param (new mode) */
  patientId: number | null = null;

  /** Controls visibility of the follow-up scheduling dialog */
  showFollowupDialog = false;

  // ─── Computed ──────────────────────────────────────────────────────────────

  isNewMode = computed(() => this.assessmentId === null);
  isLockedMode = computed(() => this.assessment()?.status === 'locked');

  canSubmit(): boolean {
    return (
      this.consentGiven &&
      !!this.selectedDiseaseId &&
      !!this.activeTemplate()
    );
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildPatientForm();
    this.loadDiseases();

    const idParam = this.route.snapshot.paramMap.get('id');
    const patientIdParam = this.route.snapshot.queryParamMap.get('patientId');

    if (idParam) {
      this.assessmentId = +idParam;
      this.patientMode = 'existing';
      this.loadExistingAssessment(this.assessmentId);
    } else if (patientIdParam) {
      this.patientId = +patientIdParam;
      this.patientMode = 'existing';
      this.loadPatientForNew(this.patientId);
    } else {
      this.patientMode = 'new';
      this.loading.set(false);
    }
    // Pre-load patient list so "Existing Patient" mode is ready immediately
    this.loadAllPatients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  // ─── Form helpers ──────────────────────────────────────────────────────────

  private buildPatientForm(data?: {
    first_name?: string; last_name?: string; patient_uid?: string;
    date_of_birth?: string; gender?: string; contact_number?: string; email?: string | null;
  }): void {
    if (this.patientForm && data) {
      // Patch existing form — preserves the binding in the template
      this.patientForm.patchValue({
        first_name:     data.first_name ?? '',
        last_name:      data.last_name ?? '',
        patient_uid:    data.patient_uid ?? '',
        date_of_birth:  data.date_of_birth ?? '',
        gender:         data.gender ?? '',
        contact_number: data.contact_number ?? '',
        email:          data.email ?? '',
      });
    } else {
      this.patientForm = this.fb.group({
        first_name:      [data?.first_name ?? '',         Validators.required],
        last_name:       [data?.last_name ?? '',          Validators.required],
        patient_uid:     [{ value: data?.patient_uid ?? '', disabled: true }],
        date_of_birth:   [data?.date_of_birth ?? '',      Validators.required],
        gender:          [data?.gender ?? '',             Validators.required],
        contact_number:  [data?.contact_number ?? '',     Validators.required],
        email:           [data?.email ?? ''],
      });
    }
  }

  // ─── Data loading ──────────────────────────────────────────────────────────

  private loadDiseases(): void {
    this.http
      .get<{ items: Disease[] }>(`${API_DISEASES}/?page=1&page_size=100`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.diseases.set(res.items ?? []),
        error: () => this.diseaseLoadError.set(true),
      });
  }

  private loadPatientForNew(patientId: number): void {
    this.loading.set(true);
    // GET /api/v1/patients/{id} returns the patient flat (not nested)
    this.http.get<any>(`${environment.apiBaseUrl}/api/v1/patients/${patientId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p: any) => {
          const pat = p?.patient ?? p;
          this.buildPatientForm({
            first_name: pat.first_name, last_name: pat.last_name,
            patient_uid: pat.patient_uid, date_of_birth: pat.date_of_birth,
            gender: pat.gender, contact_number: pat.contact_number, email: pat.email,
          });
          this.patientId = patientId;
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load patient data.' });
        },
      });
  }

  private loadExistingAssessment(id: number): void {
    this.loading.set(true);
    this.assessmentService.getAssessment(id)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (detail) => {
          this.assessment.set(detail);
          this.assessmentService.activeAssessment.set(detail);
          this.patientId = detail.patient_id;

          // Populate patient demographics form
          const p = detail.patient;
          this.buildPatientForm({
            first_name: p.first_name, last_name: p.last_name,
            patient_uid: p.patient_uid, date_of_birth: p.date_of_birth,
            gender: p.gender, contact_number: p.contact_number, email: p.email,
          });

          // Consent
          this.consentGiven = detail.consent_given;

          // Disease / sub-disease
          this.selectedDiseaseId = detail.disease_id;
          this.selectedSubDiseaseId = detail.sub_disease_id;

          // Load sub-diseases for the selected disease
          this.loadSubDiseases(detail.disease_id);

          // Use template_snapshot (frozen schema) for edit/view
          this.activeTemplate.set({
            id: detail.template_id,
            disease_id: detail.disease_id,
            version: 1,
            is_active: true,
            schema: detail.template_snapshot,
            created_at: '',
            updated_at: '',
          });

          // Pre-populate form data
          this.initialFormData.set(detail.form_data ?? {});

          // Pre-populate prescription rows
          this.initialPrescriptionRows.set(detail.prescriptions ?? []);

          // Start lock countdown for submitted records
          if (detail.status === 'submitted' && detail.lock_expires_at) {
            this.startLockCountdown(detail.lock_expires_at);
          }
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load assessment.' });
        },
      });
  }

  // ─── Disease / Sub-disease ─────────────────────────────────────────────────

  onDiseaseChange(diseaseId: number | null): void {
    this.selectedDiseaseId = diseaseId;
    this.selectedSubDiseaseId = null;
    this.subDiseases.set([]);
    this.activeTemplate.set(null);
    this.templateLoadError.set(false);

    if (!diseaseId) return;

    this.loadSubDiseases(diseaseId);
    this.loadActiveTemplate(diseaseId);
  }

  private loadSubDiseases(diseaseId: number): void {
    this.http
      .get<SubDisease[]>(`${API_DISEASES}/${diseaseId}/sub-diseases`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (subs) => this.subDiseases.set(subs ?? []),
        error: () => this.subDiseases.set([]),
      });
  }

  private loadActiveTemplate(diseaseId: number): void {
    this.templateLoading.set(true);
    this.templateLoadError.set(false);
    this.templateService.getActiveTemplateForDisease(diseaseId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          // 404 means no active template — show info message, not error
          if (err?.status === 404) {
            this.templateLoadError.set(false);
          } else {
            this.templateLoadError.set(true);
          }
          return of(null);
        }),
        finalize(() => this.templateLoading.set(false)),
      )
      .subscribe((template) => {
        this.activeTemplate.set(template);
      });
  }

  // ─── Consent ───────────────────────────────────────────────────────────────

  onConsentChange(checked: boolean | null): void {
    this.consentGiven = checked === true;
  }

  // ─── Patient mode (Fix 2) ──────────────────────────────────────────────────

  setPatientMode(mode: 'new' | 'existing'): void {
    this.patientMode = mode;
    this.patientId = null;
    this.selectedExistingPatientId = null;
    this.buildPatientForm(); // reset form
    // Load full patient list on first switch to existing mode
    if (mode === 'existing' && !this.allPatientsLoaded) {
      this.loadAllPatients();
    }
  }

  private loadAllPatients(): void {
    this.patientService.getPatients({ page: 1, page_size: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.allPatientsLoaded = true;
          const mapped = (res.items ?? []).map(p => ({
            ...p,
            displayLabel: `${p.first_name} ${p.last_name} — ${p.patient_uid}`,
          }));
          this.patientSearchResults.set(mapped);
        },
        error: (err: any) => console.error('[API Error]', err),
      });
  }

  onPatientSearch(_term: string): void {
    // No-op: filtering is done client-side by p-dropdown [filter]="true"
  }

  onExistingPatientSelect(patientId: number | null): void {
    if (!patientId) {
      this.patientId = null;
      this.buildPatientForm();
      return;
    }
    // GET /api/v1/patients/{id} returns the patient object directly (flat),
    // not nested — the PatientDetail type wraps it but the API response is flat
    this.http.get<any>(`${environment.apiBaseUrl}/api/v1/patients/${patientId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p: any) => {
          // Handle both flat response and nested { patient: ... } shape
          const pat = p?.patient ?? p;
          this.patientId = pat.id;
          this.buildPatientForm({
            first_name: pat.first_name,
            last_name: pat.last_name,
            patient_uid: pat.patient_uid,
            date_of_birth: pat.date_of_birth,
            gender: pat.gender,
            contact_number: pat.contact_number,
            email: pat.email,
          });
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load patient details.' });
        },
      });
  }

  // ─── Save draft ────────────────────────────────────────────────────────────

  saveDraft(): void {
    if (this.savingDraft() || this.submitting()) return;

    const formData = this.dynamicFormRef?.getFormData() ?? {};
    const prescriptionRows = this.prescriptionGridRef?.getRows() ?? [];
    const doctorId = this.authService.currentUser()?.id;

    if (!doctorId) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Not authenticated.' });
      return;
    }

    this.savingDraft.set(true);

    if (this.assessmentId) {
      // Update existing draft
      this.assessmentService.saveDraft(this.assessmentId, {
        disease_id: this.selectedDiseaseId ?? undefined,
        sub_disease_id: this.selectedSubDiseaseId,
        template_id: this.activeTemplate()?.id,
        form_data: formData,
        consent_given: this.consentGiven,
      }).pipe(
        takeUntil(this.destroy$),
        switchMap((saved) => {
          this.assessment.set({ ...this.assessment()!, ...saved });
          return this.assessmentService.upsertPrescriptions(this.assessmentId!, prescriptionRows);
        }),
        finalize(() => this.savingDraft.set(false)),
      ).subscribe({
        next: () => this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Draft saved.' }),
        error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save draft.' }),
      });
    } else {
      // Create new draft — if patientMode === 'new', first register the patient
      if (!this.selectedDiseaseId || !this.activeTemplate()) {
        this.messageService.add({ severity: 'warn', summary: 'Incomplete', detail: 'Please select a disease with an active template before saving.' });
        this.savingDraft.set(false);
        return;
      }

      if (this.patientMode === 'existing' && !this.patientId) {
        this.messageService.add({ severity: 'warn', summary: 'Incomplete', detail: 'Please select an existing patient.' });
        this.savingDraft.set(false);
        return;
      }

      if (this.patientMode === 'new') {
        if (!this.patientForm?.valid) {
          this.messageService.add({ severity: 'warn', summary: 'Incomplete', detail: 'Please fill in all required patient fields.' });
          this.savingDraft.set(false);
          return;
        }
      }

      const createDraftWithPatient = (pid: number) =>
        this.assessmentService.createDraft({
          patient_id: pid,
          doctor_id: doctorId,
          disease_id: this.selectedDiseaseId!,
          sub_disease_id: this.selectedSubDiseaseId,
          template_id: this.activeTemplate()!.id,
          form_data: formData,
          consent_given: this.consentGiven,
        }).pipe(
          switchMap((created) => {
            this.assessmentId = created.id;
            this.assessment.set({ ...created } as AssessmentDetail);
            return this.assessmentService.upsertPrescriptions(created.id, prescriptionRows);
          }),
        );

      if (this.patientMode === 'new') {
        const raw = this.patientForm.getRawValue();
        const dto: RegisterPatientDto = {
          first_name: raw['first_name'],
          last_name: raw['last_name'],
          date_of_birth: raw['date_of_birth'],
          gender: raw['gender'],
          contact_number: raw['contact_number'],
          email: raw['email'] || null,
        };
        this.patientService.registerPatient(dto).pipe(
          takeUntil(this.destroy$),
          switchMap((patient) => {
            this.patientId = patient.id;
            this.patientMode = 'existing';
            this.buildPatientForm({
              first_name: patient.first_name, last_name: patient.last_name,
              patient_uid: patient.patient_uid, date_of_birth: patient.date_of_birth,
              gender: patient.gender, contact_number: patient.contact_number, email: patient.email,
            });
            return createDraftWithPatient(patient.id);
          }),
          finalize(() => this.savingDraft.set(false)),
        ).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Patient registered and draft created.' });
            this.router.navigate(['/doctor/assessments', this.assessmentId], { replaceUrl: true });
          },
          error: (err) => {
            const detail = err?.error?.detail ?? 'Failed to create patient or draft.';
            this.messageService.add({ severity: 'error', summary: 'Error', detail });
          },
        });
      } else {
        createDraftWithPatient(this.patientId!).pipe(
          takeUntil(this.destroy$),
          finalize(() => this.savingDraft.set(false)),
        ).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Draft created.' });
            this.router.navigate(['/doctor/assessments', this.assessmentId], { replaceUrl: true });
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create draft.' }),
        });
      }
    }
  }

  // ─── Submit assessment ─────────────────────────────────────────────────────

  submitAssessment(): void {
    this.submitAttempted = true;

    // Validate all guards
    const prescriptionValid = this.prescriptionGridRef?.isValid() ?? false;
    this.prescriptionGridRef?.markAllTouched();

    const dynamicFormValid = this.dynamicFormRef?.isValid() ?? true;
    // Mark dynamic form touched
    if (this.dynamicFormRef?.form) {
      this.dynamicFormRef.form.markAllAsTouched();
    }

    if (!this.consentGiven) {
      this.messageService.add({ severity: 'warn', summary: 'Consent Required', detail: 'Please confirm patient consent.' });
      return;
    }

    if (!this.selectedDiseaseId) {
      this.messageService.add({ severity: 'warn', summary: 'Disease Required', detail: 'Please select a disease.' });
      return;
    }

    if (!this.activeTemplate()) {
      this.messageService.add({ severity: 'warn', summary: 'No Template', detail: 'No active template available for this disease.' });
      return;
    }

    if (!dynamicFormValid) {
      this.messageService.add({ severity: 'warn', summary: 'Form Incomplete', detail: 'Please fill in all required fields.' });
      return;
    }

    if (!prescriptionValid) {
      this.messageService.add({ severity: 'warn', summary: 'Prescription Required', detail: 'At least one prescription is required.' });
      return;
    }

    const doctorId = this.authService.currentUser()?.id;
    if (!doctorId) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Not authenticated.' });
      return;
    }

    this.submitting.set(true);

    const formData = this.dynamicFormRef?.getFormData() ?? {};
    const prescriptionRows = this.prescriptionGridRef?.getRows() ?? [];

    const doSubmit = (assessmentId: number) =>
      this.assessmentService.saveDraft(assessmentId, {
        disease_id: this.selectedDiseaseId!,
        sub_disease_id: this.selectedSubDiseaseId,
        template_id: this.activeTemplate()!.id,
        form_data: formData,
        consent_given: this.consentGiven,
      }).pipe(
        switchMap(() => this.assessmentService.upsertPrescriptions(assessmentId, prescriptionRows)),
        switchMap(() => this.assessmentService.submitAssessment(assessmentId)),
      );

    if (this.assessmentId) {
      doSubmit(this.assessmentId)
        .pipe(takeUntil(this.destroy$), finalize(() => this.submitting.set(false)))
        .subscribe({
          next: (submitted) => {
            this.assessment.set({ ...this.assessment()!, ...submitted } as AssessmentDetail);
            this.messageService.add({ severity: 'success', summary: 'Submitted', detail: 'Assessment submitted successfully.' });
            if (submitted.lock_expires_at) {
              this.startLockCountdown(submitted.lock_expires_at);
            }
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to submit assessment.' }),
        });
    } else {
      if (this.patientMode === 'existing' && !this.patientId) {
        this.submitting.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No patient selected.' });
        return;
      }

      const createAndSubmit = (pid: number) =>
        this.assessmentService.createDraft({
          patient_id: pid,
          doctor_id: doctorId,
          disease_id: this.selectedDiseaseId!,
          sub_disease_id: this.selectedSubDiseaseId,
          template_id: this.activeTemplate()!.id,
          form_data: formData,
          consent_given: this.consentGiven,
        }).pipe(
          switchMap((created) => {
            this.assessmentId = created.id;
            return doSubmit(created.id);
          }),
        );

      if (this.patientMode === 'new') {
        if (!this.patientForm?.valid) {
          this.submitting.set(false);
          this.messageService.add({ severity: 'warn', summary: 'Incomplete', detail: 'Please fill in all required patient fields.' });
          return;
        }
        const raw = this.patientForm.getRawValue();
        const dto: RegisterPatientDto = {
          first_name: raw['first_name'],
          last_name: raw['last_name'],
          date_of_birth: raw['date_of_birth'],
          gender: raw['gender'],
          contact_number: raw['contact_number'],
          email: raw['email'] || null,
        };
        this.patientService.registerPatient(dto).pipe(
          takeUntil(this.destroy$),
          switchMap((patient) => {
            this.patientId = patient.id;
            this.patientMode = 'existing';
            this.buildPatientForm({
              first_name: patient.first_name, last_name: patient.last_name,
              patient_uid: patient.patient_uid, date_of_birth: patient.date_of_birth,
              gender: patient.gender, contact_number: patient.contact_number, email: patient.email,
            });
            return createAndSubmit(patient.id);
          }),
          finalize(() => this.submitting.set(false)),
        ).subscribe({
          next: (submitted) => {
            this.assessment.set({ ...submitted } as AssessmentDetail);
            this.messageService.add({ severity: 'success', summary: 'Submitted', detail: 'Assessment submitted successfully.' });
            this.router.navigate(['/doctor/assessments', this.assessmentId], { replaceUrl: true });
            if (submitted.lock_expires_at) {
              this.startLockCountdown(submitted.lock_expires_at);
            }
          },
          error: (err) => {
            const detail = err?.error?.detail ?? 'Failed to submit assessment.';
            this.messageService.add({ severity: 'error', summary: 'Error', detail });
          },
        });
      } else {
        createAndSubmit(this.patientId!).pipe(
          takeUntil(this.destroy$),
          finalize(() => this.submitting.set(false)),
        ).subscribe({
          next: (submitted) => {
            this.assessment.set({ ...submitted } as AssessmentDetail);
            this.messageService.add({ severity: 'success', summary: 'Submitted', detail: 'Assessment submitted successfully.' });
            this.router.navigate(['/doctor/assessments', this.assessmentId], { replaceUrl: true });
            if (submitted.lock_expires_at) {
              this.startLockCountdown(submitted.lock_expires_at);
            }
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to submit assessment.' }),
        });
      }
    }
  }

  // ─── Export PDF ────────────────────────────────────────────────────────────

  exportPdf(): void {
    if (!this.assessmentId) {
      this.messageService.add({ severity: 'warn', summary: 'Not Available', detail: 'Please save the assessment first.' });
      return;
    }
    this.exportService.exportAssessmentPdf(this.assessmentId).catch(() => {
      this.messageService.add({ severity: 'error', summary: 'Export Failed', detail: 'Failed to export assessment as PDF.' });
    });
  }

  // ─── Lock countdown ────────────────────────────────────────────────────────

  private startLockCountdown(lockExpiresAt: string): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    const tick = () => {
      const now = Date.now();
      const expires = new Date(lockExpiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        clearInterval(this.countdownInterval);
        this.lockCountdown.set(null);
        // Reload to show locked state
        if (this.assessmentId) {
          this.loadExistingAssessment(this.assessmentId);
        }
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      this.lockCountdown.set(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  // ─── Follow-up scheduling ────────────────────────────────────────────────

  onFollowupCreated(_followup: Followup): void {
    this.showFollowupDialog = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Follow-up Scheduled',
      detail: 'Follow-up visit has been scheduled successfully.',
      life: 5000,
    });
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    if (this.patientId) {
      this.router.navigate(['/doctor/patients', this.patientId]);
    } else {
      this.router.navigate(['/doctor/dashboard']);
    }
  }
}
