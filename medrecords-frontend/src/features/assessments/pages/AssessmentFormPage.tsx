/**
 * Assessment Form Page.
 *
 * 1:1 React replica of the Angular AssessmentFormComponent
 * (frontend/src/app/features/assessments/assessment-form.component.ts).
 *
 * Replicates:
 *  - Consent capture (Step 1)
 *  - Patient demographics with new/existing patient toggle + search (Step 2)
 *  - Disease + sub-disease selection and dynamic template form (Step 3)
 *  - Prescription grid with medicine autocomplete (Step 4)
 *  - Draft save vs submit, lock behaviour + lock-expiry countdown, PDF export,
 *    follow-up scheduling dialog, validation, and toasts (Step 5)
 *
 * Endpoints (relative to apiClient baseURL `/api/v1`):
 *  GET  /diseases/?page=1&page_size=100
 *  GET  /diseases/{id}/sub-diseases
 *  GET  /templates/disease/{id}/active
 *  GET  /patients/{id}
 *  GET  /patients/?page=1&page_size=100
 *  POST /patients/                       (register new patient)
 *  GET  /assessments/{id}
 *  POST /assessments/                    (create draft)
 *  PUT  /assessments/{id}                (save draft)
 *  POST /assessments/{id}/submit
 *  POST /prescriptions/assessment/{id}   (upsert rows)
 *  GET  /medicines?search=&page=1&page_size=20
 *  GET  /exports/assessments/{id}/pdf-data
 *  POST /followups
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { createTypedApiClient } from '@/shared/services/api/apiClient';
import { useAppSelector } from '@/app/store';

const apiClient = createTypedApiClient();

// ─── Models (mirror Angular template.service + assessment.service) ───────────

type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox_group'
  | 'textarea';

interface FormFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
}

interface FormField {
  field_key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: FormFieldValidation;
  order: number;
}

interface FormSection {
  section_key: string;
  label: string;
  order: number;
  fields: FormField[];
}

interface FormSchema {
  version: number;
  disease_id: number;
  sections: FormSection[];
}

interface FormTemplate {
  id: number;
  disease_id: number;
  disease_name?: string;
  version: number;
  is_active: boolean;
  schema: FormSchema;
  created_at: string;
  updated_at: string;
}

interface Disease {
  id: number;
  name: string;
  is_active: boolean;
}

interface SubDisease {
  id: number;
  disease_id: number;
  name: string;
  is_active: boolean;
}

interface PrescriptionRow {
  medicine_id: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface AssessmentPatient {
  first_name: string;
  last_name: string;
  patient_uid: string;
  date_of_birth: string;
  gender: string;
  contact_number: string;
  email: string | null;
}

interface AssessmentDetail {
  id: number;
  patient_id: number;
  doctor_id: number;
  disease_id: number;
  sub_disease_id: number | null;
  template_id: number;
  status: 'draft' | 'submitted' | 'locked';
  consent_given: boolean;
  submitted_at: string | null;
  lock_expires_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  disease_name?: string;
  sub_disease_name?: string | null;
  template_snapshot: FormSchema;
  form_data: Record<string, unknown>;
  prescriptions: PrescriptionRow[];
  patient: AssessmentPatient;
}

interface PatientDemographics {
  first_name: string;
  last_name: string;
  patient_uid: string;
  date_of_birth: string;
  gender: string;
  contact_number: string;
  email: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Imperative handles for the child form widgets (mirror Angular @ViewChild refs)
interface DynamicFormHandle {
  getFormData: () => Record<string, unknown>;
  isValid: () => boolean;
  markAllTouched: () => void;
}

interface PrescriptionGridHandle {
  getRows: () => PrescriptionRow[];
  isValid: () => boolean;
  markAllTouched: () => void;
}

const emptyDemographics: PatientDemographics = {
  first_name: '',
  last_name: '',
  patient_uid: '',
  date_of_birth: '',
  gender: '',
  contact_number: '',
  email: '',
};

// ═══════════════════════════════════════════════════════════════════════════
//  Dynamic Form (mirrors DynamicFormComponent — builds fields from schema)
// ═══════════════════════════════════════════════════════════════════════════

interface DynamicFormProps {
  schema: FormSchema;
  initialData: Record<string, unknown>;
  isReadonly: boolean;
}

function validateField(field: FormField, rawValue: unknown): string | null {
  const isArrayType = field.type === 'checkbox_group' || field.type === 'multiselect';
  const value = rawValue;

  // Required check
  if (field.required) {
    if (isArrayType) {
      if (!Array.isArray(value) || value.length === 0) return `${field.label} is required.`;
    } else if (value === null || value === undefined || value === '') {
      return `${field.label} is required.`;
    }
  }

  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (isArrayType && Array.isArray(value) && value.length === 0);
  if (empty) return null;

  const v = field.validation;
  if (!v) return null;

  if (field.type === 'number') {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      if (v.min !== undefined && num < v.min) return `${field.label} must be at least ${v.min}.`;
      if (v.max !== undefined && num > v.max) return `${field.label} must be at most ${v.max}.`;
    }
  }

  if (field.type === 'text' || field.type === 'textarea') {
    const str = String(value);
    if (v.minLength !== undefined && str.length < v.minLength)
      return `${field.label} must be at least ${v.minLength} characters.`;
    if (v.maxLength !== undefined && str.length > v.maxLength)
      return `${field.label} must be at most ${v.maxLength} characters.`;
    if (v.pattern) {
      try {
        if (!new RegExp(v.pattern).test(str)) return `${field.label} format is invalid.`;
      } catch {
        /* ignore invalid pattern */
      }
    }
  }

  if (field.type === 'date' && v.minDate) {
    const dateVal = new Date(String(value));
    if (!Number.isNaN(dateVal.getTime())) {
      const min =
        v.minDate === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)) : new Date(v.minDate);
      if (!Number.isNaN(min.getTime()) && dateVal < min)
        return `${field.label} must be on or after ${v.minDate === 'today' ? 'today' : v.minDate}.`;
    }
  }

  return null;
}

