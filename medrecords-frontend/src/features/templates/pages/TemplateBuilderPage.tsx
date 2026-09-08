/**
 * Template Builder Page.
 *
 * React replica of the Angular TemplateBuilderComponent — a visual JSON schema
 * builder for disease-specific form templates. Supports:
 *  - Disease selection (locked in edit mode)
 *  - Add/remove/reorder/rename sections
 *  - Add/remove/reorder fields with type, required flag, placeholder, options,
 *    and per-type validation rules
 *  - Live read-only preview of the schema
 *  - Create (POST) and edit (PUT — creates a new version) flows
 *
 * Endpoints (relative to apiClient baseURL `/api/v1`):
 *  GET  /diseases/?page_size=100&include_inactive=false
 *  GET  /templates/{id}
 *  POST /templates/
 *  PUT  /templates/{id}
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

const apiClient = createTypedApiClient();

// ─── Models ──────────────────────────────────────────────────────────────────

type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox_group'
  | 'textarea';

interface FieldValidation {
  min?: number | null;
  max?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
}

interface BuilderField {
  field_key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: FieldValidation;
  order?: number;
}

interface BuilderSection {
  section_key: string;
  label: string;
  order?: number;
  fields: BuilderField[];
}

interface FormSchema {
  version: number;
  disease_id: number;
  sections: BuilderSection[];
}

interface Disease {
  id: number;
  name: string;
  is_active: boolean;
}

interface FormTemplate {
  id: number;
  disease_id: number;
  version: number;
  is_active: boolean;
  schema: FormSchema;
}

const FIELD_TYPES: { label: string; value: FieldType }[] = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Select (single)', value: 'select' },
  { label: 'Multi-select', value: 'multiselect' },
  { label: 'Radio buttons', value: 'radio' },
  { label: 'Checkbox group', value: 'checkbox_group' },
  { label: 'Textarea', value: 'textarea' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function hasOptions(type: FieldType): boolean {
  return ['select', 'multiselect', 'radio', 'checkbox_group'].includes(type);
}

function isNumericType(type: FieldType): boolean {
  return type === 'number';
}

function isStringType(type: FieldType): boolean {
  return type === 'text' || type === 'textarea';
}

function isDateType(type: FieldType): boolean {
  return type === 'date';
}

// ═══════════════════════════════════════════════════════════════════════════
//  Read-only preview (mirrors TemplatePreviewComponent + DynamicForm readonly)
// ═══════════════════════════════════════════════════════════════════════════

function TemplatePreview({ schema }: { schema: FormSchema | null }) {
  if (!schema || !(schema.sections?.length)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <i className="pi pi-file-edit" style={{ fontSize: '2rem', color: 'var(--color-neutral-300)' }} />
        <p style={{ color: 'var(--color-neutral-400)', margin: '8px 0 0' }}>Add sections and fields to preview the form</p>
      </div>
    );
  }

  const sortedSections = [...schema.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div>
      {sortedSections.map((section) => {
        const sortedFields = [...(section.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return (
          <fieldset
            key={section.section_key}
            style={{ border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}
          >
            <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-neutral-700)', padding: '0 6px' }}>
              {section.label || 'Untitled Section'}
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {sortedFields.map((field) => (
                <div key={field.field_key} style={{ marginBottom: 8, flex: 1, minWidth: 240 }}>
                  <label className="label">
                    {field.label || '(unlabeled)'}
                    {field.required && <span style={{ color: 'var(--color-error)' }}> *</span>}
                  </label>
                  <PreviewControl field={field} />
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function PreviewControl({ field }: { field: BuilderField }) {
  const options = field.options ?? [];
  switch (field.type) {
    case 'textarea':
      return <textarea className="form-control" placeholder={field.placeholder} rows={3} disabled style={{ width: '100%', resize: 'vertical' }} />;
    case 'number':
      return <input type="number" className="form-control" placeholder={field.placeholder} disabled style={{ width: '100%' }} />;
    case 'date':
      return <input type="date" className="form-control" disabled style={{ width: '100%' }} />;
    case 'select':
    case 'multiselect':
      return (
        <div className="select-wrapper">
          <select className="form-control" disabled multiple={field.type === 'multiselect'} style={{ width: '100%' }}>
            <option value="">{field.placeholder ?? 'Select...'}</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="select-arrow" />
        </div>
      );
    case 'radio':
    case 'checkbox_group':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {options.map((o) => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type={field.type === 'radio' ? 'radio' : 'checkbox'} disabled />
              {o}
            </label>
          ))}
        </div>
      );
    case 'text':
    default:
      return <input type="text" className="form-control" placeholder={field.placeholder} disabled style={{ width: '100%' }} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Template Builder Page
// ═══════════════════════════════════════════════════════════════════════════

export function TemplateBuilderPage() {
  const params = useParams();
  const navigate = useNavigate();

  const idParam = params.id ?? null;
  const isEdit = idParam !== null && idParam !== 'new';
  const templateId = isEdit ? Number(idParam) : null;

  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<number | ''>('');
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<boolean[]>([]);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [existingTemplate, setExistingTemplate] = useState<FormTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const showToast = useCallback((type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Data loading ──
  const loadDiseases = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: Disease[]; total: number }>('/diseases/', {
        params: { page_size: 100, include_inactive: 'false' },
      });
      setDiseases(res.data.items ?? []);
    } catch { /* non-critical */ }
  }, []);

  const loadTemplate = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<FormTemplate>(`/templates/${id}`);
      const tmpl = res.data;
      setExistingTemplate(tmpl);
      setSelectedDiseaseId(tmpl.disease_id);
      const loadedSections: BuilderSection[] = (tmpl.schema?.sections ?? []).map((s) => ({
        ...s,
        fields: (s.fields ?? []).map((f) => ({ ...f, validation: f.validation ?? {} })),
      }));
      setSections(loadedSections);
      setExpandedSections(loadedSections.map(() => false));
    } catch {
      showToast('error', 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDiseases();
    if (isEdit && templateId) {
      loadTemplate(templateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Preview schema ──
  const previewSchema = useMemo<FormSchema | null>(() => {
    if (!selectedDiseaseId) return null;
    return {
      version: existingTemplate?.version ?? 1,
      disease_id: Number(selectedDiseaseId),
      sections: sections.map((s, si) => ({
        ...s,
        order: si + 1,
        fields: s.fields.map((f, fi) => ({ ...f, order: fi + 1 })),
      })),
    };
  }, [selectedDiseaseId, sections, existingTemplate]);

  // ── Section management ──
  function mutateSections(updater: (draft: BuilderSection[]) => BuilderSection[]) {
    setSections((prev) => updater(prev.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) }))));
  }

  function addSection() {
    const order = sections.length + 1;
    setSections((prev) => [...prev, { section_key: `section_${order}`, label: `Section ${order}`, order, fields: [] }]);
    setExpandedSections((prev) => [...prev, true]);
    setEditingSectionIndex(sections.length);
  }

  function removeSection(index: number) {
    if (!window.confirm(`Remove section "${sections[index].label}" and all its fields?`)) return;
    setSections((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
    setExpandedSections((prev) => prev.filter((_, i) => i !== index));
    if (editingSectionIndex === index) setEditingSectionIndex(null);
  }

  function startEditSectionLabel(index: number) {
    setEditingSectionIndex(index);
    setExpandedSections((prev) => prev.map((e, i) => (i === index ? true : e)));
  }

  function onSectionLabelChange(index: number, label: string) {
    mutateSections((draft) => {
      draft[index].label = label;
      draft[index].section_key = slugify(label) || `section_${index + 1}`;
      return draft;
    });
  }

  function toggleSection(index: number) {
    setExpandedSections((prev) => prev.map((e, i) => (i === index ? !e : e)));
    if (editingSectionIndex === index && expandedSections[index]) setEditingSectionIndex(null);
  }

  function swap<T>(arr: T[], i: number, j: number): T[] {
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }

  function moveSectionUp(index: number) {
    if (index === 0) return;
    setSections((prev) => swap(prev, index - 1, index).map((s, i) => ({ ...s, order: i + 1 })));
    setExpandedSections((prev) => swap(prev, index - 1, index));
  }

  function moveSectionDown(index: number) {
    if (index >= sections.length - 1) return;
    setSections((prev) => swap(prev, index, index + 1).map((s, i) => ({ ...s, order: i + 1 })));
    setExpandedSections((prev) => swap(prev, index, index + 1));
  }

  // ── Field management ──
  function addField(sectionIndex: number) {
    mutateSections((draft) => {
      const order = draft[sectionIndex].fields.length + 1;
      draft[sectionIndex].fields.push({
        field_key: `field_${order}`,
        label: '',
        type: 'text',
        required: false,
        placeholder: '',
        options: [],
        validation: {},
        order,
      });
      return draft;
    });
  }

  function removeField(sectionIndex: number, fieldIndex: number) {
    mutateSections((draft) => {
      draft[sectionIndex].fields.splice(fieldIndex, 1);
      draft[sectionIndex].fields.forEach((f, i) => (f.order = i + 1));
      return draft;
    });
  }

  function updateField(sectionIndex: number, fieldIndex: number, patch: Partial<BuilderField>) {
    mutateSections((draft) => {
      draft[sectionIndex].fields[fieldIndex] = { ...draft[sectionIndex].fields[fieldIndex], ...patch };
      return draft;
    });
  }

  function updateFieldValidation(sectionIndex: number, fieldIndex: number, patch: Partial<FieldValidation>) {
    mutateSections((draft) => {
      const field = draft[sectionIndex].fields[fieldIndex];
      field.validation = { ...(field.validation ?? {}), ...patch };
      return draft;
    });
  }

  function onFieldLabelChange(si: number, fi: number, label: string) {
    mutateSections((draft) => {
      const field = draft[si].fields[fi];
      field.label = label;
      if (label) field.field_key = slugify(label) || `field_${fi + 1}`;
      return draft;
    });
  }

  function onFieldTypeChange(si: number, fi: number, type: FieldType) {
    mutateSections((draft) => {
      const field = draft[si].fields[fi];
      field.type = type;
      if (!hasOptions(type)) field.options = [];
      field.validation = {};
      return draft;
    });
  }

  function moveFieldUp(si: number, fi: number) {
    if (fi === 0) return;
    mutateSections((draft) => {
      draft[si].fields = swap(draft[si].fields, fi - 1, fi).map((f, i) => ({ ...f, order: i + 1 }));
      return draft;
    });
  }

  function moveFieldDown(si: number, fi: number) {
    mutateSections((draft) => {
      if (fi >= draft[si].fields.length - 1) return draft;
      draft[si].fields = swap(draft[si].fields, fi, fi + 1).map((f, i) => ({ ...f, order: i + 1 }));
      return draft;
    });
  }

  function onOptionsInput(si: number, fi: number, raw: string) {
    const options = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    updateField(si, fi, { options });
  }

  // ── Save ──
  function buildSchema(): FormSchema {
    return {
      version: existingTemplate?.version ?? 1,
      disease_id: Number(selectedDiseaseId),
      sections: sections.map((s, si) => ({
        section_key: s.section_key || slugify(s.label) || `section_${si + 1}`,
        label: s.label,
        order: si + 1,
        fields: s.fields.map((f, fi) => {
          const clean: BuilderField = {
            field_key: f.field_key || slugify(f.label) || `field_${fi + 1}`,
            label: f.label,
            type: f.type,
            required: f.required,
            order: fi + 1,
          };
          if (f.placeholder) clean.placeholder = f.placeholder;
          if (hasOptions(f.type) && f.options?.length) clean.options = f.options;
          const v = f.validation ?? {};
          const cleanV: FieldValidation = {};
          if (v.min !== undefined && v.min !== null) cleanV.min = v.min;
          if (v.max !== undefined && v.max !== null) cleanV.max = v.max;
          if (v.minLength !== undefined && v.minLength !== null) cleanV.minLength = v.minLength;
          if (v.maxLength !== undefined && v.maxLength !== null) cleanV.maxLength = v.maxLength;
          if (v.pattern?.trim()) cleanV.pattern = v.pattern.trim();
          if (v.minDate?.trim()) cleanV.minDate = v.minDate.trim();
          if (v.maxDate?.trim()) cleanV.maxDate = v.maxDate.trim();
          if (Object.keys(cleanV).length) clean.validation = cleanV;
          return clean;
        }),
      })),
    };
  }

  async function saveTemplate() {
    if (!selectedDiseaseId) {
      showToast('warn', 'Please select a disease first.');
      return;
    }
    if (!sections.length) {
      showToast('warn', 'Add at least one section.');
      return;
    }
    for (const section of sections) {
      if (!section.label.trim()) {
        showToast('warn', 'All sections must have a label.');
        return;
      }
      if (!section.fields.length) {
        showToast('warn', `Section "${section.label}" must have at least one field.`);
        return;
      }
      for (const field of section.fields) {
        if (!field.label.trim()) {
          showToast('warn', `All fields must have a label (section: "${section.label}").`);
          return;
        }
      }
    }

    if (isEdit && existingTemplate?.is_active) {
      const proceed = window.confirm(
        'This template is currently active. Saving will create a new version and deactivate the current one. Continue?',
      );
      if (!proceed) return;
    }

    setSaving(true);
    const schema = buildSchema();
    try {
      if (isEdit && templateId) {
        await apiClient.put(`/templates/${templateId}`, { schema });
      } else {
        await apiClient.post('/templates/', { disease_id: Number(selectedDiseaseId), schema });
      }
      showToast('success', 'Template saved successfully.');
      setTimeout(() => navigate('/admin/templates'), 1000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Failed to save template.');
      setSaving(false);
    }
  }

  function goBack() {
    navigate('/admin/templates');
  }

  // ── Render ──
  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{isEdit ? 'Edit Template' : 'New Template'}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>Visual JSON schema builder</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={goBack}>
            <i className="pi pi-arrow-left" /> Back
          </button>
          <button className="btn-primary" disabled={saving} onClick={saveTemplate}>
            {saving ? <><i className="pi pi-spin pi-spinner" /> Saving...</> : <><i className="pi pi-save" /> Save Template</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
          <i className="pi pi-spin pi-spinner" style={{ fontSize: '1.5rem' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* LEFT: builder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Disease selector */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="label">Disease <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <div className="select-wrapper">
                  <select
                    className="form-control"
                    style={{ width: '100%' }}
                    value={selectedDiseaseId}
                    disabled={isEdit}
                    onChange={(e) => setSelectedDiseaseId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select a disease</option>
                    {diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <span className="select-arrow" />
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Sections</h3>
                <button className="btn-secondary btn-sm" onClick={addSection}>
                  <i className="pi pi-plus" /> Add Section
                </button>
              </div>

              {sections.length === 0 && (
                <p style={{ color: 'var(--color-neutral-400)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                  No sections yet. Click "Add Section" to get started.
                </p>
              )}

              {sections.map((section, si) => (
                <div key={si} style={{ border: '1px solid var(--color-neutral-200)', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
                  {/* Section header */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--color-neutral-50)', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSection(si)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <i className={`pi ${expandedSections[si] ? 'pi-chevron-down' : 'pi-chevron-right'}`} style={{ fontSize: 12, color: 'var(--color-neutral-500)' }} />
                      {editingSectionIndex === si ? (
                        <input
                          type="text"
                          className="form-control"
                          value={section.label}
                          onChange={(e) => onSectionLabelChange(si, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Section name"
                          style={{ fontWeight: 600, fontSize: 13, padding: '2px 6px', height: 28, width: 200 }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-neutral-800)' }}>
                          {section.label || 'Untitled Section'}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>{section.fields.length} field(s)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn-icon" title="Rename section" onClick={() => startEditSectionLabel(si)}><i className="pi pi-pencil" /></button>
                      <button className="btn-icon" title="Move up" disabled={si === 0} onClick={() => moveSectionUp(si)}><i className="pi pi-arrow-up" /></button>
                      <button className="btn-icon" title="Move down" disabled={si === sections.length - 1} onClick={() => moveSectionDown(si)}><i className="pi pi-arrow-down" /></button>
                      <button className="btn-icon btn-icon-danger" title="Remove section" onClick={() => removeSection(si)}><i className="pi pi-trash" /></button>
                    </div>
                  </div>

                  {/* Section body */}
                  {expandedSections[si] && (
                    <div style={{ padding: 12, borderTop: '1px solid var(--color-neutral-200)' }}>
                      {section.fields.length === 0 && (
                        <p style={{ color: 'var(--color-neutral-400)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                          No fields. Click "Add Field" below.
                        </p>
                      )}

                      {section.fields.map((field, fi) => (
                        <div key={fi} style={{ border: '1px solid var(--color-neutral-200)', borderRadius: 6, padding: 12, marginBottom: 8, background: 'var(--surface-card)' }}>
                          {/* Top row */}
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ flex: 2, minWidth: 140 }}>
                              <label style={labelSm}>Label <span style={{ color: 'var(--color-error)' }}>*</span></label>
                              <input type="text" className="form-control" value={field.label} onChange={(e) => onFieldLabelChange(si, fi, e.target.value)} placeholder="Field label" style={{ width: '100%', fontSize: 12 }} />
                            </div>
                            <div style={{ flex: 1.2, minWidth: 130 }}>
                              <label style={labelSm}>Field key</label>
                              <input type="text" className="form-control" value={field.field_key} onChange={(e) => updateField(si, fi, { field_key: e.target.value })} placeholder="auto-generated" style={{ width: '100%', fontSize: 12, background: 'var(--color-neutral-50)' }} />
                            </div>
                            <div style={{ flex: 1.4, minWidth: 140 }}>
                              <label style={labelSm}>Type <span style={{ color: 'var(--color-error)' }}>*</span></label>
                              <div className="select-wrapper">
                                <select className="form-control" value={field.type} onChange={(e) => onFieldTypeChange(si, fi, e.target.value as FieldType)} style={{ width: '100%', fontSize: 12 }}>
                                  {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                                </select>
                                <span className="select-arrow" />
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 20 }}>
                              <label style={{ ...labelSm, marginBottom: 0 }}>Req.</label>
                              <input type="checkbox" checked={field.required} onChange={(e) => updateField(si, fi, { required: e.target.checked })} style={{ width: 16, height: 16 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 4, paddingTop: 20 }}>
                              <button className="btn-icon" title="Move up" disabled={fi === 0} onClick={() => moveFieldUp(si, fi)}><i className="pi pi-arrow-up" /></button>
                              <button className="btn-icon" title="Move down" disabled={fi === section.fields.length - 1} onClick={() => moveFieldDown(si, fi)}><i className="pi pi-arrow-down" /></button>
                              <button className="btn-icon btn-icon-danger" title="Remove field" onClick={() => removeField(si, fi)}><i className="pi pi-trash" /></button>
                            </div>
                          </div>

                          {/* Placeholder */}
                          <div style={{ marginTop: 8 }}>
                            <label style={labelSm}>Placeholder</label>
                            <input type="text" className="form-control" value={field.placeholder ?? ''} onChange={(e) => updateField(si, fi, { placeholder: e.target.value })} placeholder="Optional hint text" style={{ width: '100%', fontSize: 12 }} />
                          </div>

                          {/* Options */}
                          {hasOptions(field.type) && (
                            <div style={{ marginTop: 8 }}>
                              <label style={labelSm}>Options (one per line)</label>
                              <textarea
                                rows={3}
                                value={(field.options ?? []).join('\n')}
                                onChange={(e) => onOptionsInput(si, fi, e.target.value)}
                                placeholder={'Option 1\nOption 2\nOption 3'}
                                style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid var(--color-neutral-300)', borderRadius: 4, resize: 'vertical' }}
                              />
                            </div>
                          )}

                          {/* Validation rules */}
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-neutral-500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                              Validation Rules
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {isNumericType(field.type) && (
                                <>
                                  <ValidationNumber label="Min value" value={field.validation?.min} onChange={(v) => updateFieldValidation(si, fi, { min: v })} />
                                  <ValidationNumber label="Max value" value={field.validation?.max} onChange={(v) => updateFieldValidation(si, fi, { max: v })} />
                                </>
                              )}
                              {isStringType(field.type) && (
                                <>
                                  <ValidationNumber label="Min length" value={field.validation?.minLength} onChange={(v) => updateFieldValidation(si, fi, { minLength: v })} />
                                  <ValidationNumber label="Max length" value={field.validation?.maxLength} onChange={(v) => updateFieldValidation(si, fi, { maxLength: v })} />
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 160 }}>
                                    <label style={labelSm}>Pattern (regex)</label>
                                    <input type="text" className="form-control" value={field.validation?.pattern ?? ''} onChange={(e) => updateFieldValidation(si, fi, { pattern: e.target.value })} placeholder="e.g. ^[A-Z]+" style={{ width: '100%', fontSize: 12 }} />
                                  </div>
                                </>
                              )}
                              {isDateType(field.type) && (
                                <>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
                                    <label style={labelSm}>Min date</label>
                                    <input type="text" className="form-control" value={field.validation?.minDate ?? ''} onChange={(e) => updateFieldValidation(si, fi, { minDate: e.target.value })} placeholder="today or YYYY-MM-DD" style={{ width: '100%', fontSize: 12 }} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 120 }}>
                                    <label style={labelSm}>Max date</label>
                                    <input type="text" className="form-control" value={field.validation?.maxDate ?? ''} onChange={(e) => updateFieldValidation(si, fi, { maxDate: e.target.value })} placeholder="YYYY-MM-DD" style={{ width: '100%', fontSize: 12 }} />
                                  </div>
                                </>
                              )}
                              {!isNumericType(field.type) && !isStringType(field.type) && !isDateType(field.type) && (
                                <span style={{ fontSize: 12, color: 'var(--color-neutral-400)', padding: '4px 0' }}>
                                  No validation rules for this field type.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <button className="btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => addField(si)}>
                        <i className="pi pi-plus" /> Add Field
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: live preview */}
          <div className="card" style={{ padding: 16, position: 'sticky', top: 80 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="pi pi-eye" style={{ color: 'var(--color-primary)' }} />
              Live Preview
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-neutral-400)' }}>(read-only)</span>
            </h3>
            <TemplatePreview schema={previewSchema} />
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationNumber({ label, value, onChange }: { label: string; value?: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 80 }}>
      <label style={labelSm}>{label}</label>
      <input
        type="number"
        className="form-control"
        value={value === undefined || value === null ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder="—"
        style={{ width: 90, fontSize: 12 }}
      />
    </div>
  );
}

const labelSm: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-neutral-600)',
  display: 'block',
  marginBottom: 3,
};

export default TemplateBuilderPage;
