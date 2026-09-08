import {
  Component, Input, OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import {
  ReactiveFormsModule, FormGroup, FormControl, Validators, ValidatorFn, AbstractControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';

import { FormSchema, FormSection, FormField } from '../../../features/templates/template.service';
import { DynamicSectionComponent } from './dynamic-section.component';

/**
 * Custom validator for minDate constraint.
 * Accepts "today" (resolved at validation time) or an ISO date string.
 */
function minDateValidator(minDateStr: string): ValidatorFn {
  return (control: AbstractControl) => {
    if (!control.value) return null;

    const value = control.value instanceof Date ? control.value : new Date(control.value);
    if (isNaN(value.getTime())) return null;

    const min = minDateStr === 'today'
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : new Date(minDateStr);

    if (isNaN(min.getTime())) return null;

    return value >= min ? null : { minDate: { required: min, actual: value } };
  };
}

/**
 * DynamicFormComponent — builds a reactive FormGroup from a JSON schema at runtime.
 *
 * Public API:
 *   @Input() schema: FormSchema         — required
 *   @Input() initialData: Record<string, unknown>  — optional initial values (flat key-value)
 *   @Input() isReadonly: boolean        — disables all controls when true
 *
 *   getFormData(): Record<string, unknown>  — flat merged key-value of all sections
 *   isValid(): boolean
 */
@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DynamicSectionComponent],
  template: `
    @if (schema && form) {
      <form [formGroup]="form" novalidate>
        @for (section of sortedSections; track section.section_key) {
          <app-dynamic-section
            [section]="section"
            [sectionGroup]="getSectionGroup(section.section_key)"
          />
        }
      </form>
    }
  `
})
export class DynamicFormComponent implements OnInit, OnChanges {
  @Input({ required: true }) schema!: FormSchema;
  @Input() initialData: Record<string, unknown> = {};
  @Input() isReadonly: boolean = false;

  form!: FormGroup;

  get sortedSections(): FormSection[] {
    if (!this.schema?.sections) return [];
    return [...this.schema.sections].sort((a, b) => a.order - b.order);
  }

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Rebuild form when schema changes (e.g. disease selection changes)
    if (changes['schema'] && !changes['schema'].firstChange) {
      this.buildForm();
    }
    // Handle readonly toggle without full rebuild
    if (changes['isReadonly'] && !changes['isReadonly'].firstChange && this.form) {
      if (this.isReadonly) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    }
  }

  private buildForm(): void {
    if (!this.schema) return;

    const sectionGroups: Record<string, FormGroup> = {};
    for (const section of this.schema.sections) {
      const controls: Record<string, FormControl> = {};
      for (const field of section.fields) {
        const defaultValue = field.type === 'checkbox_group' ? [] : null;
        controls[field.field_key] = new FormControl(defaultValue, this.buildValidators(field));
      }
      sectionGroups[section.section_key] = new FormGroup(controls);
    }
    this.form = new FormGroup(sectionGroups);

    // Patch initial data (flat key-value → find matching section)
    if (this.initialData && Object.keys(this.initialData).length > 0) {
      this.patchFlatData(this.initialData);
    }

    if (this.isReadonly) {
      this.form.disable();
    }
  }

  private buildValidators(field: FormField): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    if (field.required) {
      validators.push(Validators.required);
    }

    const v = field.validation;
    if (v) {
      if (v.min !== undefined) validators.push(Validators.min(v.min));
      if (v.max !== undefined) validators.push(Validators.max(v.max));
      if (v.minLength !== undefined) validators.push(Validators.minLength(v.minLength));
      if (v.maxLength !== undefined) validators.push(Validators.maxLength(v.maxLength));
      if (v.pattern) validators.push(Validators.pattern(v.pattern));
      if (v.minDate) validators.push(minDateValidator(v.minDate));
    }

    return validators;
  }

  /** Patch flat key-value data into nested section groups */
  private patchFlatData(data: Record<string, unknown>): void {
    for (const section of this.schema.sections) {
      const sectionGroup = this.form.get(section.section_key) as FormGroup;
      if (!sectionGroup) continue;

      const sectionPatch: Record<string, unknown> = {};
      for (const field of section.fields) {
        if (data[field.field_key] !== undefined) {
          sectionPatch[field.field_key] = data[field.field_key];
        }
      }
      if (Object.keys(sectionPatch).length > 0) {
        sectionGroup.patchValue(sectionPatch);
      }
    }
  }

  getSectionGroup(sectionKey: string): FormGroup {
    return this.form.get(sectionKey) as FormGroup;
  }

  /**
   * Returns a flat key-value object merging all sections' form values.
   * The form structure is: { section_key: { field_key: value } }
   * This flattens it to: { field_key: value }
   */
  getFormData(): Record<string, unknown> {
    if (!this.form) return {};
    const raw = this.form.getRawValue() as Record<string, Record<string, unknown>>;
    const flat: Record<string, unknown> = {};
    for (const sectionValues of Object.values(raw)) {
      if (sectionValues && typeof sectionValues === 'object') {
        Object.assign(flat, sectionValues);
      }
    }
    return flat;
  }

  isValid(): boolean {
    return this.form?.valid ?? false;
  }
}
