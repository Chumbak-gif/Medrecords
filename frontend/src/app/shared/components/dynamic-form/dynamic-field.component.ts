import { Component, Input, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';

// PrimeNG modules
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextareaModule } from 'primeng/inputtextarea';

import { FormField } from '../../../features/templates/template.service';

/**
 * DynamicFieldComponent — renders a single form field using the appropriate PrimeNG control.
 *
 * Uses @switch on field.type to select the right control:
 *   text          → <input pInputText>
 *   number        → <p-inputNumber>
 *   date          → <p-calendar> (PrimeNG datepicker)
 *   select        → <p-dropdown>
 *   multiselect   → <p-multiSelect>
 *   radio         → p-radioButton group
 *   checkbox_group → p-checkbox group
 *   textarea      → <textarea pTextarea>
 *
 * Displays validation error messages below each field.
 */
@Component({
  selector: 'app-dynamic-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    CalendarModule,
    DropdownModule,
    MultiSelectModule,
    RadioButtonModule,
    CheckboxModule,
    InputTextareaModule,
  ],
  template: `
    @if (field && sectionGroup) {
      <div class="dynamic-field">
        <!-- Label -->
        <label class="dynamic-field-label" [for]="field.field_key">
          {{ field.label }}
          @if (field.required) {
            <span class="required-marker" aria-label="required">*</span>
          }
        </label>

        <!-- Control -->
        <div class="dynamic-field-control">
          @switch (field.type) {

            @case ('text') {
              <input
                pInputText
                [id]="field.field_key"
                [formControl]="getControl()"
                [placeholder]="field.placeholder || ''"
                style="width:100%"
              />
            }

            @case ('number') {
              <p-inputNumber
                [inputId]="field.field_key"
                [formControl]="getControl()"
                [placeholder]="field.placeholder || ''"
                [min]="field.validation?.min"
                [max]="field.validation?.max"
                inputStyleClass="w-full"
                [style]="{'width':'100%'}"
              />
            }

            @case ('date') {
              <p-calendar
                [inputId]="field.field_key"
                [formControl]="getControl()"
                [placeholder]="field.placeholder || 'Select date...'"
                [showIcon]="true"
                [minDate]="minDate"
                dateFormat="yy-mm-dd"
                appendTo="body"
                [style]="{'width':'100%'}"
              />
            }

            @case ('select') {
              <p-dropdown
                [inputId]="field.field_key"
                [formControl]="getControl()"
                [options]="fieldOptions"
                [placeholder]="field.placeholder || 'Select...'"
                [showClear]="!field.required"
                appendTo="body"
                [style]="{'width':'100%'}"
              />
            }

            @case ('multiselect') {
              <p-multiSelect
                [inputId]="field.field_key"
                [formControl]="getControl()"
                [options]="fieldOptions"
                [placeholder]="field.placeholder || 'Select options...'"
                appendTo="body"
                display="chip"
                [style]="{'width':'100%'}"
              />
            }

            @case ('radio') {
              <div class="radio-group" role="radiogroup" [attr.aria-labelledby]="field.field_key + '-label'">
                @for (option of field.options || []; track option) {
                  <div class="radio-option">
                    <p-radioButton
                      [inputId]="field.field_key + '_' + option"
                      [formControl]="getControl()"
                      [value]="option"
                      [name]="field.field_key"
                    />
                    <label [for]="field.field_key + '_' + option" class="radio-label">
                      {{ option }}
                    </label>
                  </div>
                }
              </div>
            }

            @case ('checkbox_group') {
              <div class="checkbox-group" role="group" [attr.aria-labelledby]="field.field_key + '-label'">
                @for (option of field.options || []; track option) {
                  <div class="checkbox-option">
                    <p-checkbox
                      [inputId]="field.field_key + '_' + option"
                      [formControl]="getCheckboxControl(option)"
                      [binary]="true"
                    />
                    <label [for]="field.field_key + '_' + option" class="checkbox-label">
                      {{ option }}
                    </label>
                  </div>
                }
              </div>
            }

            @case ('textarea') {
              <textarea
                pTextarea
                [id]="field.field_key"
                [formControl]="getControl()"
                [placeholder]="field.placeholder || ''"
                [maxlength]="field.validation?.maxLength || null"
                rows="3"
                style="width:100%;resize:vertical"
              ></textarea>
            }

            @default {
              <input
                pInputText
                [id]="field.field_key"
                [formControl]="getControl()"
                [placeholder]="field.placeholder || field.type"
                style="width:100%"
              />
            }

          }
        </div>

        <!-- Validation error messages -->
        @if (control?.invalid && (control?.dirty || control?.touched)) {
          <div class="dynamic-field-errors" role="alert">
            @if (control?.errors?.['required']) {
              <span class="error-msg">{{ field.label }} is required.</span>
            }
            @if (control?.errors?.['min']) {
              <span class="error-msg">
                Value must be at least {{ control?.errors?.['min']?.min }}.
              </span>
            }
            @if (control?.errors?.['max']) {
              <span class="error-msg">
                Value must be at most {{ control?.errors?.['max']?.max }}.
              </span>
            }
            @if (control?.errors?.['minlength']) {
              <span class="error-msg">
                Minimum {{ control?.errors?.['minlength']?.requiredLength }} characters required.
              </span>
            }
            @if (control?.errors?.['maxlength']) {
              <span class="error-msg">
                Maximum {{ control?.errors?.['maxlength']?.requiredLength }} characters allowed.
              </span>
            }
            @if (control?.errors?.['pattern']) {
              <span class="error-msg">Invalid format.</span>
            }
            @if (control?.errors?.['minDate']) {
              <span class="error-msg">
                Date must be on or after
                {{ control?.errors?.['minDate']?.required | date:'mediumDate' }}.
              </span>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .dynamic-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dynamic-field-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-neutral-700);
    }
    .required-marker {
      color: var(--color-error, #dc2626);
      margin-left: 2px;
    }
    .dynamic-field-control {
      display: flex;
      flex-direction: column;
    }
    .dynamic-field-errors {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .error-msg {
      font-size: 11px;
      color: var(--color-error, #dc2626);
    }
    .radio-group,
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .radio-option,
    .checkbox-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .radio-label,
    .checkbox-label {
      font-size: 13px;
      color: var(--color-neutral-700);
      cursor: pointer;
    }
    :host ::ng-deep .p-inputnumber { width: 100%; }
    :host ::ng-deep .p-inputnumber .p-inputnumber-input { width: 100%; }
    :host ::ng-deep .p-calendar { width: 100%; }
    :host ::ng-deep .p-calendar .p-inputtext { width: 100%; }
    :host ::ng-deep .p-dropdown { width: 100%; }
    :host ::ng-deep .p-multiselect { width: 100%; }
  `]
})
export class DynamicFieldComponent implements OnInit {
  @Input({ required: true }) field!: FormField;
  @Input({ required: true }) sectionGroup!: FormGroup;

