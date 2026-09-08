import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormSchema } from './template.service';
import { DynamicFormComponent } from '../../shared/components/dynamic-form/dynamic-form.component';

/**
 * TemplatePreviewComponent — renders a read-only live preview of a form schema.
 * Delegates rendering to DynamicFormComponent with isReadonly=true.
 */
@Component({
  selector: 'app-template-preview',
  standalone: true,
  imports: [CommonModule, DynamicFormComponent],
  template: `
    @if (!schema || !schema.sections?.length) {
      <div class="preview-empty">
        <i class="pi pi-file-edit" style="font-size:2rem;color:var(--color-neutral-300)"></i>
        <p style="color:var(--color-neutral-400);margin:8px 0 0">Add sections and fields to preview the form</p>
      </div>
    } @else {
      <app-dynamic-form
        [schema]="schema"
        [isReadonly]="true"
      />
    }
  `,
  styles: [`
    .preview-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }
    :host ::ng-deep .p-fieldset {
      border-color: var(--color-neutral-200);
    }
    :host ::ng-deep .dynamic-field-label {
      font-size: 12px;
    }
  `]
})
export class TemplatePreviewComponent {
  @Input() schema: FormSchema | null = null;
}
