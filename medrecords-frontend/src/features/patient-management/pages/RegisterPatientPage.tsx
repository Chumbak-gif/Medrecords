/**
 * Register Patient Page.
 * Matches Angular RegisterPatientComponent - patient registration form
 * with validation and duplicate contact-number check.
 */

import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface Patient {
  id: number;
  patient_uid: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  contact_number: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

interface PaginatedResponse {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
}

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

const apiClient = createTypedApiClient();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPatientPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.startsWith('/admin') ? '/admin' : '/doctor';

  const today = new Date();
  const maxDobStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');

  // Touched state (mirrors Angular touched behavior)
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [checkingContact, setCheckingContact] = useState(false);
  const [contactDuplicateWarning, setContactDuplicateWarning] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const toastTimeout = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 5000);
  };

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  // ── Validation ──────────────────────────────────────────────────────────
  const emailInvalid = email.trim() !== '' && !EMAIL_REGEX.test(email.trim());
  const formInvalid =
    !firstName.trim() ||
    !lastName.trim() ||
    !dateOfBirth ||
    !gender ||
    !contactNumber.trim() ||
    emailInvalid;

  // ── Duplicate contact check ──────────────────────────────────────────────
  async function checkDuplicateContact() {
    const contact = contactNumber.trim();
    if (!contact) {
      setContactDuplicateWarning(false);
      return;
    }
    setCheckingContact(true);
    setContactDuplicateWarning(false);
    try {
      const res = await apiClient.get<PaginatedResponse>('/patients/', {
        params: { search: contact, page: 1, page_size: 5 },
      });
      const match = res.data.items.some(p => p.contact_number === contact);
      setContactDuplicateWarning(match);
    } catch {
      /* ignore */
    }
    setCheckingContact(false);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formInvalid) {
      setTouched({
        first_name: true,
        last_name: true,
        date_of_birth: true,
        gender: true,
        contact_number: true,
        email: true,
      });
      return;
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth, // already YYYY-MM-DD from date input
      gender,
      contact_number: contactNumber.trim(),
      email: email.trim() || null,
    };

    setSaving(true);
    try {
      const res = await apiClient.post<Patient>('/patients/', payload);
      const patient = res.data;
      showToast('success', `${patient.first_name} ${patient.last_name} registered as ${patient.patient_uid}`);
      setSaving(false);
      navigate(`${prefix}/patients/${patient.id}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Registration failed. Please try again.');
      setSaving(false);
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  function cancel() {
    navigate(`${prefix}/patients`);
  }

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Register New Patient</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Fill in the patient's details below
          </p>
        </div>
        <button className="btn-secondary" onClick={cancel}>
          <i className="pi pi-arrow-left" /> Back
        </button>
      </div>

      {/* Form Card */}
      <div className="card" style={{ maxWidth: 680 }}>
        <form onSubmit={onSubmit} noValidate>

          {/* Row 1: First Name / Last Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-field-group">
              <label className="label">
                First Name <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ramesh"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={() => markTouched('first_name')}
                style={{ width: '100%' }}
              />
              {!firstName.trim() && touched.first_name && (
                <span style={{ color: 'var(--color-error)', fontSize: 12 }}>First name is required</span>
              )}
            </div>

            <div className="form-field-group">
              <label className="label">
                Last Name <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Sharma"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => markTouched('last_name')}
                style={{ width: '100%' }}
              />
              {!lastName.trim() && touched.last_name && (
                <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Last name is required</span>
              )}
            </div>
          </div>

          {/* Row 2: DOB / Gender */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-field-group">
              <label className="label">
                Date of Birth <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="date"
                className="form-control"
                placeholder="DD/MM/YYYY"
                value={dateOfBirth}
                max={maxDobStr}
                onChange={(e) => setDateOfBirth(e.target.value)}
                onBlur={() => markTouched('date_of_birth')}
                style={{ width: '100%' }}
              />
              {!dateOfBirth && touched.date_of_birth && (
                <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Date of birth is required</span>
              )}
            </div>

            <div className="form-field-group">
              <label className="label">
                Gender <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                className="form-control"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                onBlur={() => markTouched('gender')}
                style={{ width: '100%' }}
              >
                <option value="" disabled>Select gender</option>
                {GENDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {!gender && touched.gender && (
                <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Gender is required</span>
              )}
            </div>
          </div>

          {/* Row 3: Contact Number */}
          <div className="form-field-group" style={{ marginBottom: 16 }}>
            <label className="label">
              Contact Number <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="tel"
              className="form-control"
              placeholder="e.g. 9876543210"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              onBlur={() => { markTouched('contact_number'); checkDuplicateContact(); }}
              style={{ width: '100%' }}
            />
            {!contactNumber.trim() && touched.contact_number && (
              <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Contact number is required</span>
            )}
            {contactDuplicateWarning && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6,
                fontSize: 12, color: '#92400e', marginTop: 4,
              }}>
                <i className="pi pi-exclamation-triangle" style={{ color: '#d97706' }} />
                A patient with this contact number already exists. Please verify before registering.
              </div>
            )}
            {checkingContact && (
              <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
                <i className="pi pi-spin pi-spinner" style={{ fontSize: 11 }} /> Checking...
              </span>
            )}
          </div>

          {/* Row 4: Email (optional) */}
          <div className="form-field-group" style={{ marginBottom: 24 }}>
            <label className="label">
              Email <span style={{ color: 'var(--color-neutral-400)', fontSize: 12 }}>(optional)</span>
            </label>
            <input
              type="email"
              className="form-control"
              placeholder="e.g. ramesh@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              style={{ width: '100%' }}
            />
            {emailInvalid && touched.email && (
              <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Enter a valid email address</span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={cancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={formInvalid || saving}>
              {saving ? (
                <><i className="pi pi-spin pi-spinner" /> Registering...</>
              ) : (
                <><i className="pi pi-user-plus" /> Register Patient</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default RegisterPatientPage;
