import {
  Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, FormArray,
  Validators, AbstractControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService, ConfirmationService } from 'primeng/api';

import { TemplatePreviewComponent } from './template-preview.component';
import { FormSchema, FormSection, FormField } from './template.service';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

const FIELD_TYPES = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Select (single)', value: 'select' },
  { label: 'Multi-select', value: 'multiselect' },
  { label: 'Radio buttons', value: 'radio' },
  { label: 'Checkbox group', value: 'checkbox_group' },
  { label: 'Textarea', value: 'textarea' },
];

interface Disease {
  id: number;
  name: string;
  is_active: boolean;
}

/** Convert a label string to a slug key: "Height (cm)" → "height_cm" */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/** Whether a field type supports options (select / radio / checkbox) */
function hasOptions(type: string): boolean {
  return ['select', 'multiselect', 'radio', 'checkbox_group'].includes(type);
}

/** Whether a field type supports numeric min/max validation */
function isNumericType(type: string): boolean {
  return type === 'number';
}

/** Whether a field type supports string length validation */
function isStringType(type: string): boolean {
  return ['text', 'textarea'].includes(type);
}

/** Whether a field type supports date validation */
function isDateType(type: string): boolean {
  return type === 'date';
}

@Component({
  selector: 'app-template-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CheckboxModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
    InputNumberModule,
    TemplatePreviewComponent,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <!-- Page header -->
    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">
          {{ isEdit ? 'Edit Template' : 'New Template' }}
        </h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Visual JSON schema builder
        </p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-secondary" (click)="goBack()">
          <i class="pi pi-arrow-left"></i> Back
        </button>
        <button class="btn-primary" [disabled]="saving()" (click)="saveTemplate()">
          @if (saving()) { <i class="pi pi-spin pi-spinner"></i> Saving... }
          @else { <i class="pi pi-save"></i> Save Template }
        </button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

      <!-- ── LEFT: Builder panel ─────────────────────────────────────── -->
      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- Disease selector -->
        <div class="card" style="padding:16px">
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="label">
              Disease <span style="color:var(--color-error)">*</span>
            </label>
            <p-dropdown
              [options]="diseases()"
              optionLabel="name"
              optionValue="id"
              placeholder="Select a disease"
              [(ngModel)]="selectedDiseaseId"
              [disabled]="isEdit"
              [showClear]="!isEdit"
              [style]="{'width':'100%'}"
            />
          </div>
        </div>

        <!-- Sections builder -->
        <div class="card" style="padding:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 style="margin:0;font-size:14px;font-weight:700">Sections</h3>
            <button class="btn-secondary btn-sm" (click)="addSection()">
              <i class="pi pi-plus"></i> Add Section
            </button>
          </div>

          @if (!sections.length) {
            <p style="color:var(--color-neutral-400);font-size:13px;text-align:center;padding:24px 0">
              No sections yet. Click "Add Section" to get started.
            </p>
          }

          @for (section of sections; track section; let si = $index) {
            <div class="section-card" [class.section-expanded]="expandedSections[si]">
              <!-- Section header row -->
              <div class="section-header" (click)="toggleSection(si)">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                  <i class="pi" [class.pi-chevron-right]="!expandedSections[si]" [class.pi-chevron-down]="expandedSections[si]"
                    style="font-size:12px;color:var(--color-neutral-500)"></i>
                  @if (editingSectionIndex === si) {
                    <input
                      pInputText
                      type="text"
                      [(ngModel)]="section.label"
                      (ngModelChange)="onSectionLabelChange(si)"
                      (click)="$event.stopPropagation()"
                      placeholder="Section name"
                      style="font-weight:600;font-size:13px;padding:2px 6px;height:28px;width:200px"
                    />
                  } @else {
                    <span style="font-weight:600;font-size:13px;color:var(--color-neutral-800);truncate">
                      {{ section.label || 'Untitled Section' }}
                    </span>
                  }
                  <span style="font-size:11px;color:var(--color-neutral-400)">
                    {{ section.fields.length }} field(s)
                  </span>
                </div>
                <div style="display:flex;gap:4px" (click)="$event.stopPropagation()">
                  <button type="button" pButton icon="pi pi-pencil"
                    class="p-button-text p-button-sm p-button-secondary"
                    pTooltip="Rename section"
                    (click)="startEditSectionLabel(si)"></button>
                  <button type="button" pButton icon="pi pi-arrow-up"
                    class="p-button-text p-button-sm p-button-secondary"
                    pTooltip="Move up"
                    [disabled]="si === 0"
                    (click)="moveSectionUp(si)"></button>
                  <button type="button" pButton icon="pi pi-arrow-down"
                    class="p-button-text p-button-sm p-button-secondary"
                    pTooltip="Move down"
                    [disabled]="si === sections.length - 1"
                    (click)="moveSectionDown(si)"></button>
                  <button type="button" pButton icon="pi pi-trash"
                    class="p-button-text p-button-sm p-button-danger"
                    pTooltip="Remove section"
                    (click)="removeSection(si)"></button>
                </div>
              </div>

              <!-- Section fields -->
              @if (expandedSections[si]) {
                <div class="section-body">
                  @if (!section.fields.length) {
                    <p style="color:var(--color-neutral-400);font-size:12px;text-align:center;padding:12px 0">
                      No fields. Click "Add Field" below.
                    </p>
                  }
                  @for (field of section.fields; track field; let fi = $index) {
                    <div class="field-card">
                      <!-- Field top row: label + type + required + actions -->
                      <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
                        <div style="flex:2;min-width:140px">
                          <label class="label-sm">Label <span style="color:var(--color-error)">*</span></label>
                          <input
                            pInputText
                            type="text"
                            [(ngModel)]="field.label"
                            (ngModelChange)="onFieldLabelChange(si, fi)"
                            placeholder="Field label"
                            style="width:100%;font-size:12px"
                          />
                        </div>
                        <div style="flex:1.2;min-width:130px">
                          <label class="label-sm">Field key</label>
                          <input
                            pInputText
                            type="text"
                            [(ngModel)]="field.field_key"
                            placeholder="auto-generated"
                            style="width:100%;font-size:12px;background:var(--color-neutral-50)"
                          />
                        </div>
                        <div style="flex:1.4;min-width:140px">
                          <label class="label-sm">Type <span style="color:var(--color-error)">*</span></label>
                          <p-dropdown
                            [options]="fieldTypes"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="field.type"
                            (ngModelChange)="onFieldTypeChange(si, fi)"
                            [style]="{'width':'100%','font-size':'12px'}"
                          />
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:20px">
                          <label class="label-sm" style="margin-bottom:0">Req.</label>
                          <p-checkbox [(ngModel)]="field.required" [binary]="true" />
                        </div>
                        <div style="display:flex;gap:4px;padding-top:20px">
                          <button type="button" pButton icon="pi pi-arrow-up"
                            class="p-button-text p-button-sm p-button-secondary"
                            pTooltip="Move up" [disabled]="fi === 0"
                            (click)="moveFieldUp(si, fi)"></button>
                          <button type="button" pButton icon="pi pi-arrow-down"
                            class="p-button-text p-button-sm p-button-secondary"
                            pTooltip="Move down" [disabled]="fi === section.fields.length - 1"
                            (click)="moveFieldDown(si, fi)"></button>
                          <button type="button" pButton icon="pi pi-trash"
                            class="p-button-text p-button-sm p-button-danger"
                            pTooltip="Remove field"
                            (click)="removeField(si, fi)"></button>
                        </div>
                      </div>

                      <!-- Placeholder -->
                      <div style="margin-top:8px">
                        <label class="label-sm">Placeholder</label>
                        <input pInputText type="text" [(ngModel)]="field.placeholder"
                          placeholder="Optional hint text" style="width:100%;font-size:12px" />
                      </div>

                      <!-- Options (for select/radio/checkbox) -->
                      @if (hasOptions(field.type)) {
                        <div style="margin-top:8px">
                          <label class="label-sm">Options (one per line)</label>
                          <textarea
                            rows="3"
                            [value]="optionsToText(field.options)"
                            (input)="onOptionsInput(si, fi, $event)"
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            style="width:100%;font-size:12px;padding:6px 8px;border:1px solid var(--color-neutral-300);border-radius:4px;resize:vertical"
                          ></textarea>
                        </div>
                      }

                      <!-- Validation rules -->
                      <div style="margin-top:8px">
                        <div style="font-size:11px;font-weight:700;color:var(--color-neutral-500);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">
                          Validation Rules
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px">
                          @if (isNumeric(field.type)) {
                            <div style="display:flex;flex-direction:column;gap:3px;min-width:80px">
                              <label class="label-sm">Min value</label>
                              <p-inputnumber [(ngModel)]="field.validation!.min"
                                placeholder="—"
                                inputStyleClass="w-full" [style]="{'width':'90px'}" />
                            </div>
                            <div style="display:flex;flex-direction:column;gap:3px;min-width:80px">
                              <label class="label-sm">Max value</label>
                              <p-inputnumber [(ngModel)]="field.validation!.max"
                                placeholder="—"
                                inputStyleClass="w-full" [style]="{'width':'90px'}" />
                            </div>
                          }
                          @if (isString(field.type)) {
                            <div style="display:flex;flex-direction:column;gap:3px;min-width:80px">
                              <label class="label-sm">Min length</label>
                              <p-inputnumber [(ngModel)]="field.validation!.minLength"
                                placeholder="—"
                                inputStyleClass="w-full" [style]="{'width':'90px'}" />
                            </div>
                            <div style="display:flex;flex-direction:column;gap:3px;min-width:80px">
                              <label class="label-sm">Max length</label>
                              <p-inputnumber [(ngModel)]="field.validation!.maxLength"
                                placeholder="—"
                                inputStyleClass="w-full" [style]="{'width':'90px'}" />
                            </div>
                            <div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:160px">
                              <label class="label-sm">Pattern (regex)</label>
                              <input pInputText type="text" [(ngModel)]="field.validation!.pattern"
                                placeholder="e.g. ^[A-Z]+" style="width:100%;font-size:12px" />
                            </div>
                          }
                          @if (isDate(field.type)) {
                            <div style="display:flex;flex-direction:column;gap:3px;min-width:120px">
                              <label class="label-sm">Min date</label>
                              <input pInputText type="text" [(ngModel)]="field.validation!.minDate"
                                placeholder='today or YYYY-MM-DD' style="width:100%;font-size:12px" />
                            </div>
                            <div style="display:flex;flex-direction:column;gap:3px;min-width:120px">
                              <label class="label-sm">Max date</label>
                              <input pInputText type="text" [(ngModel)]="field.validation!.maxDate"
                                placeholder="YYYY-MM-DD" style="width:100%;font-size:12px" />
                            </div>
                          }
                          @if (!isNumeric(field.type) && !isString(field.type) && !isDate(field.type)) {
                            <span style="font-size:12px;color:var(--color-neutral-400);padding:4px 0">
                              No validation rules for this field type.
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  }

                  <button class="btn-secondary btn-sm" style="margin-top:8px;width:100%"
                    (click)="addField(si)">
                    <i class="pi pi-plus"></i> Add Field
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- ── RIGHT: Live preview ──────────────────────────────────────── -->
      <div class="card" style="padding:16px;position:sticky;top:80px">
        <h3 style="margin:0 0 16px;font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px">
          <i class="pi pi-eye" style="color:var(--color-primary)"></i>
          Live Preview
          <span style="font-size:11px;font-weight:400;color:var(--color-neutral-400)">(read-only)</span>
        </h3>
        <app-template-preview [schema]="previewSchema()" />
      </div>

    </div>
  `,
  styles: [`
    .section-card {
      border: 1px solid var(--color-neutral-200);
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--color-neutral-50, #f9fafb);
      cursor: pointer;
      user-select: none;
    }
    .section-header:hover { background: var(--color-neutral-100); }
    .section-body {
      padding: 12px;
      border-top: 1px solid var(--color-neutral-200);
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .field-card {
      border: 1px solid var(--color-neutral-200);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 8px;
      background: var(--surface-card);
    }
    .field-card:last-of-type { margin-bottom: 0; }
    .label-sm {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-neutral-600);
      display: block;
      margin-bottom: 3px;
    }
    :host ::ng-deep .p-inputnumber-input { font-size: 12px !important; padding: 4px 6px !important; }
    :host ::ng-deep .p-select { font-size: 12px; }
  `]
})
export class TemplateBuilderComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private destroy$ = new Subject<void>();

  // ── State ──
  isEdit = false;
  templateId: number | null = null;
  existingTemplate: any = null;

  diseases = signal<Disease[]>([]);
  loading = signal(false);
  saving = signal(false);

  selectedDiseaseId: number | null = null;

  /**
   * sections is our mutable working model for the builder.
   * Each section maps directly to the JSON schema section structure.
   * sectionsVersion is bumped whenever sections mutate so the preview reacts.
   */
  sections: FormSection[] = [];
  private sectionsVersion = signal(0);

  /** Track which sections are expanded in the UI */
  expandedSections: boolean[] = [];

  /** Which section is currently being renamed */
  editingSectionIndex: number | null = null;

  /** Available field types dropdown */
  fieldTypes = FIELD_TYPES;

  /** Refresh the preview after any mutation */
  private touchSections(): void {
    this.sectionsVersion.update(v => v + 1);
  }

  /** Computed schema for the preview panel — re-evaluates whenever sectionsVersion changes */
  previewSchema = computed<FormSchema | null>(() => {
    this.sectionsVersion(); // subscribe to mutations
    if (!this.selectedDiseaseId) return null;
    return {
      version: this.existingTemplate?.version ?? 1,
      disease_id: this.selectedDiseaseId,
      sections: this.sections.map((s, si) => ({
        ...s,
        order: si + 1,
        fields: s.fields.map((f, fi) => ({ ...f, order: fi + 1 }))
      }))
    };
  });

  // Expose helpers to template
  hasOptions = hasOptions;
  isNumeric = isNumericType;
  isString = isStringType;
  isDate = isDateType;

  ngOnInit(): void {
    this.loadDiseases();
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.templateId = +id;
      this.loadTemplate(this.templateId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDiseases(): void {
    this.http.get<{ items: Disease[]; total: number }>(`${API}/api/v1/diseases/`, {
      params: new HttpParams().set('page_size', '100').set('include_inactive', 'false')
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => this.diseases.set(res.items),
      error: (err: any) => console.error('[API Error]', err)
    });
  }

  loadTemplate(id: number): void {
    this.loading.set(true);
    this.http.get<any>(`${API}/api/v1/templates/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tmpl) => {
          this.existingTemplate = tmpl;
          this.selectedDiseaseId = tmpl.disease_id;
          this.sections = (tmpl.schema?.sections ?? []).map((s: FormSection) => ({
            ...s,
            fields: (s.fields ?? []).map((f: FormField) => ({
              ...f,
              validation: f.validation ?? {}
            }))
          }));
          this.expandedSections = this.sections.map(() => false);
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load template' });
          this.loading.set(false);
        }
      });
  }

  // ── Section management ────────────────────────────────────────────────────

  addSection(): void {
    const order = this.sections.length + 1;
    this.sections.push({
      section_key: `section_${order}`,
      label: `Section ${order}`,
      order,
      fields: []
    });
    this.expandedSections.push(true);
    this.editingSectionIndex = this.sections.length - 1;
    this.touchSections();
  }

  removeSection(index: number): void {
    this.confirmationService.confirm({
      message: `Remove section "<strong>${this.sections[index].label}</strong>" and all its fields?`,
      header: 'Remove Section',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.sections.splice(index, 1);
        this.expandedSections.splice(index, 1);
        this.rebuildSectionOrders();
        this.touchSections();
      }
    });
  }

  startEditSectionLabel(index: number): void {
    this.editingSectionIndex = index;
    this.expandedSections[index] = true;
  }

  onSectionLabelChange(index: number): void {
    const label = this.sections[index].label;
    this.sections[index].section_key = slugify(label) || `section_${index + 1}`;
    this.touchSections();
  }

  toggleSection(index: number): void {
    this.expandedSections[index] = !this.expandedSections[index];
    if (this.editingSectionIndex === index && !this.expandedSections[index]) {
      this.editingSectionIndex = null;
    }
  }

  moveSectionUp(index: number): void {
    if (index === 0) return;
    [this.sections[index - 1], this.sections[index]] = [this.sections[index], this.sections[index - 1]];
    [this.expandedSections[index - 1], this.expandedSections[index]] =
      [this.expandedSections[index], this.expandedSections[index - 1]];
    this.rebuildSectionOrders();
    this.touchSections();
  }

  moveSectionDown(index: number): void {
    if (index >= this.sections.length - 1) return;
    [this.sections[index], this.sections[index + 1]] = [this.sections[index + 1], this.sections[index]];
    [this.expandedSections[index], this.expandedSections[index + 1]] =
      [this.expandedSections[index + 1], this.expandedSections[index]];
    this.rebuildSectionOrders();
    this.touchSections();
  }

  private rebuildSectionOrders(): void {
    this.sections.forEach((s, i) => (s.order = i + 1));
  }

  // ── Field management ──────────────────────────────────────────────────────

  addField(sectionIndex: number): void {
    const section = this.sections[sectionIndex];
    const order = section.fields.length + 1;
    section.fields.push({
      field_key: `field_${order}`,
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      options: [],
      validation: {},
      order
    });
    this.touchSections();
  }

  removeField(sectionIndex: number, fieldIndex: number): void {
    this.sections[sectionIndex].fields.splice(fieldIndex, 1);
    this.rebuildFieldOrders(sectionIndex);
    this.touchSections();
  }

  onFieldLabelChange(si: number, fi: number): void {
    const field = this.sections[si].fields[fi];
    if (field.label) {
      field.field_key = slugify(field.label) || `field_${fi + 1}`;
    }
    this.touchSections();
  }

  onFieldTypeChange(si: number, fi: number): void {
    const field = this.sections[si].fields[fi];
    // Reset options/validation when type changes
    if (!hasOptions(field.type)) {
      field.options = [];
    }
    field.validation = {};
    this.touchSections();
  }

  moveFieldUp(si: number, fi: number): void {
    const fields = this.sections[si].fields;
    if (fi === 0) return;
    [fields[fi - 1], fields[fi]] = [fields[fi], fields[fi - 1]];
    this.rebuildFieldOrders(si);
    this.touchSections();
  }

  moveFieldDown(si: number, fi: number): void {
    const fields = this.sections[si].fields;
    if (fi >= fields.length - 1) return;
    [fields[fi], fields[fi + 1]] = [fields[fi + 1], fields[fi]];
    this.rebuildFieldOrders(si);
    this.touchSections();
  }

  private rebuildFieldOrders(sectionIndex: number): void {
    this.sections[sectionIndex].fields.forEach((f, i) => (f.order = i + 1));
  }

  // ── Options handling (text-area → string[]) ───────────────────────────────

  optionsToText(options: string[] | undefined): string {
    return (options ?? []).join('\n');
  }

  onOptionsInput(si: number, fi: number, event: Event): void {
    const raw = (event.target as HTMLTextAreaElement).value;
    this.sections[si].fields[fi].options = raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    this.touchSections();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  saveTemplate(): void {
    if (!this.selectedDiseaseId) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please select a disease first.' });
      return;
    }
    if (!this.sections.length) {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Add at least one section.' });
      return;
    }
    for (const section of this.sections) {
      if (!section.label.trim()) {
        this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'All sections must have a label.' });
        return;
      }
      for (const field of section.fields) {
        if (!field.label.trim()) {
          this.messageService.add({ severity: 'warn', summary: 'Validation', detail: `All fields must have a label (section: "${section.label}").` });
          return;
        }
      }
    }

    // Warn if editing an active template
    if (this.isEdit && this.existingTemplate?.is_active) {
      this.confirmationService.confirm({
        message: 'This template is currently <strong>active</strong>. Saving will create a new version and deactivate the current one. Continue?',
        header: 'Replace Active Template',
        icon: 'pi pi-exclamation-triangle',
        acceptButtonStyleClass: 'p-button-warning',
        accept: () => this.doSave()
      });
    } else {
      this.doSave();
    }
  }

  private doSave(): void {
    this.saving.set(true);

    const schema: FormSchema = {
      version: this.existingTemplate?.version ?? 1,
      disease_id: this.selectedDiseaseId!,
      sections: this.sections.map((s, si) => ({
        section_key: s.section_key || slugify(s.label) || `section_${si + 1}`,
        label: s.label,
        order: si + 1,
        fields: s.fields.map((f, fi) => {
          const clean: FormField = {
            field_key: f.field_key || slugify(f.label) || `field_${fi + 1}`,
            label: f.label,
            type: f.type,
            required: f.required,
            order: fi + 1,
          };
          if (f.placeholder) clean.placeholder = f.placeholder;
          if (hasOptions(f.type) && f.options?.length) clean.options = f.options;
          // Only include non-empty validation
          const v = f.validation ?? {};
          const cleanV: FormField['validation'] = {};
          if (v.min !== undefined && v.min !== null) cleanV.min = v.min;
          if (v.max !== undefined && v.max !== null) cleanV.max = v.max;
          if (v.minLength !== undefined && v.minLength !== null) cleanV.minLength = v.minLength;
          if (v.maxLength !== undefined && v.maxLength !== null) cleanV.maxLength = v.maxLength;
          if (v.pattern?.trim()) cleanV.pattern = v.pattern.trim();
          if (v.minDate?.trim()) cleanV.minDate = v.minDate.trim();
          if (v.maxDate?.trim()) cleanV.maxDate = v.maxDate.trim();
          if (Object.keys(cleanV).length) clean.validation = cleanV;
          return clean;
        })
      }))
    };

    const request = this.isEdit && this.templateId
      ? this.http.put<any>(`${API}/api/v1/templates/${this.templateId}`, { schema })
      : this.http.post<any>(`${API}/api/v1/templates/`, { disease_id: this.selectedDiseaseId, schema });

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Template saved successfully.' });
        this.saving.set(false);
        setTimeout(() => this.router.navigate(['/admin/templates']), 1200);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Failed to save template.' });
        this.saving.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/templates']);
  }
}
