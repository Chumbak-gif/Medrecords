import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormsModule,
  FormArray,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { environment } from '../../../../environments/environment';

/**
 * MedicineOption — represents a medicine from the API for the searchable dropdown.
 */
export interface MedicineOption {
  id: number;
  name: string;
}

/**
 * PrescriptionRow — data model for a single prescription row.
 */
export interface PrescriptionRow {
  medicine_id: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const API = environment.apiBaseUrl;

@Component({
  selector: 'app-prescription-grid',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    InputTextModule,
    InputTextareaModule,
    ButtonModule,
    TooltipModule,
    AutoCompleteModule,
  ],
  template: `
    <div class="prescription-grid">
      <!-- Section header -->
      <div class="grid-header">
        <h3 class="grid-title">
          <i class="pi pi-file-edit" style="color: var(--color-primary); margin-right: 6px;"></i>
          Prescription
        </h3>
        @if (!isReadonly) {
          <button type="button" class="btn-secondary btn-sm" (click)="addRow()">
            <i class="pi pi-plus"></i> Add Medicine
          </button>
        }
      </div>

      <!-- Empty state -->
      @if (rows.length === 0) {
        <div class="empty-state">
          @if (isReadonly) {
            <span class="text-muted text-sm">No prescriptions recorded.</span>
          } @else {
            <span class="text-muted text-sm">
              No medicines added yet. Click <strong>Add Medicine</strong> to start.
            </span>
          }
        </div>
      }

      <!-- Prescription rows -->
      @if (rows.length > 0) {
        <div class="grid-table-wrapper">
          <table class="grid-table" role="table">
            <thead>
              <tr>
                <th scope="col" class="col-medicine">Medicine <span class="required-marker">*</span></th>
                <th scope="col" class="col-dosage">Dosage <span class="required-marker">*</span></th>
                <th scope="col" class="col-frequency">Frequency <span class="required-marker">*</span></th>
                <th scope="col" class="col-duration">Duration <span class="required-marker">*</span></th>
                <th scope="col" class="col-instructions">Instructions</th>
                @if (!isReadonly) {
                  <th scope="col" class="col-action" aria-label="Actions"></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row; let i = $index) {
                <tr [formGroup]="rows[i]" class="grid-row">

                  <!-- Medicine — searchable autocomplete calling medicines API -->
                  <td class="col-medicine">
                    @if (isReadonly) {
                      <span class="readonly-text">{{ row.get('medicine_name')?.value || '—' }}</span>
                    } @else {
                      <p-autoComplete
                        [suggestions]="medicineSuggestions[i] || []"
                        (completeMethod)="searchMedicines($event, i)"
                        (onSelect)="onMedicineSelect($event, i)"
                        (onClear)="onMedicineClear(i)"
                        field="name"
                        [forceSelection]="true"
                        [dropdown]="true"
                        placeholder="Search medicine..."
                        [style]="{ width: '100%' }"
                        [inputStyle]="{ width: '100%' }"
                        [ngModel]="getMedicineValue(i)"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="onMedicineModelChange($event, i)"
                        appendTo="body"
                        [minLength]="1">
                        <ng-template let-medicine pTemplate="item">
                          <div class="medicine-option">
                            <span class="medicine-option-name">{{ medicine.name }}</span>
                          </div>
                        </ng-template>
                      </p-autoComplete>
                      @if (row.get('medicine_name')?.invalid && (row.get('medicine_name')?.dirty || row.get('medicine_name')?.touched)) {
                        <span class="error-msg">Medicine is required.</span>
                      }
                    }
                  </td>

                  <!-- Dosage -->
                  <td class="col-dosage">
                    @if (isReadonly) {
                      <span class="readonly-text">{{ row.get('dosage')?.value || '—' }}</span>
                    } @else {
                      <input pInputText formControlName="dosage" placeholder="e.g. 500mg" style="width: 100%" />
                      @if (row.get('dosage')?.invalid && (row.get('dosage')?.dirty || row.get('dosage')?.touched)) {
                        <span class="error-msg">Dosage is required.</span>
                      }
                    }
                  </td>

                  <!-- Frequency -->
                  <td class="col-frequency">
                    @if (isReadonly) {
                      <span class="readonly-text">{{ row.get('frequency')?.value || '—' }}</span>
                    } @else {
                      <input pInputText formControlName="frequency" placeholder="e.g. Twice daily" style="width: 100%" />
                      @if (row.get('frequency')?.invalid && (row.get('frequency')?.dirty || row.get('frequency')?.touched)) {
                        <span class="error-msg">Frequency is required.</span>
                      }
                    }
                  </td>

                  <!-- Duration -->
                  <td class="col-duration">
                    @if (isReadonly) {
                      <span class="readonly-text">{{ row.get('duration')?.value || '—' }}</span>
                    } @else {
                      <input pInputText formControlName="duration" placeholder="e.g. 7 days" style="width: 100%" />
                      @if (row.get('duration')?.invalid && (row.get('duration')?.dirty || row.get('duration')?.touched)) {
                        <span class="error-msg">Duration is required.</span>
                      }
                    }
                  </td>

                  <!-- Instructions -->
                  <td class="col-instructions">
                    @if (isReadonly) {
                      <span class="readonly-text">{{ row.get('instructions')?.value || '—' }}</span>
                    } @else {
                      <textarea pTextarea formControlName="instructions" placeholder="Optional instructions..." rows="1" style="width: 100%; resize: vertical;"></textarea>
                    }
                  </td>

                  <!-- Remove button -->
                  @if (!isReadonly) {
                    <td class="col-action">
                      <button type="button" pButton icon="pi pi-trash" class="p-button-sm p-button-text p-button-danger"
                        pTooltip="Remove row" tooltipPosition="top" (click)="removeRow(i)"></button>
                    </td>
                  }

                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (showAtLeastOneError) {
        <div class="grid-error-banner" role="alert">
          <i class="pi pi-exclamation-triangle"></i>
          At least one prescription with a medicine is required before submitting.
        </div>
      }
    </div>
  `,
  styles: [`
    .prescription-grid { display: flex; flex-direction: column; gap: 12px; }
    .grid-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .grid-title { font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin: 0; display: flex; align-items: center; }
    .empty-state { padding: 20px; text-align: center; background: var(--color-neutral-50, #f9fafb); border-radius: 8px; border: 1px dashed var(--color-neutral-300, #d1d5db); }
    .grid-table-wrapper { overflow-x: auto; border-radius: 8px; border: 1px solid var(--color-neutral-200, #e5e7eb); }
    .grid-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .grid-table thead tr { background: var(--color-neutral-50, #f9fafb); }
    .grid-table th { padding: 10px 12px; text-align: left; font-weight: 600; color: var(--color-neutral-600, #4b5563); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--color-neutral-200, #e5e7eb); white-space: nowrap; }
    .grid-table td { padding: 8px 12px; vertical-align: top; border-bottom: 1px solid var(--color-neutral-100, #f3f4f6); }
    .grid-row:last-child td { border-bottom: none; }
    .grid-row:hover { background: var(--color-neutral-50, #f9fafb); }
    .col-medicine { min-width: 220px; width: 25%; }
    .col-dosage { min-width: 120px; width: 15%; }
    .col-frequency { min-width: 140px; width: 18%; }
    .col-duration { min-width: 120px; width: 15%; }
    .col-instructions { min-width: 180px; }
    .col-action { width: 50px; text-align: center; white-space: nowrap; }
    .required-marker { color: var(--color-error, #dc2626); margin-left: 2px; }
    .readonly-text { color: var(--color-neutral-800, #1f2937); font-size: 13px; display: block; padding: 4px 0; word-break: break-word; }
    .error-msg { font-size: 11px; color: var(--color-error, #dc2626); display: block; margin-top: 2px; }
    .grid-error-banner { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; font-size: 13px; }
    .medicine-option { display: flex; align-items: center; padding: 4px 0; }
    .medicine-option-name { font-weight: 500; color: var(--color-neutral-800, #1f2937); }
    :host ::ng-deep .p-autocomplete { width: 100%; display: block; }
    :host ::ng-deep .p-autocomplete-input { width: 100% !important; }
    :host ::ng-deep .p-autocomplete-panel { z-index: 10000 !important; }
  `],
})
export class PrescriptionGridComponent implements OnInit, OnChanges {
  @Input() isReadonly: boolean = false;
  @Input() initialRows: PrescriptionRow[] = [];

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  prescriptionArray!: FormArray;
  showAtLeastOneError = false;

