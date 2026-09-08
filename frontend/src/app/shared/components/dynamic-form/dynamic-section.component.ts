import { Component, Input } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FieldsetModule } from 'primeng/fieldset';

import { FormSection } from '../../../features/templates/template.service';
import { DynamicFieldComponent } from './dynamic-field.component';

/**
 * DynamicSectionComponent — renders a named form section as a PrimeNG p-fieldset.
 *
 * Receives:
 *   @Input() section: FormSection   — schema definition for this section
 *   @Input() sectionGroup: FormGroup — the reactive FormGroup for this section
 */
@Component({
  selector: 'app-dynamic-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FieldsetModule, DynamicFieldComponent],
  template: `
    @if (section && sectionGroup) {
      <p-fieldset [legend]="section.label" styleClass="mb-4 dynamic-section">
        <div class="dynamic-section-fields">
          @for (field of sortedFields; track field.field_key) {
            <app-dynamic-field
              [field]="field"
              [sectionGroup]="sectionGroup"
            />
          }
        </div>
      </p-fieldset>
    }
  `,
  styles: [`
    :host ::ng-deep .dynamic-section .p-fieldset-legend {
      font-weight: 700;
      font-size: 13px;
      color: var(--color-neutral-700);
    }
    :host ::ng-deep .dynamic-section .p-fieldset-content {
      padding: 16px;
    }
    .dynamic-section-fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
  `]
})
export class DynamicSectionComponent {
  @Input({ required: true }) section!: FormSection;
  @Input({ required: true }) sectionGroup!: FormGroup;

  get sortedFields() {
    if (!this.section?.fields) return [];
    return [...this.section.fields].sort((a, b) => a.order - b.order);
  }
}