  /** Cached reference to the AbstractControl for this field */
  control: FormControl | null = null;

  /** Options mapped to the format PrimeNG select/multiselect expect */
  fieldOptions: string[] = [];

  /** Computed minDate for date fields with minDate validation */
  minDate: Date | null = null;

  /** Per-option checkbox controls — used for checkbox_group */
  private checkboxControls: Map<string, FormControl> = new Map();

  ngOnInit(): void {
    this.control = this.sectionGroup.get(this.field.field_key) as FormControl;
    this.fieldOptions = this.field.options ?? [];

    // Resolve minDate for date fields
    if (this.field.type === 'date' && this.field.validation?.minDate) {
      this.minDate = this.resolveMinDate(this.field.validation.minDate);
    }

    // Initialize checkbox controls from existing parent value
    if (this.field.type === 'checkbox_group') {
      this.initCheckboxControls();
    }
  }

  getControl(): FormControl {
    return this.control!;
  }

  /**
   * For checkbox_group: each option needs its own binary checkbox control.
   * We bind them to separate controls derived from the parent array control.
   */
  getCheckboxControl(option: string): FormControl {
    if (!this.checkboxControls.has(option)) {
      this.createCheckboxControl(option);
    }
    return this.checkboxControls.get(option)!;
  }

  /** Resolve minDate string to a Date. Supports "today" and ISO date strings. */
  private resolveMinDate(minDateStr: string): Date | null {
    if (minDateStr === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
    const parsed = new Date(minDateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /** Initialize all checkbox controls from the parent array value */
  private initCheckboxControls(): void {
    const currentValues: string[] = (this.control?.value as string[]) ?? [];
    for (const option of this.field.options ?? []) {
      this.createCheckboxControl(option, currentValues.includes(option));
    }
  }

  /** Create a single checkbox control for an option and wire up two-way sync */
  private createCheckboxControl(option: string, initialChecked: boolean = false): void {
    const ctrl = new FormControl(initialChecked);

    // Sync: when this option control changes, update the parent array control
    ctrl.valueChanges.subscribe((checked: boolean | null) => {
      const current: string[] = (this.control?.value as string[]) ?? [];
      let updated: string[];
      if (checked && !current.includes(option)) {
        updated = [...current, option];
      } else if (!checked && current.includes(option)) {
        updated = current.filter(v => v !== option);
      } else {
        return; // no change
      }
      this.control?.setValue(updated, { emitEvent: true });
      this.control?.markAsDirty();
    });

    this.checkboxControls.set(option, ctrl);
  }
}