  /** Per-row medicine suggestions from API */
  medicineSuggestions: MedicineOption[][] = [];

  /** Per-row selected medicine object (for autocomplete binding) */
  private medicineValues: (MedicineOption | string | null)[] = [];

  get rows(): FormGroup[] {
    return (this.prescriptionArray?.controls ?? []) as FormGroup[];
  }

  ngOnInit(): void {
    this.prescriptionArray = this.fb.array([]);
    if (this.initialRows?.length > 0) {
      for (const row of this.initialRows) { this.addRow(row); }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isReadonly'] && !changes['isReadonly'].firstChange && this.prescriptionArray) {
      this.isReadonly ? this.prescriptionArray.disable() : this.prescriptionArray.enable();
    }
    if (changes['initialRows'] && !changes['initialRows'].firstChange && this.prescriptionArray) {
      while (this.prescriptionArray.length > 0) { this.prescriptionArray.removeAt(0); }
      this.medicineSuggestions = [];
      this.medicineValues = [];
      if (this.initialRows?.length > 0) {
        for (const row of this.initialRows) { this.addRow(row); }
      }
    }
  }

  addRow(data?: PrescriptionRow): void {
    const group = this.fb.group({
      medicine_id:   [data?.medicine_id ?? 0],
      medicine_name: [data?.medicine_name ?? '', Validators.required],
      dosage:        [data?.dosage ?? '',        Validators.required],
      frequency:     [data?.frequency ?? '',     Validators.required],
      duration:      [data?.duration ?? '',      Validators.required],
      instructions:  [data?.instructions ?? ''],
    });
    if (this.isReadonly) { group.disable(); }
    this.prescriptionArray.push(group);

    // Initialize medicine suggestions and value for this row
    this.medicineSuggestions.push([]);
    if (data?.medicine_id && data?.medicine_name) {
      this.medicineValues.push({ id: data.medicine_id, name: data.medicine_name });
    } else if (data?.medicine_name) {
      this.medicineValues.push({ id: 0, name: data.medicine_name });
    } else {
      this.medicineValues.push(null);
    }
  }

