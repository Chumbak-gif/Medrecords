import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';

// Feature
import { PatientService } from './patient.service';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

@Component({
  selector: 'app-register-patient',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    ToastModule,
    MessageModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">Register New Patient</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Fill in the patient's details below
        </p>
      </div>
      <button class="btn-secondary" (click)="cancel()">
        <i class="pi pi-arrow-left"></i> Back
      </button>
    </div>

    <!-- Form Card -->
    <div class="card" style="max-width:680px">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>

        <!-- Row 1: First Name / Last Name -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="form-field-group">
            <label class="label">
              First Name <span style="color:var(--color-error)">*</span>
            </label>
            <input
              pInputText
              type="text"
              formControlName="first_name"
              placeholder="e.g. Ramesh"
              style="width:100%"
            />
            @if (form.get('first_name')?.invalid && form.get('first_name')?.touched) {
              <span style="color:var(--color-error);font-size:12px">First name is required</span>
            }
          </div>

          <div class="form-field-group">
            <label class="label">
              Last Name <span style="color:var(--color-error)">*</span>
            </label>
            <input
              pInputText
              type="text"
              formControlName="last_name"
              placeholder="e.g. Sharma"
              style="width:100%"
            />
            @if (form.get('last_name')?.invalid && form.get('last_name')?.touched) {
              <span style="color:var(--color-error);font-size:12px">Last name is required</span>
            }
          </div>
        </div>

        <!-- Row 2: DOB / Gender -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="form-field-group">
            <label class="label">
              Date of Birth <span style="color:var(--color-error)">*</span>
            </label>
            <p-calendar [inline]="false"
              formControlName="date_of_birth"
              [showIcon]="true"
              dateFormat="dd/mm/yy"
              placeholder="DD/MM/YYYY"
              [maxDate]="today"
              styleClass="w-full"
              [style]="{'width':'100%'}"
            />
            @if (form.get('date_of_birth')?.invalid && form.get('date_of_birth')?.touched) {
              <span style="color:var(--color-error);font-size:12px">Date of birth is required</span>
            }
          </div>

          <div class="form-field-group">
            <label class="label">
              Gender <span style="color:var(--color-error)">*</span>
            </label>
            <p-dropdown
              formControlName="gender"
              [options]="genderOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select gender"
              [style]="{'width':'100%'}"
            />
            @if (form.get('gender')?.invalid && form.get('gender')?.touched) {
              <span style="color:var(--color-error);font-size:12px">Gender is required</span>
            }
          </div>
        </div>

        <!-- Row 3: Contact Number -->
        <div class="form-field-group" style="margin-bottom:16px">
          <label class="label">
            Contact Number <span style="color:var(--color-error)">*</span>
          </label>
          <input
            pInputText
            type="tel"
            formControlName="contact_number"
            placeholder="e.g. 9876543210"
            style="width:100%"
            (blur)="checkDuplicateContact()"
          />
          @if (form.get('contact_number')?.invalid && form.get('contact_number')?.touched) {
            <span style="color:var(--color-error);font-size:12px">Contact number is required</span>
          }
          @if (contactDuplicateWarning()) {
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:12px;color:#92400e;margin-top:4px">
              <i class="pi pi-exclamation-triangle" style="color:#d97706"></i>
              A patient with this contact number already exists. Please verify before registering.
            </div>
          }
          @if (checkingContact()) {
            <span style="font-size:12px;color:var(--color-neutral-500)">
              <i class="pi pi-spin pi-spinner" style="font-size:11px"></i> Checking...
            </span>
          }
        </div>

        <!-- Row 4: Email (optional) -->
        <div class="form-field-group" style="margin-bottom:24px">
          <label class="label">Email <span style="color:var(--color-neutral-400);font-size:12px">(optional)</span></label>
          <input
            pInputText
            type="email"
            formControlName="email"
            placeholder="e.g. ramesh@example.com"
            style="width:100%"
          />
          @if (form.get('email')?.errors?.['email'] && form.get('email')?.touched) {
            <span style="color:var(--color-error);font-size:12px">Enter a valid email address</span>
          }
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button type="button" class="btn-secondary" (click)="cancel()">
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="form.invalid || saving()"
          >
            @if (saving()) {
              <i class="pi pi-spin pi-spinner"></i> Registering...
            } @else {
              <i class="pi pi-user-plus"></i> Register Patient
            }
          </button>
        </div>

      </form>
    </div>
  `,
  styles: [`
    .form-field-group { display:flex; flex-direction:column; gap:6px; }
    :host ::ng-deep .p-datepicker { width: 100%; }
    :host ::ng-deep .p-select { width: 100%; }
  `]
})
export class RegisterPatientComponent implements OnInit {
  private patientService = inject(PatientService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);

  genderOptions = GENDER_OPTIONS;
  today = new Date();

  saving = signal(false);
  checkingContact = signal(false);
  contactDuplicateWarning = signal(false);

  form = this.fb.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    date_of_birth: [null as Date | null, Validators.required],
    gender: ['', Validators.required],
    contact_number: ['', Validators.required],
    email: ['', Validators.email],
  });

  ngOnInit(): void {}

  // ── Duplicate contact check ────────────────────────────────────────────
  checkDuplicateContact(): void {
    const contact = this.form.get('contact_number')?.value?.trim();
    if (!contact) {
      this.contactDuplicateWarning.set(false);
      return;
    }
    this.checkingContact.set(true);
    this.contactDuplicateWarning.set(false);

    this.patientService.searchByContact(contact).subscribe({
      next: (res) => {
        // Warn if any patient has this exact contact number
        const match = res.items.some(p => p.contact_number === contact);
        this.contactDuplicateWarning.set(match);
        this.checkingContact.set(false);
      },
      error: () => {
        this.checkingContact.set(false);
      }
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    // Format date to YYYY-MM-DD
    const dob = raw.date_of_birth as Date;
    const dobStr = `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;

    const payload = {
      first_name: raw.first_name!.trim(),
      last_name: raw.last_name!.trim(),
      date_of_birth: dobStr,
      gender: raw.gender!,
      contact_number: raw.contact_number!.trim(),
      email: raw.email?.trim() || null,
    };

    this.saving.set(true);
    this.patientService.registerPatient(payload).subscribe({
      next: (patient) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Patient Registered',
          detail: `${patient.first_name} ${patient.last_name} registered as ${patient.patient_uid}`
        });
        this.saving.set(false);
        this.router.navigate(['/doctor/patients', patient.id]);
      },
      error: (err) => {
        const detail = err?.error?.detail ?? 'Registration failed. Please try again.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
        this.saving.set(false);
      }
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  cancel(): void {
    this.router.navigate(['/doctor/patients']);
  }
}
