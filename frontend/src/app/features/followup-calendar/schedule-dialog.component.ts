import { Component, Input, Output, EventEmitter, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil, debounceTime, switchMap, of } from 'rxjs';
import { FollowupService, Followup } from '../../core/services/followup.service';
import { environment } from '../../../environments/environment';

interface PatientOption {
  id: number;
  name: string;
  patient_uid: string;
}

interface DiseaseOption {
  id: number;
  name: string;
}

const API = environment.apiBaseUrl;

@Component({
  selector: 'app-schedule-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DialogModule, ButtonModule,
    CalendarModule, DropdownModule, InputTextareaModule,
    AutoCompleteModule, ToastModule
  ],
  providers: [MessageService],
  template: `
    <p-dialog
      header="Schedule Follow-up"
      [visible]="visible"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '520px' }"
      [dismissableMask]="true"
      [draggable]="false">

      <div class="schedule-form">
        <!-- Date -->
        <div class="form-field">
          <label class="field-label">Date <span class="required">*</span></label>
          <p-calendar
            [(ngModel)]="formDate"
            [minDate]="minDate"
            dateFormat="dd M yy"
            [showIcon]="true"
            [style]="{ width: '100%' }"
            placeholder="Select date">
          </p-calendar>
        </div>

        <!-- Time Slot -->
        <div class="form-field">
          <label class="field-label">Time Slot</label>
          <p-dropdown
            [(ngModel)]="formTimeSlot"
            [options]="timeSlots"
            optionLabel="label"
            optionValue="value"
            placeholder="Select time slot"
            [style]="{ width: '100%' }">
          </p-dropdown>
        </div>

        <!-- Patient Search -->
        <div class="form-field">
          <label class="field-label">Patient <span class="required">*</span></label>
          <p-autoComplete
            [(ngModel)]="selectedPatient"
            [suggestions]="patientSuggestions()"
            (completeMethod)="searchPatients($event)"
            field="name"
            [dropdown]="true"
            placeholder="Search patient by name or UID..."
            [style]="{ width: '100%' }"
            [inputStyle]="{ width: '100%' }"
            [forceSelection]="true"
            appendTo="body">
            <ng-template let-patient pTemplate="item">
              <div class="patient-option">
                <span class="patient-option-name">{{ patient.name }}</span>
                <span class="patient-option-uid">{{ patient.patient_uid }}</span>
              </div>
            </ng-template>
          </p-autoComplete>
        </div>

        <!-- Disease -->
        <div class="form-field">
          <label class="field-label">Disease</label>
          <p-dropdown
            [(ngModel)]="selectedDisease"
            [options]="diseaseOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Select disease (optional)"
            [filter]="true"
            filterBy="name"
            [showClear]="true"
            [style]="{ width: '100%' }"
            appendTo="body">
          </p-dropdown>
        </div>

        <!-- Notes -->
        <div class="form-field">
          <label class="field-label">Notes</label>
          <textarea pInputTextarea
            [(ngModel)]="formNotes"
            rows="3"
            [maxlength]="500"
            placeholder="Add notes for this follow-up..."
            [style]="{ width: '100%', resize: 'vertical' }">
          </textarea>
          <span class="char-count">{{ formNotes.length }}/500</span>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <button pButton
            label="Cancel"
            class="p-button-text p-button-sm"
            (click)="onVisibleChange(false)">
          </button>
          <button pButton
            label="Schedule Follow-up"
            icon="pi pi-calendar-plus"
            class="p-button-sm"
            [loading]="saving()"
            [disabled]="!isFormValid()"
            (click)="onSubmit()">
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .schedule-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 4px 0;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-neutral-700);
    }

    .required {
      color: #ef4444;
    }

    .char-count {
      font-size: 11px;
      color: #9ca3af;
      text-align: right;
    }

    .patient-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .patient-option-name {
      font-weight: 500;
      color: var(--color-neutral-800);
    }

    .patient-option-uid {
      font-size: 11px;
      background: #e2e8f0;
      color: #475569;
      padding: 1px 6px;
      border-radius: 8px;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    :host ::ng-deep .p-autocomplete {
      width: 100%;
      display: block;
    }

    :host ::ng-deep .p-autocomplete-input {
      width: 100% !important;
    }

    :host ::ng-deep .p-autocomplete-panel {
      z-index: 10000 !important;
    }

    :host ::ng-deep .p-dropdown {
      width: 100%;
    }

    :host ::ng-deep .p-dialog-content {
      overflow: visible !important;
    }
  `]
})
export class ScheduleDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() preselectedDate: Date | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() created = new EventEmitter<Followup>();

  private http = inject(HttpClient);
  private followupService = inject(FollowupService);
  private messageService = inject(MessageService);

  // Form fields
  formDate: Date | null = null;
  formTimeSlot: string = '';
  selectedPatient: PatientOption | null = null;
  selectedDisease: number | null = null;
  formNotes = '';

  // Signals
  patientSuggestions = signal<PatientOption[]>([]);
  diseaseOptions = signal<DiseaseOption[]>([]);
  saving = signal(false);

  minDate = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

  timeSlots = [
    { label: '09:00 AM', value: '09:00' },
    { label: '09:30 AM', value: '09:30' },
    { label: '10:00 AM', value: '10:00' },
    { label: '10:30 AM', value: '10:30' },
    { label: '11:00 AM', value: '11:00' },
    { label: '11:30 AM', value: '11:30' },
    { label: '12:00 PM', value: '12:00' },
    { label: '12:30 PM', value: '12:30' },
    { label: '01:00 PM', value: '13:00' },
    { label: '01:30 PM', value: '13:30' },
    { label: '02:00 PM', value: '14:00' },
    { label: '02:30 PM', value: '14:30' },
    { label: '03:00 PM', value: '15:00' },
    { label: '03:30 PM', value: '15:30' },
    { label: '04:00 PM', value: '16:00' },
    { label: '04:30 PM', value: '16:30' },
    { label: '05:00 PM', value: '17:00' },
    { label: '05:30 PM', value: '17:30' },
    { label: '06:00 PM', value: '18:00' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      // When dialog opens, set preselected date and load diseases
      if (this.preselectedDate) {
        this.formDate = new Date(this.preselectedDate);
      }
      this.loadDiseases();
    }
  }

  onVisibleChange(val: boolean): void {
    if (!val) {
      this.resetForm();
    }
    this.visibleChange.emit(val);
  }

  searchPatients(event: { query: string }): void {
    const query = event.query?.trim();
    if (!query || query.length < 2) {
      this.patientSuggestions.set([]);
      return;
    }

    const params = new HttpParams()
      .set('search', query)
      .set('page', '1')
      .set('page_size', '10');

    this.http.get<{ items: any[]; total: number }>(`${API}/api/v1/patients/`, { params })
      .subscribe({
        next: (res) => {
          const options: PatientOption[] = res.items.map(p => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            patient_uid: p.patient_uid
          }));
          this.patientSuggestions.set(options);
        },
        error: () => this.patientSuggestions.set([])
      });
  }

  private loadDiseases(): void {
    const params = new HttpParams()
      .set('page_size', '200')
      .set('include_inactive', 'false');

    this.http.get<{ items: any[]; total: number }>(`${API}/api/v1/diseases`, { params })
      .subscribe({
        next: (res) => {
          this.diseaseOptions.set(res.items.map((d: any) => ({ id: d.id, name: d.name })));
        },
        error: () => this.diseaseOptions.set([])
      });
  }

  isFormValid(): boolean {
    const hasDate = this.formDate != null;
    const hasPatient = this.selectedPatient != null 
      && typeof this.selectedPatient === 'object' 
      && 'id' in this.selectedPatient;
    return hasDate && hasPatient;
  }

  onSubmit(): void {
    if (!this.isFormValid() || !this.formDate || !this.selectedPatient) return;

    this.saving.set(true);

    const patient = this.selectedPatient as PatientOption;
    const year = this.formDate.getFullYear();
    const month = String(this.formDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.formDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Build notes with time slot if selected
    let notes = this.formNotes;
    if (this.formTimeSlot) {
      const slotLabel = this.timeSlots.find(s => s.value === this.formTimeSlot)?.label ?? this.formTimeSlot;
      notes = `[${slotLabel}] ${notes}`.trim();
    }

    const payload: any = {
      patient_id: patient.id,
      scheduled_date: dateStr,
      notes: notes || undefined,
    };

    this.followupService.create(payload).subscribe({
      next: (followup) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Scheduled',
          detail: `Follow-up scheduled for ${patient.name} on ${dateStr}`
        });
        this.created.emit(followup);
        this.onVisibleChange(false);
      },
      error: (err) => {
        this.saving.set(false);
        const detail = err?.error?.detail || 'Failed to schedule follow-up';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
      }
    });
  }

  private resetForm(): void {
    this.formDate = null;
    this.formTimeSlot = '';
    this.selectedPatient = null;
    this.selectedDisease = null;
    this.formNotes = '';
  }
}