  removeRow(index: number): void {
    this.prescriptionArray.removeAt(index);
    this.medicineSuggestions.splice(index, 1);
    this.medicineValues.splice(index, 1);
    if (this.showAtLeastOneError) { this.showAtLeastOneError = !this.isValid(); }
  }

  /**
   * Search medicines from the API for a given row's autocomplete.
   */
  searchMedicines(event: { query: string }, rowIndex: number): void {
    const query = event.query?.trim();
    if (!query) {
      this.medicineSuggestions[rowIndex] = [];
      return;
    }

    const params = new HttpParams()
      .set('search', query)
      .set('page', '1')
      .set('page_size', '20');

    this.http.get<{ items: any[]; total: number }>(`${API}/api/v1/medicines`, { params })
      .subscribe({
        next: (res) => {
          this.medicineSuggestions[rowIndex] = res.items.map(m => ({
            id: m.id,
            name: m.name,
          }));
        },
        error: () => {
          this.medicineSuggestions[rowIndex] = [];
        }
      });
  }

  /**
   * When a medicine is selected from the autocomplete suggestions.
   */
  onMedicineSelect(event: any, rowIndex: number): void {
    const medicine: MedicineOption = event;
    const row = this.rows[rowIndex];
    if (row) {
      row.patchValue({
        medicine_id: medicine.id,
        medicine_name: medicine.name,
      });
      row.get('medicine_name')?.markAsDirty();
    }
    this.medicineValues[rowIndex] = medicine;
  }

  /**
   * When the autocomplete is cleared.
   */
  onMedicineClear(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (row) {
      row.patchValue({ medicine_id: 0, medicine_name: '' });
      row.get('medicine_name')?.markAsDirty();
    }
    this.medicineValues[rowIndex] = null;
  }

  /**
   * Get the current medicine value for the autocomplete binding of a row.
   */
  getMedicineValue(rowIndex: number): MedicineOption | string | null {
    return this.medicineValues[rowIndex] ?? null;
  }

  /**
   * Handle ngModel change from autocomplete (covers typing without selection).
   */
  onMedicineModelChange(value: any, rowIndex: number): void {
    this.medicineValues[rowIndex] = value;
    if (value === null || value === '') {
      this.onMedicineClear(rowIndex);
    } else if (typeof value === 'object' && value.id) {
      // Already handled by onMedicineSelect
    } else if (typeof value === 'string') {
      // User is typing but hasn't selected — clear medicine_id
      const row = this.rows[rowIndex];
      if (row) {
        row.patchValue({ medicine_id: 0, medicine_name: '' });
      }
    }
  }

  /**
   * Get all prescription rows as data objects.
   */
  getRows(): PrescriptionRow[] {
    return this.rows.map(row => {
      const raw = row.getRawValue();
      return {
        medicine_id:   raw['medicine_id'] ?? 0,
        medicine_name: raw['medicine_name'] ?? '',
        dosage:        raw['dosage'] ?? '',
        frequency:     raw['frequency'] ?? '',
        duration:      raw['duration'] ?? '',
        instructions:  raw['instructions'] ?? '',
      };
    });
  }

  /**
   * Validates that at least one row has a valid medicine selected.
   */
  isValid(): boolean {
    if (!this.prescriptionArray || this.prescriptionArray.length === 0) return false;
    return this.rows.some(row => {
      const name = row.getRawValue()['medicine_name'];
      return name && name.trim().length > 0;
    });
  }

  /**
   * Mark all form controls as touched to trigger validation display.
   */
  markAllTouched(): void {
    this.prescriptionArray.controls.forEach(ctrl => ctrl.markAllAsTouched());
    this.showAtLeastOneError = !this.isValid();
  }
}