const DynamicForm = forwardRef<DynamicFormHandle, DynamicFormProps>(function DynamicForm(
  { schema, initialData, isReadonly },
  ref,
) {
  const buildInitial = useCallback((): Record<string, unknown> => {
    const data: Record<string, unknown> = {};
    for (const section of schema?.sections ?? []) {
      for (const field of section.fields ?? []) {
        const provided = initialData?.[field.field_key];
        if (provided !== undefined) {
          data[field.field_key] = provided;
        } else {
          data[field.field_key] = field.type === 'checkbox_group' || field.type === 'multiselect' ? [] : '';
        }
      }
    }
    return data;
  }, [schema, initialData]);

  const [formData, setFormData] = useState<Record<string, unknown>>(buildInitial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Rebuild when schema or initial data changes (mirrors ngOnChanges)
  useEffect(() => {
    setFormData(buildInitial());
    setTouched({});
  }, [buildInitial]);

  const setValue = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const markTouched = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  useImperativeHandle(
    ref,
    () => ({
      getFormData: () => ({ ...formData }),
      isValid: () => {
        for (const section of schema?.sections ?? []) {
          for (const field of section.fields ?? []) {
            if (validateField(field, formData[field.field_key])) return false;
          }
        }
        return true;
      },
      markAllTouched: () => {
        const all: Record<string, boolean> = {};
        for (const section of schema?.sections ?? []) {
          for (const field of section.fields ?? []) all[field.field_key] = true;
        }
        setTouched(all);
      },
    }),
    [formData, schema],
  );

  const sortedSections = [...(schema?.sections ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const renderField = (field: FormField) => {
    const value = formData[field.field_key];
    const error = touched[field.field_key] ? validateField(field, value) : null;
    const fieldId = `df-${field.field_key}`;
    const sortedOptions = field.options ?? [];

    let control: React.ReactNode;
    switch (field.type) {
      case 'number':
        control = (
          <input
            id={fieldId}
            type="number"
            className="form-control"
            placeholder={field.placeholder}
            value={value === null || value === undefined ? '' : String(value)}
            readOnly={isReadonly}
            disabled={isReadonly}
            min={field.validation?.min}
            max={field.validation?.max}
            onChange={(e) => setValue(field.field_key, e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={() => markTouched(field.field_key)}
            style={{ width: '100%' }}
          />
        );
        break;

      case 'date':
        control = (
          <input
            id={fieldId}
            type="date"
            className="form-control"
            value={String(value ?? '')}
            readOnly={isReadonly}
            disabled={isReadonly}
            min={field.validation?.minDate && field.validation.minDate !== 'today' ? field.validation.minDate : undefined}
            max={field.validation?.maxDate}
            onChange={(e) => setValue(field.field_key, e.target.value)}
            onBlur={() => markTouched(field.field_key)}
            style={{ width: '100%' }}
          />
        );
        break;

      case 'textarea':
        control = (
          <textarea
            id={fieldId}
            className="form-control"
            placeholder={field.placeholder}
            rows={3}
            value={String(value ?? '')}
            readOnly={isReadonly}
            disabled={isReadonly}
            onChange={(e) => setValue(field.field_key, e.target.value)}
            onBlur={() => markTouched(field.field_key)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        );
        break;

      case 'select':
        control = (
          <div className="select-wrapper">
            <select
              id={fieldId}
              className="form-control"
              value={String(value ?? '')}
              disabled={isReadonly}
              onChange={(e) => setValue(field.field_key, e.target.value)}
              onBlur={() => markTouched(field.field_key)}
              style={{ width: '100%' }}
            >
              <option value="">{field.placeholder ?? 'Select...'}</option>
              {sortedOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="select-arrow" />
          </div>
        );
        break;

      case 'multiselect': {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        control = (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {sortedOptions.map((opt) => {
              const checked = arr.includes(opt);
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isReadonly}
                    onChange={(e) => {
                      const next = e.target.checked ? [...arr, opt] : arr.filter((o) => o !== opt);
                      setValue(field.field_key, next);
                      markTouched(field.field_key);
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        );
        break;
      }

      case 'checkbox_group': {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        control = (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {sortedOptions.map((opt) => {
              const checked = arr.includes(opt);
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isReadonly}
                    onChange={(e) => {
                      const next = e.target.checked ? [...arr, opt] : arr.filter((o) => o !== opt);
                      setValue(field.field_key, next);
                      markTouched(field.field_key);
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        );
        break;
      }

      case 'radio':
        control = (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {sortedOptions.map((opt) => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="radio"
                  name={fieldId}
                  value={opt}
                  checked={value === opt}
                  disabled={isReadonly}
                  onChange={() => {
                    setValue(field.field_key, opt);
                    markTouched(field.field_key);
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
        );
        break;

      case 'text':
      default:
        control = (
          <input
            id={fieldId}
            type="text"
            className="form-control"
            placeholder={field.placeholder}
            value={String(value ?? '')}
            readOnly={isReadonly}
            disabled={isReadonly}
            maxLength={field.validation?.maxLength}
            onChange={(e) => setValue(field.field_key, e.target.value)}
            onBlur={() => markTouched(field.field_key)}
            style={{ width: '100%' }}
          />
        );
        break;
    }

    return (
      <div key={field.field_key} className="form-field-group" style={{ marginBottom: 16, flex: 1, minWidth: 240 }}>
        <label className="label" htmlFor={fieldId}>
          {field.label}
          {field.required && <span style={{ color: 'var(--color-error)' }}> *</span>}
        </label>
        {control}
        {error && <span style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 2, display: 'block' }}>{error}</span>}
      </div>
    );
  };

  return (
    <div>
      {sortedSections.map((section) => {
        const sortedFields = [...(section.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return (
          <fieldset
            key={section.section_key}
            style={{
              border: '1px solid var(--color-neutral-200)',
              borderRadius: 8,
              padding: '16px 18px',
              marginBottom: 16,
            }}
          >
            <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-neutral-700)', padding: '0 6px' }}>
              {section.label}
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>{sortedFields.map(renderField)}</div>
          </fieldset>
        );
      })}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  Prescription Grid (mirrors PrescriptionGridComponent)
// ═══════════════════════════════════════════════════════════════════════════

interface MedicineOption {
  id: number;
  name: string;
}

interface PrescriptionGridProps {
  initialRows: PrescriptionRow[];
  isReadonly: boolean;
}

function emptyPrescriptionRow(): PrescriptionRow {
  return { medicine_id: 0, medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' };
}

const PrescriptionGrid = forwardRef<PrescriptionGridHandle, PrescriptionGridProps>(function PrescriptionGrid(
  { initialRows, isReadonly },
  ref,
) {
  const [rows, setRows] = useState<PrescriptionRow[]>(initialRows.length ? initialRows.map((r) => ({ ...r })) : []);
  const [touched, setTouched] = useState<boolean[]>(() => initialRows.map(() => false));
  const [showAtLeastOneError, setShowAtLeastOneError] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<number, MedicineOption[]>>({});
  const [openRow, setOpenRow] = useState<number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Rebuild when initialRows changes (mirrors ngOnChanges)
  useEffect(() => {
    setRows(initialRows.length ? initialRows.map((r) => ({ ...r })) : []);
    setTouched(initialRows.map(() => false));
    setSuggestions({});
  }, [initialRows]);

  const isValid = useCallback((): boolean => {
    if (rows.length === 0) return false;
    return rows.some((r) => (r.medicine_name ?? '').trim().length > 0);
  }, [rows]);

  useImperativeHandle(
    ref,
    () => ({
      getRows: () => rows.map((r) => ({ ...r })),
      isValid,
      markAllTouched: () => {
        setTouched(rows.map(() => true));
        setShowAtLeastOneError(!isValid());
      },
    }),
    [rows, isValid],
  );

  function addRow() {
    setRows((prev) => [...prev, emptyPrescriptionRow()]);
    setTouched((prev) => [...prev, false]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setTouched((prev) => prev.filter((_, i) => i !== index));
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    if (showAtLeastOneError) {
      setTimeout(() => setShowAtLeastOneError(!isValid()), 0);
    }
  }

  function updateRow(index: number, patch: Partial<PrescriptionRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function markRowTouched(index: number) {
    setTouched((prev) => prev.map((t, i) => (i === index ? true : t)));
  }

  function searchMedicines(query: string, rowIndex: number) {
    updateRow(rowIndex, { medicine_name: query, medicine_id: 0 });
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const q = query.trim();
    if (!q) {
      setSuggestions((prev) => ({ ...prev, [rowIndex]: [] }));
      setOpenRow(null);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ items: MedicineOption[]; total: number }>('/medicines', {
          params: { search: q, page: 1, page_size: 20 },
        });
        setSuggestions((prev) => ({ ...prev, [rowIndex]: (res.data.items ?? []).map((m) => ({ id: m.id, name: m.name })) }));
        setOpenRow(rowIndex);
      } catch {
        setSuggestions((prev) => ({ ...prev, [rowIndex]: [] }));
      }
    }, 300);
  }

  function selectMedicine(medicine: MedicineOption, rowIndex: number) {
    updateRow(rowIndex, { medicine_id: medicine.id, medicine_name: medicine.name });
    markRowTouched(rowIndex);
    setOpenRow(null);
  }

  const thPrescStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--color-neutral-600)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--color-neutral-200)',
    whiteSpace: 'nowrap',
    background: 'var(--color-neutral-50)',
  };
  const tdPrescStyle: React.CSSProperties = {
    padding: '8px 12px',
    verticalAlign: 'top',
    borderBottom: '1px solid var(--color-neutral-100)',
  };
  const errorMsgStyle: React.CSSProperties = { fontSize: 11, color: 'var(--color-error)', display: 'block', marginTop: 2 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-neutral-900)', margin: 0, display: 'flex', alignItems: 'center' }}>
          <i className="pi pi-file-edit" style={{ color: 'var(--color-primary)', marginRight: 6 }} />
          Prescription
        </h3>
        {!isReadonly && (
          <button type="button" className="btn-secondary btn-sm" onClick={addRow}>
            <i className="pi pi-plus" /> Add Medicine
          </button>
        )}
      </div>

      {rows.length === 0 && (
        <div
          style={{
            padding: 20,
            textAlign: 'center',
            background: 'var(--color-neutral-50)',
            borderRadius: 8,
            border: '1px dashed var(--color-neutral-300)',
          }}
        >
          {isReadonly ? (
            <span style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>No prescriptions recorded.</span>
          ) : (
            <span style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>
              No medicines added yet. Click <strong>Add Medicine</strong> to start.
            </span>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--color-neutral-200)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...thPrescStyle, minWidth: 220 }}>Medicine *</th>
                <th style={{ ...thPrescStyle, minWidth: 120 }}>Dosage *</th>
                <th style={{ ...thPrescStyle, minWidth: 140 }}>Frequency *</th>
                <th style={{ ...thPrescStyle, minWidth: 120 }}>Duration *</th>
                <th style={{ ...thPrescStyle, minWidth: 180 }}>Instructions</th>
                {!isReadonly && <th style={{ ...thPrescStyle, width: 50 }} aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const nameInvalid = touched[i] && !(row.medicine_name ?? '').trim();
                const dosageInvalid = touched[i] && !(row.dosage ?? '').trim();
                const freqInvalid = touched[i] && !(row.frequency ?? '').trim();
                const durInvalid = touched[i] && !(row.duration ?? '').trim();
                const rowSuggestions = suggestions[i] ?? [];
                return (
                  <tr key={i}>
                    {/* Medicine */}
                    <td style={{ ...tdPrescStyle, minWidth: 220 }}>
                      {isReadonly ? (
                        <span style={{ display: 'block', padding: '4px 0' }}>{row.medicine_name || '—'}</span>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search medicine..."
                            value={row.medicine_name}
                            onChange={(e) => searchMedicines(e.target.value, i)}
                            onFocus={() => rowSuggestions.length && setOpenRow(i)}
                            onBlur={() => { markRowTouched(i); setTimeout(() => setOpenRow((cur) => (cur === i ? null : cur)), 150); }}
                            style={{ width: '100%' }}
                          />
                          {openRow === i && rowSuggestions.length > 0 && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 50,
                                background: '#fff',
                                border: '1px solid var(--color-neutral-200)',
                                borderRadius: 6,
                                boxShadow: 'var(--shadow-md)',
                                maxHeight: 200,
                                overflowY: 'auto',
                              }}
                            >
                              {rowSuggestions.map((m) => (
                                <div
                                  key={m.id}
                                  role="button"
                                  tabIndex={0}
                                  onMouseDown={(e) => { e.preventDefault(); selectMedicine(m, i); }}
                                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-800)' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-neutral-50)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  {m.name}
                                </div>
                              ))}
                            </div>
                          )}
                          {nameInvalid && <span style={errorMsgStyle}>Medicine is required.</span>}
                        </div>
                      )}
                    </td>

                    {/* Dosage */}
                    <td style={{ ...tdPrescStyle, minWidth: 120 }}>
                      {isReadonly ? (
                        <span style={{ display: 'block', padding: '4px 0' }}>{row.dosage || '—'}</span>
                      ) : (
                        <>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. 500mg"
                            value={row.dosage}
                            onChange={(e) => updateRow(i, { dosage: e.target.value })}
                            onBlur={() => markRowTouched(i)}
                            style={{ width: '100%' }}
                          />
                          {dosageInvalid && <span style={errorMsgStyle}>Dosage is required.</span>}
                        </>
                      )}
                    </td>

                    {/* Frequency */}
                    <td style={{ ...tdPrescStyle, minWidth: 140 }}>
                      {isReadonly ? (
                        <span style={{ display: 'block', padding: '4px 0' }}>{row.frequency || '—'}</span>
                      ) : (
                        <>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Twice daily"
                            value={row.frequency}
                            onChange={(e) => updateRow(i, { frequency: e.target.value })}
                            onBlur={() => markRowTouched(i)}
                            style={{ width: '100%' }}
                          />
                          {freqInvalid && <span style={errorMsgStyle}>Frequency is required.</span>}
                        </>
                      )}
                    </td>

                    {/* Duration */}
                    <td style={{ ...tdPrescStyle, minWidth: 120 }}>
                      {isReadonly ? (
                        <span style={{ display: 'block', padding: '4px 0' }}>{row.duration || '—'}</span>
                      ) : (
                        <>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. 7 days"
                            value={row.duration}
                            onChange={(e) => updateRow(i, { duration: e.target.value })}
                            onBlur={() => markRowTouched(i)}
                            style={{ width: '100%' }}
                          />
                          {durInvalid && <span style={errorMsgStyle}>Duration is required.</span>}
                        </>
                      )}
                    </td>

                    {/* Instructions */}
                    <td style={{ ...tdPrescStyle, minWidth: 180 }}>
                      {isReadonly ? (
                        <span style={{ display: 'block', padding: '4px 0' }}>{row.instructions || '—'}</span>
                      ) : (
                        <textarea
                          className="form-control"
                          placeholder="Optional instructions..."
                          rows={1}
                          value={row.instructions}
                          onChange={(e) => updateRow(i, { instructions: e.target.value })}
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                      )}
                    </td>

                    {/* Remove */}
                    {!isReadonly && (
                      <td style={{ ...tdPrescStyle, width: 50, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn-icon btn-icon-danger"
                          title="Remove row"
                          onClick={() => removeRow(i)}
                        >
                          <i className="pi pi-trash" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAtLeastOneError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#dc2626',
            fontSize: 13,
          }}
        >
          <i className="pi pi-exclamation-triangle" />
          At least one prescription with a medicine is required before submitting.
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  PDF export (mirrors ExportService.exportAssessmentPdf)
// ═══════════════════════════════════════════════════════════════════════════

function safeStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function safeDateFormat(value: unknown): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isoDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

async function exportAssessmentPdf(assessmentId: number): Promise<void> {
  const res = await apiClient.get<Record<string, unknown>>(`/exports/assessments/${assessmentId}/pdf-data`);
  const raw = res.data;

  const assessment = (raw['assessment'] ?? {}) as Record<string, unknown>;
  const patient = (raw['patient'] ?? {}) as Record<string, unknown>;
  const disease = (raw['disease'] ?? {}) as Record<string, unknown>;
  const prescRows = (raw['prescription_rows'] ?? []) as Record<string, unknown>[];

  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 14;
  const HEADER_HEIGHT = 32;

  const drawHeader = () => {
    const headerY = 6;
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('MEDRecords Portal', MARGIN, headerY + 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text('Patient Assessment Report', MARGIN, headerY + 13);
    doc.setDrawColor(237, 28, 36);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, HEADER_HEIGHT, PAGE_W - MARGIN, HEADER_HEIGHT);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = PAGE_H - 10;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    const timestamp = new Date().toLocaleString('en-IN');
    doc.text(`Generated: ${timestamp}  |  MEDRecords Portal  |  Page ${pageNum} of ${totalPages}`, MARGIN, footerY);
    doc.text('DISCLAIMER: This document is confidential and intended solely for the named recipient.', MARGIN, footerY + 4);
  };

  drawHeader();
  let y = HEADER_HEIGHT + 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(237, 28, 36);
  doc.text('Patient Information', MARGIN, y);
  y += 5;

  const patientRows: [string, string][] = [
    ['Patient UID', safeStr(patient['patient_uid'])],
    ['Full Name', `${safeStr(patient['first_name'])} ${safeStr(patient['last_name'])}`.trim()],
    ['Date of Birth', safeDateFormat(patient['date_of_birth'])],
    ['Gender', safeStr(patient['gender'])],
    ['Contact', safeStr(patient['contact_number'])],
    ['Email', safeStr(patient['email'])],
  ];
  autoTable(doc, {
    startY: y,
    head: [],
    body: patientRows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [60, 60, 60] }, 1: { textColor: [60, 60, 60] } },
    margin: { left: MARGIN, right: MARGIN },
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(237, 28, 36);
  doc.text('Assessment Details', MARGIN, y);
  y += 5;

  const assessmentRows: [string, string][] = [
    ['Disease', safeStr(disease['name'])],
    ['Status', safeStr(assessment['status'])],
    ['Visit Date', safeDateFormat(assessment['submitted_at'] ?? assessment['created_at'])],
    ['Consent', assessment['consent_given'] ? 'Yes' : 'No'],
  ];
  autoTable(doc, {
    startY: y,
    head: [],
    body: assessmentRows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [60, 60, 60] }, 1: { textColor: [60, 60, 60] } },
    margin: { left: MARGIN, right: MARGIN },
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  const formData = (assessment['form_data'] ?? {}) as Record<string, unknown>;
  const templateSnapshot = (assessment['template_snapshot'] ?? {}) as Record<string, unknown>;
  const labelMap: Record<string, string> = {};
  const sections = (templateSnapshot['sections'] ?? []) as Array<Record<string, unknown>>;
  for (const section of sections) {
    const fields = (section['fields'] ?? []) as Array<Record<string, unknown>>;
    for (const field of fields) {
      const key = String(field['field_key'] ?? '');
      if (key) labelMap[key] = String(field['label'] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()));
    }
  }

  if (formData && Object.keys(formData).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('Clinical Assessment', MARGIN, y);
    y += 5;

    const formRows: [string, string][] = [];
    for (const [key, value] of Object.entries(formData)) {
      const label = labelMap[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      const val = Array.isArray(value) ? (value as unknown[]).join(', ') : safeStr(value);
      formRows.push([label, val]);
    }
    autoTable(doc, {
      startY: y,
      head: [],
      body: formRows,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65, textColor: [60, 60, 60] }, 1: { textColor: [40, 40, 40] } },
      alternateRowStyles: { fillColor: [252, 245, 245] },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => { drawHeader(); },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  }

  if (prescRows.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(237, 28, 36);
    doc.text('Prescriptions', MARGIN, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions']],
      body: prescRows.map((p) => [
        safeStr(p['medicine_name']),
        safeStr(p['dosage']),
        safeStr(p['frequency']),
        safeStr(p['duration']),
        safeStr(p['instructions']),
      ]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [237, 28, 36], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 248, 248] },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => { drawHeader(); },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const patientUid = safeStr(patient['patient_uid']) || String(assessmentId);
  const visitDateFn = isoDay(String(assessment['submitted_at'] ?? assessment['created_at'] ?? ''));
  doc.save(`MEDRecords_Patient_${patientUid}_Visit_${visitDateFn || 'unknown'}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Status badge
// ═══════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const key = (status || '').toLowerCase();
  const colorMap: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' },
    submitted: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' },
    locked: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' },
    default: { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' },
  };
  const config = colorMap[key] ?? colorMap.default;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: config.bg,
        color: config.text,
      }}
    >
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Assessment Form Page (mirrors AssessmentFormComponent)
// ═══════════════════════════════════════════════════════════════════════════

interface PatientSearchOption {
  id: number;
  displayLabel: string;
}

export function AssessmentFormPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const routeId = params.id ? Number(params.id) : null;
  const queryPatientId = searchParams.get('patientId') ? Number(searchParams.get('patientId')) : null;

  // Core state
  const [assessmentId, setAssessmentId] = useState<number | null>(routeId);
  const [patientId, setPatientId] = useState<number | null>(queryPatientId);
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  // Reference data
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [subDiseases, setSubDiseases] = useState<SubDisease[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null);
  const [initialFormData, setInitialFormData] = useState<Record<string, unknown>>({});
  const [initialPrescriptionRows, setInitialPrescriptionRows] = useState<PrescriptionRow[]>([]);
  const [diseaseLoadError, setDiseaseLoadError] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState(false);

  // Selections
  const [consentGiven, setConsentGiven] = useState(false);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<number | null>(null);
  const [selectedSubDiseaseId, setSelectedSubDiseaseId] = useState<number | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Patient mode
  const [patientMode, setPatientMode] = useState<'new' | 'existing'>('new');
  const [patientSearchResults, setPatientSearchResults] = useState<PatientSearchOption[]>([]);
  const [selectedExistingPatientId, setSelectedExistingPatientId] = useState<number | ''>('');
  const [demographics, setDemographics] = useState<PatientDemographics>({ ...emptyDemographics });

  // Lock countdown
  const [lockCountdown, setLockCountdown] = useState<string | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval>>();

  // Toast
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);
  const showToast = useCallback((type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Child refs
  const dynamicFormRef = useRef<DynamicFormHandle>(null);
  const prescriptionGridRef = useRef<PrescriptionGridHandle>(null);

  const isNewMode = assessmentId === null;
  const isLockedMode = assessment?.status === 'locked';

  const canSubmit = consentGiven && !!selectedDiseaseId && !!activeTemplate;

  // ── Data loading ──
  const loadDiseases = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: Disease[] }>('/diseases/', { params: { page: 1, page_size: 100 } });
      setDiseases(res.data.items ?? []);
    } catch {
      setDiseaseLoadError(true);
    }
  }, []);

  const loadAllPatients = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedResponse<{ id: number; first_name: string; last_name: string; patient_uid: string }>>(
        '/patients/',
        { params: { page: 1, page_size: 100 } },
      );
      setPatientSearchResults(
        (res.data.items ?? []).map((p) => ({ id: p.id, displayLabel: `${p.first_name} ${p.last_name} — ${p.patient_uid}` })),
      );
    } catch {
      /* non-critical */
    }
  }, []);

  const loadSubDiseases = useCallback(async (diseaseId: number) => {
    try {
      const res = await apiClient.get<SubDisease[]>(`/diseases/${diseaseId}/sub-diseases`);
      setSubDiseases(res.data ?? []);
    } catch {
      setSubDiseases([]);
    }
  }, []);

  const loadActiveTemplate = useCallback(async (diseaseId: number) => {
    setTemplateLoading(true);
    setTemplateLoadError(false);
    try {
      const res = await apiClient.get<FormTemplate>(`/templates/disease/${diseaseId}/active`);
      setActiveTemplate(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) setTemplateLoadError(true);
      setActiveTemplate(null);
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  const startLockCountdown = useCallback((lockExpiresAt: string) => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    const tick = () => {
      const diff = new Date(lockExpiresAt).getTime() - Date.now();
      if (diff <= 0) {
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        setLockCountdown(null);
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setLockCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      );
    };
    tick();
    countdownInterval.current = setInterval(tick, 1000);
  }, []);

  const loadPatientForNew = useCallback(async (pid: number) => {
    try {
      const res = await apiClient.get<Record<string, unknown>>(`/patients/${pid}`);
      const raw = res.data;
      const pat = ((raw['patient'] as Record<string, unknown>) ?? raw) as Record<string, unknown>;
      setDemographics({
        first_name: safeStr(pat['first_name']),
        last_name: safeStr(pat['last_name']),
        patient_uid: safeStr(pat['patient_uid']),
        date_of_birth: safeStr(pat['date_of_birth']),
        gender: safeStr(pat['gender']),
        contact_number: safeStr(pat['contact_number']),
        email: safeStr(pat['email']),
      });
      setPatientId(pid);
    } catch {
      showToast('error', 'Failed to load patient data.');
    }
  }, [showToast]);

  const loadExistingAssessment = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<AssessmentDetail>(`/assessments/${id}`);
      const detail = res.data;
      setAssessment(detail);
      setPatientId(detail.patient_id);
      const p = detail.patient;
      setDemographics({
        first_name: p.first_name,
        last_name: p.last_name,
        patient_uid: p.patient_uid,
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        contact_number: p.contact_number,
        email: p.email ?? '',
      });
      setConsentGiven(detail.consent_given);
      setSelectedDiseaseId(detail.disease_id);
      setSelectedSubDiseaseId(detail.sub_disease_id);
      loadSubDiseases(detail.disease_id);
      setActiveTemplate({
        id: detail.template_id,
        disease_id: detail.disease_id,
        version: 1,
        is_active: true,
        schema: detail.template_snapshot,
        created_at: '',
        updated_at: '',
      });
      setInitialFormData(detail.form_data ?? {});
      setInitialPrescriptionRows(detail.prescriptions ?? []);
      if (detail.status === 'submitted' && detail.lock_expires_at) {
        startLockCountdown(detail.lock_expires_at);
      }
    } catch {
      showToast('error', 'Failed to load assessment.');
    } finally {
      setLoading(false);
    }
  }, [loadSubDiseases, startLockCountdown, showToast]);

  // Init (mirrors ngOnInit)
  useEffect(() => {
    loadDiseases();
    loadAllPatients();
    if (routeId) {
      setPatientMode('existing');
      loadExistingAssessment(routeId);
    } else if (queryPatientId) {
      setPatientMode('existing');
      loadPatientForNew(queryPatientId);
      setLoading(false);
    } else {
      setPatientMode('new');
      setLoading(false);
    }
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ──
  function onDiseaseChange(value: number | null) {
    setSelectedDiseaseId(value);
    setSelectedSubDiseaseId(null);
    setSubDiseases([]);
    setActiveTemplate(null);
    setTemplateLoadError(false);
    if (!value) return;
    loadSubDiseases(value);
    loadActiveTemplate(value);
  }

  function switchPatientMode(mode: 'new' | 'existing') {
    setPatientMode(mode);
    setPatientId(null);
    setSelectedExistingPatientId('');
    setDemographics({ ...emptyDemographics });
  }

  async function onExistingPatientSelect(value: number | '') {
    setSelectedExistingPatientId(value);
    if (!value) {
      setPatientId(null);
      setDemographics({ ...emptyDemographics });
      return;
    }
    await loadPatientForNew(Number(value));
  }

  function updateDemographic(field: keyof PatientDemographics, value: string) {
    setDemographics((prev) => ({ ...prev, [field]: value }));
  }

  function demographicsValid(): boolean {
    return (
      !!demographics.first_name.trim() &&
      !!demographics.last_name.trim() &&
      !!demographics.date_of_birth.trim() &&
      !!demographics.gender.trim() &&
      !!demographics.contact_number.trim()
    );
  }

  async function registerNewPatient(): Promise<number> {
    const res = await apiClient.post<{ id: number; first_name: string; last_name: string; patient_uid: string; date_of_birth: string; gender: string; contact_number: string; email: string | null }>(
      '/patients/',
      {
        first_name: demographics.first_name,
        last_name: demographics.last_name,
        date_of_birth: demographics.date_of_birth,
        gender: demographics.gender,
        contact_number: demographics.contact_number,
        email: demographics.email || null,
      },
    );
    const patient = res.data;
    setPatientId(patient.id);
    setPatientMode('existing');
    setDemographics({
      first_name: patient.first_name,
      last_name: patient.last_name,
      patient_uid: patient.patient_uid,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      contact_number: patient.contact_number,
      email: patient.email ?? '',
    });
    return patient.id;
  }

  async function upsertPrescriptions(aid: number, rows: PrescriptionRow[]): Promise<void> {
    await apiClient.post(`/prescriptions/assessment/${aid}`, rows);
  }

  // ── Save draft ──
  async function saveDraft() {
    if (savingDraft || submitting) return;
    const formData = dynamicFormRef.current?.getFormData() ?? {};
    const rows = prescriptionGridRef.current?.getRows() ?? [];
    const doctorId = user?.id;
    if (!doctorId) {
      showToast('error', 'Not authenticated.');
      return;
    }

    setSavingDraft(true);
    try {
      if (assessmentId) {
        const res = await apiClient.put<AssessmentDetail>(`/assessments/${assessmentId}`, {
          disease_id: selectedDiseaseId ?? undefined,
          sub_disease_id: selectedSubDiseaseId,
          template_id: activeTemplate?.id,
          form_data: formData,
          consent_given: consentGiven,
        });
        setAssessment((prev) => (prev ? { ...prev, ...res.data } : res.data));
        await upsertPrescriptions(assessmentId, rows);
        showToast('success', 'Draft saved.');
      } else {
        if (!selectedDiseaseId || !activeTemplate) {
          showToast('warn', 'Please select a disease with an active template before saving.');
          setSavingDraft(false);
          return;
        }
        if (patientMode === 'existing' && !patientId) {
          showToast('warn', 'Please select an existing patient.');
          setSavingDraft(false);
          return;
        }
        if (patientMode === 'new' && !demographicsValid()) {
          showToast('warn', 'Please fill in all required patient fields.');
          setSavingDraft(false);
          return;
        }

        const pid = patientMode === 'new' ? await registerNewPatient() : patientId!;
        const created = await apiClient.post<AssessmentDetail>('/assessments/', {
          patient_id: pid,
          doctor_id: doctorId,
          disease_id: selectedDiseaseId,
          sub_disease_id: selectedSubDiseaseId,
          template_id: activeTemplate.id,
          form_data: formData,
          consent_given: consentGiven,
        });
        setAssessmentId(created.data.id);
        setAssessment(created.data);
        await upsertPrescriptions(created.data.id, rows);
        showToast('success', 'Draft created.');
        navigate(`/doctor/assessments/${created.data.id}`, { replace: true });
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Failed to save draft.');
    } finally {
      setSavingDraft(false);
    }
  }

  // ── Submit ──
  async function submitAssessment() {
    setSubmitAttempted(true);

    const prescriptionValid = prescriptionGridRef.current?.isValid() ?? false;
    prescriptionGridRef.current?.markAllTouched();
    const dynamicFormValid = dynamicFormRef.current?.isValid() ?? true;
    dynamicFormRef.current?.markAllTouched();

    if (!consentGiven) { showToast('warn', 'Please confirm patient consent.'); return; }
    if (!selectedDiseaseId) { showToast('warn', 'Please select a disease.'); return; }
    if (!activeTemplate) { showToast('warn', 'No active template available for this disease.'); return; }
    if (!dynamicFormValid) { showToast('warn', 'Please fill in all required fields.'); return; }
    if (!prescriptionValid) { showToast('warn', 'At least one prescription is required.'); return; }

    const doctorId = user?.id;
    if (!doctorId) { showToast('error', 'Not authenticated.'); return; }

    setSubmitting(true);
    const formData = dynamicFormRef.current?.getFormData() ?? {};
    const rows = prescriptionGridRef.current?.getRows() ?? [];

    try {
      let aid = assessmentId;
      if (!aid) {
        if (patientMode === 'existing' && !patientId) {
          showToast('error', 'No patient selected.');
          setSubmitting(false);
          return;
        }
        if (patientMode === 'new' && !demographicsValid()) {
          showToast('warn', 'Please fill in all required patient fields.');
          setSubmitting(false);
          return;
        }
        const pid = patientMode === 'new' ? await registerNewPatient() : patientId!;
        const created = await apiClient.post<AssessmentDetail>('/assessments/', {
          patient_id: pid,
          doctor_id: doctorId,
          disease_id: selectedDiseaseId,
          sub_disease_id: selectedSubDiseaseId,
          template_id: activeTemplate.id,
          form_data: formData,
          consent_given: consentGiven,
        });
        aid = created.data.id;
        setAssessmentId(aid);
      }

      await apiClient.put(`/assessments/${aid}`, {
        disease_id: selectedDiseaseId,
        sub_disease_id: selectedSubDiseaseId,
        template_id: activeTemplate.id,
        form_data: formData,
        consent_given: consentGiven,
      });
      await upsertPrescriptions(aid!, rows);
      const submitted = await apiClient.post<AssessmentDetail>(`/assessments/${aid}/submit`, {});
      setAssessment((prev) => (prev ? { ...prev, ...submitted.data } : submitted.data));
      showToast('success', 'Assessment submitted successfully.');
      // Redirect to the doctor dashboard after a short delay so the success toast is visible.
      setTimeout(() => navigate('/doctor/dashboard', { replace: true }), 1000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Failed to submit assessment.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Export PDF ──
  async function exportPdf() {
    if (!assessmentId) {
      showToast('warn', 'Please save the assessment first.');
      return;
    }
    try {
      await exportAssessmentPdf(assessmentId);
    } catch {
      showToast('error', 'Failed to export assessment as PDF.');
    }
  }

  function goBack() {
    if (patientId) navigate(`/doctor/patients/${patientId}`);
    else navigate('/doctor/dashboard');
  }

  const readonly = isLockedMode;

  // ── Render ──
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-secondary btn-sm" onClick={goBack}>
            <i className="pi pi-arrow-left" /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-neutral-900)' }}>
              {isNewMode ? 'New Assessment' : isLockedMode ? 'View Assessment' : 'Edit Assessment'}
            </h1>
            {assessment && <StatusBadge status={assessment.status} />}
          </div>
        </div>
        {assessment?.status === 'submitted' && lockCountdown && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: '#fefce8',
              border: '1px solid #fde047',
              borderRadius: 8,
              color: '#854d0e',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <i className="pi pi-clock" />
            <span>Locks in: <strong>{lockCountdown}</strong></span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0' }}>
          <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem', color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-neutral-500)', fontSize: 14 }}>Loading assessment...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* STEP 1: Consent */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Step 1 — Consent</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: 'var(--color-neutral-50)',
                  border: '1px solid var(--color-neutral-200)',
                  borderRadius: 8,
                  padding: 16,
                  color: 'var(--color-neutral-700)',
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                <p style={{ margin: 0 }}>
                  I, the undersigned doctor, confirm that I have obtained informed consent from the patient
                  for collecting, processing, and storing their medical data in the MEDRecords portal.
                  The patient has been informed of their rights regarding data access, correction, and deletion
                  in accordance with applicable data protection regulations.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="consent-checkbox"
                  checked={consentGiven}
                  disabled={readonly}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-primary)', flexShrink: 0 }}
                />
                <label htmlFor="consent-checkbox" style={{ fontSize: 14, color: 'var(--color-neutral-800)', cursor: 'pointer', fontWeight: 500 }}>
                  I confirm the patient has given their informed consent. <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
              </div>
              {submitAttempted && !consentGiven && (
                <span style={{ fontSize: 12, color: 'var(--color-error)' }}>Consent is required before submitting.</span>
              )}
            </div>
          </fieldset>

          {/* STEP 2: Patient Demographics */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Step 2 — Patient Demographics</legend>

            {isNewMode && (
              <div
                style={{
                  display: 'flex',
                  marginBottom: 18,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1.5px solid #dee2e6',
                  width: 'fit-content',
                }}
              >
                {(['new', 'existing'] as const).map((mode, idx) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchPatientMode(mode)}
                    style={{
                      padding: '8px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      borderRight: idx === 0 ? '1px solid #dee2e6' : 'none',
                      background: patientMode === mode ? 'var(--color-primary)' : '#fff',
                      color: patientMode === mode ? '#fff' : 'var(--color-neutral-600)',
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'new' ? 'New Patient' : 'Existing Patient'}
                  </button>
                ))}
              </div>
            )}

            {patientMode === 'existing' && (
              <div style={{ marginBottom: 16, maxWidth: 420 }}>
                <label className="label">Search Patient <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <div className="select-wrapper">
                  <select
                    className="form-control"
                    style={{ width: '100%' }}
                    value={selectedExistingPatientId}
                    disabled={readonly || !isNewMode}
                    onChange={(e) => onExistingPatientSelect(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select a patient...</option>
                    {patientSearchResults.map((p) => (
                      <option key={p.id} value={p.id}>{p.displayLabel}</option>
                    ))}
                  </select>
                  <span className="select-arrow" />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <DemographicField label="First Name" required value={demographics.first_name} readOnly={readonly || patientMode === 'existing'} onChange={(v) => updateDemographic('first_name', v)} placeholder="First name" />
                <DemographicField label="Last Name" required value={demographics.last_name} readOnly={readonly || patientMode === 'existing'} onChange={(v) => updateDemographic('last_name', v)} placeholder="Last name" />
                <DemographicField label="Patient UID" value={demographics.patient_uid} readOnly onChange={() => {}} placeholder="" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <DemographicField label="Date of Birth" required type="date" value={demographics.date_of_birth} readOnly={readonly || patientMode === 'existing'} onChange={(v) => updateDemographic('date_of_birth', v)} placeholder="YYYY-MM-DD" />
                <DemographicField label="Gender" required value={demographics.gender} readOnly={readonly || patientMode === 'existing'} onChange={(v) => updateDemographic('gender', v)} placeholder="Gender" />
                <DemographicField label="Contact Number" required value={demographics.contact_number} readOnly={readonly || patientMode === 'existing'} onChange={(v) => updateDemographic('contact_number', v)} placeholder="Contact number" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <DemographicField label="Email" type="email" value={demographics.email} readOnly={readonly || patientMode === 'existing'} onChange={(v) => updateDemographic('email', v)} placeholder="Email address" />
              </div>
            </div>
          </fieldset>

          {/* STEP 3: Disease & Clinical Form */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Step 3 — Disease &amp; Clinical Form</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 240, maxWidth: 360 }}>
                <label className="label" htmlFor="disease-select">Disease <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <div className="select-wrapper">
                  <select
                    id="disease-select"
                    className="form-control"
                    style={{ width: '100%' }}
                    value={selectedDiseaseId ?? ''}
                    disabled={readonly || diseaseLoadError}
                    onChange={(e) => onDiseaseChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select disease...</option>
                    {diseases.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <span className="select-arrow" />
                </div>
                {submitAttempted && !selectedDiseaseId && (
                  <span style={{ fontSize: 12, color: 'var(--color-error)' }}>Disease is required.</span>
                )}
              </div>

              {subDiseases.length > 0 && (
                <div style={{ flex: 1, minWidth: 240, maxWidth: 360 }}>
                  <label className="label" htmlFor="subdisease-select">Sub-Disease</label>
                  <div className="select-wrapper">
                    <select
                      id="subdisease-select"
                      className="form-control"
                      style={{ width: '100%' }}
                      value={selectedSubDiseaseId ?? ''}
                      disabled={readonly}
                      onChange={(e) => setSelectedSubDiseaseId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Select sub-disease (optional)...</option>
                      {subDiseases.map((sd) => (
                        <option key={sd.id} value={sd.id}>{sd.name}</option>
                      ))}
                    </select>
                    <span className="select-arrow" />
                  </div>
                </div>
              )}
            </div>

            {templateLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: 'var(--color-neutral-500)', fontSize: 14 }}>
                <i className="pi pi-spin pi-spinner" /> Loading form template...
              </div>
            )}

            {!templateLoading && selectedDiseaseId && !activeTemplate && !templateLoadError && (
              <div role="alert" style={infoMsgStyle}>
                <i className="pi pi-info-circle" />
                No active template found for the selected disease. Form submission is disabled until an admin activates a template for this disease.
              </div>
            )}

            {templateLoadError && (
              <div role="alert" style={{ ...infoMsgStyle, background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                <i className="pi pi-exclamation-triangle" />
                Failed to load form template. Please try re-selecting the disease.
              </div>
            )}

            {activeTemplate && activeTemplate.schema && !templateLoading && (
              <div style={{ marginTop: 16 }}>
                <DynamicForm ref={dynamicFormRef} schema={activeTemplate.schema} initialData={initialFormData} isReadonly={readonly} />
              </div>
            )}
          </fieldset>

          {/* STEP 4: Prescriptions */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Step 4 — Prescriptions</legend>
            <PrescriptionGrid ref={prescriptionGridRef} isReadonly={readonly} initialRows={initialPrescriptionRows} />
          </fieldset>

          {/* STEP 5: Action Bar */}
          <div style={actionBarStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!readonly && (
                <button type="button" className="btn-secondary" disabled={savingDraft || submitting} onClick={saveDraft}>
                  {savingDraft ? <><i className="pi pi-spin pi-spinner" /> Saving...</> : <><i className="pi pi-save" /> Save Draft</>}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" className="btn-secondary" disabled={!assessmentId} onClick={exportPdf}>
                <i className="pi pi-file-pdf" /> Export PDF
              </button>
              {!readonly && (
                <button type="button" className="btn-primary" disabled={savingDraft || submitting || !canSubmit} onClick={submitAssessment}>
                  {submitting ? <><i className="pi pi-spin pi-spinner" /> Submitting...</> : <><i className="pi pi-check-circle" /> Submit Assessment</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small presentational helpers ──

interface DemographicFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  type?: string;
}

function DemographicField({ label, value, onChange, readOnly, required, placeholder, type = 'text' }: DemographicFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
      <label className="label">
        {label}
        {required && <span style={{ color: 'var(--color-error)' }}> *</span>}
      </label>
      <input
        type={type}
        className="form-control"
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      />
    </div>
  );
}

const fieldsetStyle: React.CSSProperties = {
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 8,
  padding: '16px 18px',
  background: 'var(--surface-card)',
};

const legendStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  color: 'var(--color-neutral-700)',
  padding: '0 6px',
};

const infoMsgStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '14px 16px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  color: '#1d4ed8',
  fontSize: 14,
  marginTop: 8,
};

const actionBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  background: 'var(--surface-card)',
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 12,
  position: 'sticky',
  bottom: 16,
  zIndex: 10,
  boxShadow: 'var(--shadow-md)',
  flexWrap: 'wrap',
  gap: 12,
};

export default AssessmentFormPage;
