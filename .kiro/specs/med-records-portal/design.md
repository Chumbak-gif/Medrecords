# Design Document — MEDRecords Portal

## Overview

MEDRecords is a full-stack, role-gated Doctor-Patient Assessment & Pharma Analytics Portal built for Emcure. It delivers dynamic, disease-specific assessment forms driven by JSON schemas, a governed master-data administration layer, configurable record-lock workflow, client-side export (XLSX + PDF), and a unified audit trail. The frontend is Angular 17+ with standalone components, Angular Signals, PrimeNG, and the Emcure Tailwind design system. The backend is FastAPI (Python 3.11+) with PostgreSQL. Authentication is stateless JWT.

---

## 1. Project Structure (Monorepo)

```
MEDRecords/
├── frontend/                         # Angular 17+ standalone SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                 # Singleton services, guards, interceptors
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.guard.ts         # authGuard (functional)
│   │   │   │   │   ├── admin.guard.ts        # adminGuard (functional)
│   │   │   │   │   ├── guest.guard.ts        # guestGuard (functional)
│   │   │   │   │   ├── pharma.guard.ts       # pharmaGuard (functional)
│   │   │   │   │   └── sysadmin.guard.ts     # sysAdminGuard (functional)
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── jwt.interceptor.ts    # Attaches Bearer token
│   │   │   │   │   └── error.interceptor.ts  # Global 401/403 handling
│   │   │   │   └── services/
│   │   │   │       ├── audit.service.ts
│   │   │   │       └── config.service.ts
│   │   │   ├── shared/               # Reusable standalone components
│   │   │   │   ├── components/
│   │   │   │   │   ├── sidebar/
│   │   │   │   │   ├── topbar/
│   │   │   │   │   ├── kpi-card/
│   │   │   │   │   ├── status-badge/
│   │   │   │   │   └── confirm-dialog/
│   │   │   │   └── pipes/
│   │   │   │       └── safe-date.pipe.ts
│   │   │   ├── features/             # Lazy-loaded feature modules
│   │   │   │   ├── auth/             # /login
│   │   │   │   ├── doctor-dashboard/ # /doctor/dashboard
│   │   │   │   ├── patients/         # /doctor/patients
│   │   │   │   ├── assessments/      # /doctor/assessments
│   │   │   │   ├── diseases/         # /admin/diseases
│   │   │   │   ├── templates/        # /admin/templates
│   │   │   │   ├── medicines/        # /admin/medicines
│   │   │   │   ├── doctors/          # /admin/doctors
│   │   │   │   ├── analytics-admin/  # /admin/analytics
│   │   │   │   ├── analytics-pharma/ # /pharma/analytics
│   │   │   │   ├── audit-log/        # /admin/audit
│   │   │   │   └── system-config/    # /sysadmin/config
│   │   │   ├── app.routes.ts
│   │   │   └── app.config.ts
│   │   ├── assets/
│   │   │   └── logo.png              # Drop-in Emcure logo
│   │   └── styles.css                # Emcure design tokens (index.css)
│   ├── angular.json
│   └── package.json
│
└── backend/                          # FastAPI Python application
    ├── app/
    │   ├── main.py
    │   ├── config.py                 # Settings via pydantic-settings
    │   ├── database.py               # SQLAlchemy async engine
    │   ├── models/                   # SQLAlchemy ORM models
    │   ├── schemas/                  # Pydantic request/response schemas
    │   ├── routers/                  # FastAPI APIRouter modules
    │   │   ├── auth.py
    │   │   ├── diseases.py
    │   │   ├── templates.py
    │   │   ├── medicines.py
    │   │   ├── doctors.py
    │   │   ├── patients.py
    │   │   ├── assessments.py
    │   │   ├── prescriptions.py
    │   │   ├── analytics.py
    │   │   ├── exports.py
    │   │   ├── audit.py
    │   │   └── config.py
    │   ├── dependencies/
    │   │   ├── auth.py               # get_current_user, role_required
    │   │   └── audit_dep.py          # audit_writer dependency
    │   ├── services/
    │   │   ├── lock_scheduler.py     # APScheduler background task
    │   │   └── analytics_service.py
    │   └── tasks/
    │       └── lock_task.py
    ├── alembic/
    └── requirements.txt
```


---

## 2. Database Schema

### Design Principles
- All tables use `BIGSERIAL` primary keys.
- All mutable entities carry `is_active BOOLEAN DEFAULT TRUE` (soft-delete).
- All timestamps are `TIMESTAMPTZ` stored in UTC.
- Foreign keys use `ON DELETE RESTRICT` to prevent orphan-record hard deletes.
- Indexes on every FK column and on columns used in `WHERE`/`ORDER BY`.

---

### Table: `users`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `username` | VARCHAR(100) | UNIQUE, NOT NULL |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `full_name` | VARCHAR(255) | NOT NULL |
| `hashed_password` | TEXT | NOT NULL |
| `role` | VARCHAR(20) | NOT NULL — `doctor`, `admin`, `pharma_viewer`, `sys_admin` |
| `specialty` | VARCHAR(255) | NULLABLE (doctors only) |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_users_username`, `idx_users_role`, `idx_users_is_active`

---

### Table: `diseases`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL |
| `description` | TEXT | NULLABLE |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_by` | BIGINT | FK → `users.id` |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_diseases_name`, `idx_diseases_is_active`

---

### Table: `sub_diseases`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `disease_id` | BIGINT | FK → `diseases.id`, NOT NULL |
| `name` | VARCHAR(255) | NOT NULL |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_sub_diseases_disease_id`, `idx_sub_diseases_is_active`
**Constraint:** UNIQUE(`disease_id`, `name`)

---

### Table: `form_templates`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `disease_id` | BIGINT | FK → `diseases.id`, NOT NULL |
| `version` | INTEGER | NOT NULL, DEFAULT 1 |
| `schema` | JSONB | NOT NULL |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_by` | BIGINT | FK → `users.id` |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_form_templates_disease_id`, `idx_form_templates_is_active`
**Note:** When a new version is created, the previous version's `is_active` is set to FALSE. Old versions are retained for locked assessment readability.

---

### Table: `medicines`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL |
| `category` | VARCHAR(255) | NULLABLE |
| `unit` | VARCHAR(50) | NULLABLE |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_medicines_name`, `idx_medicines_is_active`

---

### Table: `patients`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `patient_uid` | VARCHAR(20) | UNIQUE, NOT NULL — e.g. `PAT-000001` |
| `first_name` | VARCHAR(255) | NOT NULL |
| `last_name` | VARCHAR(255) | NOT NULL |
| `date_of_birth` | DATE | NOT NULL |
| `gender` | VARCHAR(20) | NOT NULL |
| `contact_number` | VARCHAR(20) | UNIQUE, NOT NULL |
| `email` | VARCHAR(255) | NULLABLE |
| `registered_by` | BIGINT | FK → `users.id` |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_patients_contact_number`, `idx_patients_patient_uid`, `idx_patients_registered_by`

---

### Table: `assessments`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `patient_id` | BIGINT | FK → `patients.id`, NOT NULL |
| `doctor_id` | BIGINT | FK → `users.id`, NOT NULL |
| `disease_id` | BIGINT | FK → `diseases.id`, NOT NULL |
| `sub_disease_id` | BIGINT | FK → `sub_diseases.id`, NULLABLE |
| `template_id` | BIGINT | FK → `form_templates.id`, NOT NULL |
| `template_snapshot` | JSONB | NOT NULL — frozen copy of schema at submission time |
| `form_data` | JSONB | NOT NULL — key-value map of field responses |
| `status` | VARCHAR(20) | NOT NULL — `draft`, `submitted`, `locked` |
| `consent_given` | BOOLEAN | DEFAULT FALSE |
| `draft_saved_at` | TIMESTAMPTZ | NULLABLE |
| `submitted_at` | TIMESTAMPTZ | NULLABLE |
| `lock_expires_at` | TIMESTAMPTZ | NULLABLE — set on submission |
| `locked_at` | TIMESTAMPTZ | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_assessments_patient_id`, `idx_assessments_doctor_id`, `idx_assessments_disease_id`, `idx_assessments_status`, `idx_assessments_submitted_at`, `idx_assessments_lock_expires_at`

---

### Table: `prescription_rows`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `assessment_id` | BIGINT | FK → `assessments.id`, NOT NULL |
| `medicine_id` | BIGINT | FK → `medicines.id`, NOT NULL |
| `dosage` | VARCHAR(100) | NOT NULL |
| `frequency` | VARCHAR(100) | NOT NULL |
| `duration` | VARCHAR(100) | NOT NULL |
| `instructions` | TEXT | NULLABLE |
| `sort_order` | INTEGER | DEFAULT 0 |

**Indexes:** `idx_prescription_rows_assessment_id`

---

### Table: `consent_records`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `assessment_id` | BIGINT | FK → `assessments.id`, UNIQUE, NOT NULL |
| `patient_id` | BIGINT | FK → `patients.id`, NOT NULL |
| `doctor_id` | BIGINT | FK → `users.id`, NOT NULL |
| `consent_statement_version` | VARCHAR(20) | NOT NULL |
| `consented_at` | TIMESTAMPTZ | NOT NULL |

**Indexes:** `idx_consent_records_patient_id`, `idx_consent_records_assessment_id`

---

### Table: `audit_logs`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `event_type` | VARCHAR(50) | NOT NULL |
| `actor_id` | BIGINT | FK → `users.id`, NULLABLE (for failed logins) |
| `actor_username` | VARCHAR(100) | NOT NULL |
| `actor_role` | VARCHAR(20) | NOT NULL |
| `entity_type` | VARCHAR(50) | NULLABLE |
| `entity_id` | BIGINT | NULLABLE |
| `description` | TEXT | NULLABLE |
| `ip_address` | VARCHAR(45) | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes:** `idx_audit_logs_event_type`, `idx_audit_logs_actor_username`, `idx_audit_logs_created_at`, `idx_audit_logs_entity_type`
**Note:** Append-only — no UPDATE or DELETE allowed on this table. Enforced via DB trigger and application layer.

---

### Table: `app_config`
| Column | Type | Constraints |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `config_key` | VARCHAR(100) | UNIQUE, NOT NULL |
| `config_value` | TEXT | NOT NULL |
| `updated_by` | BIGINT | FK → `users.id` |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Seed data:** `{ config_key: 'lock_window_hours', config_value: '24' }`


---

## 3. Form Template JSON Schema Format

Each `form_templates.schema` JSONB column stores a structured object defining sections, fields, and validation rules. The schema is the source of truth for the Angular dynamic form renderer.

### Schema Object

```json
{
  "version": 1,
  "disease_id": 3,
  "sections": [
    {
      "section_key": "patient_demographics",
      "label": "Patient Demographics",
      "order": 1,
      "fields": [
        {
          "field_key": "height_cm",
          "label": "Height (cm)",
          "type": "number",
          "required": true,
          "validation": { "min": 50, "max": 250 },
          "placeholder": "Enter height in cm",
          "order": 1
        },
        {
          "field_key": "weight_kg",
          "label": "Weight (kg)",
          "type": "number",
          "required": true,
          "validation": { "min": 2, "max": 300 },
          "order": 2
        }
      ]
    },
    {
      "section_key": "clinical_observations",
      "label": "Clinical Observations",
      "order": 2,
      "fields": [
        {
          "field_key": "symptoms",
          "label": "Primary Symptoms",
          "type": "checkbox_group",
          "required": true,
          "options": ["Fever", "Cough", "Fatigue", "Breathlessness"],
          "order": 1
        },
        {
          "field_key": "severity",
          "label": "Severity",
          "type": "radio",
          "required": true,
          "options": ["Mild", "Moderate", "Severe"],
          "order": 2
        },
        {
          "field_key": "diagnosis_notes",
          "label": "Diagnosis Notes",
          "type": "textarea",
          "required": false,
          "validation": { "maxLength": 2000 },
          "order": 3
        },
        {
          "field_key": "follow_up_date",
          "label": "Follow-up Date",
          "type": "date",
          "required": false,
          "validation": { "minDate": "today" },
          "order": 4
        },
        {
          "field_key": "referred_hospital",
          "label": "Referred Hospital",
          "type": "select",
          "required": false,
          "options": ["AIIMS Delhi", "Fortis", "Apollo", "Other"],
          "order": 5
        }
      ]
    }
  ]
}
```

### Supported Field Types

| `type` | Angular Control | PrimeNG Component |
|---|---|---|
| `text` | `FormControl<string>` | `p-inputtext` |
| `number` | `FormControl<number>` | `p-inputnumber` |
| `date` | `FormControl<Date>` | `p-datepicker` |
| `select` | `FormControl<string>` | `p-select` |
| `multiselect` | `FormControl<string[]>` | `p-multiselect` |
| `radio` | `FormControl<string>` | `p-radiobutton` group |
| `checkbox_group` | `FormControl<string[]>` | `p-checkbox` group |
| `textarea` | `FormControl<string>` | `p-textarea` |

### Validation Rule Keys

| Key | Applies To | Meaning |
|---|---|---|
| `min` | `number` | Minimum value |
| `max` | `number` | Maximum value |
| `minLength` | `text`, `textarea` | Minimum string length |
| `maxLength` | `text`, `textarea` | Maximum string length |
| `minDate` | `date` | Earliest acceptable date (`"today"` resolves at runtime) |
| `maxDate` | `date` | Latest acceptable date |
| `pattern` | `text` | Regex pattern string |


---

## 4. FastAPI Router Structure

All routers are mounted under `/api/v1`. Authentication is handled by the `get_current_user` dependency; role checks are delegated to `role_required(role)`.

```
/api/v1/auth
  POST   /login                      → returns { access_token, token_type, role }
  POST   /logout                     → (client-side token discard + audit entry)
  GET    /me                         → current user profile

/api/v1/users
  GET    /                           → paginated list (sys_admin, admin)
  POST   /                           → create user (sys_admin)
  GET    /{id}                       → get user
  PATCH  /{id}                       → update user
  DELETE /{id}                       → soft-delete user
  POST   /{id}/reset-password        → reset password

/api/v1/diseases
  GET    /                           → paginated + search
  POST   /                           → create disease
  GET    /{id}                       → get disease with sub-diseases
  PATCH  /{id}                       → update disease
  DELETE /{id}                       → soft-delete (cascades to sub-diseases)
  POST   /{id}/restore               → restore soft-deleted disease
  GET    /{id}/sub-diseases          → list sub-diseases
  POST   /{id}/sub-diseases          → create sub-disease
  PATCH  /{id}/sub-diseases/{sid}    → update sub-disease
  DELETE /{id}/sub-diseases/{sid}    → soft-delete sub-disease

/api/v1/templates
  GET    /                           → paginated list
  POST   /                           → create template (admin)
  GET    /{id}                       → get template + schema
  PUT    /{id}                       → replace active template (creates new version)
  DELETE /{id}                       → soft-delete

/api/v1/medicines
  GET    /                           → paginated + search
  POST   /                           → create medicine
  GET    /{id}                       → get medicine
  PATCH  /{id}                       → update medicine
  DELETE /{id}                       → soft-delete
  POST   /import                     → bulk Excel import
  GET    /template                   → download import template .xlsx

/api/v1/patients
  GET    /                           → paginated + search (doctor-scoped)
  POST   /                           → register patient
  GET    /{id}                       → get patient profile + visit history
  PATCH  /{id}                       → update patient
  DELETE /{id}                       → soft-delete

/api/v1/assessments
  GET    /                           → paginated list (doctor-scoped or admin all)
  POST   /                           → create assessment (draft)
  GET    /{id}                       → get full assessment record
  PUT    /{id}                       → update/re-submit assessment
  POST   /{id}/submit                → transition draft → submitted
  GET    /dashboard/kpis             → doctor dashboard KPI aggregates

/api/v1/prescriptions
  GET    /assessment/{aid}           → get prescription rows for an assessment
  POST   /assessment/{aid}           → upsert full prescription grid

/api/v1/analytics
  GET    /kpis                       → admin dashboard KPI cards
  GET    /monthly-volume             → bar chart — 12-month rolling
  GET    /by-disease                 → pie chart data
  GET    /trend                      → line chart with date-range filters
  GET    /disease-summary            → statistical summary table

/api/v1/exports
  GET    /assessments/excel          → generate data payload for XLSX (doctor monthly / admin range)
  GET    /assessments/{id}/pdf-data  → generate data payload for jspdf
  GET    /audit/excel                → export audit log filtered .xlsx data

/api/v1/audit
  GET    /                           → paginated audit log (admin/sys_admin)

/api/v1/config
  GET    /                           → get all config keys
  PATCH  /{key}                      → update config value (sys_admin only)
```

### Error Envelope

All validation and system errors return:
```json
{ "detail": [{ "loc": ["body", "field_key"], "msg": "Error message", "type": "value_error" }] }
```


---

## 5. Angular Feature Module Structure

All feature routes are lazy-loaded via `loadComponent` or `loadChildren`. Each feature module is a standalone component directory.

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component')
  },
  {
    path: 'doctor',
    canActivate: [authGuard, doctorGuard],
    loadChildren: () => import('./features/doctor-dashboard/doctor.routes')
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () => import('./features/admin/admin.routes')
  },
  {
    path: 'pharma',
    canActivate: [authGuard, pharmaGuard],
    loadChildren: () => import('./features/analytics-pharma/pharma.routes')
  },
  {
    path: 'sysadmin',
    canActivate: [authGuard, sysAdminGuard],
    loadChildren: () => import('./features/system-config/sysadmin.routes')
  },
  { path: '**', redirectTo: 'login' }
];
```

### Feature Routes Summary

| Route | Feature Module | Guard(s) |
|---|---|---|
| `/login` | `AuthFeature` | `guestGuard` |
| `/doctor/dashboard` | `DoctorDashboardComponent` | `authGuard`, `doctorGuard` |
| `/doctor/patients` | `PatientsFeature` | `authGuard`, `doctorGuard` |
| `/doctor/assessments/new` | `AssessmentFormComponent` | `authGuard`, `doctorGuard` |
| `/doctor/assessments/:id` | `AssessmentDetailComponent` | `authGuard`, `doctorGuard` |
| `/admin/diseases` | `DiseasesFeature` | `authGuard`, `adminGuard` |
| `/admin/templates` | `TemplatesFeature` | `authGuard`, `adminGuard` |
| `/admin/medicines` | `MedicinesFeature` | `authGuard`, `adminGuard` |
| `/admin/doctors` | `DoctorsFeature` | `authGuard`, `adminGuard` |
| `/admin/analytics` | `AdminAnalyticsFeature` | `authGuard`, `adminGuard` |
| `/admin/audit` | `AuditLogFeature` | `authGuard`, `adminGuard` |
| `/pharma/analytics` | `PharmaAnalyticsComponent` | `authGuard`, `pharmaGuard` |
| `/sysadmin/config` | `SystemConfigComponent` | `authGuard`, `sysAdminGuard` |
| `/sysadmin/users` | `UserManagementComponent` | `authGuard`, `sysAdminGuard` |


---

## 6. Angular Service Layer

All services are `providedIn: 'root'` singletons. Signals are used for shared reactive state.

### `AuthService`

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Signals
  currentUser = signal<UserProfile | null>(null);
  isAuthenticated = computed(() => !!this.currentUser());

  login(username: string, password: string): Observable<AuthResponse>
  logout(): void           // clears token, navigates to /login replaceUrl: true
  loadProfile(): void      // GET /auth/me, populates currentUser signal
  hasRole(role: string): boolean
  getToken(): string | null
  storeToken(token: string): void
}
```

### `DiseaseService`

```typescript
@Injectable({ providedIn: 'root' })
export class DiseaseService {
  getDiseases(params: PageParams): Observable<PaginatedResponse<Disease>>
  getDisease(id: number): Observable<DiseaseDetail>
  createDisease(payload: CreateDiseaseDto): Observable<Disease>
  updateDisease(id: number, payload: UpdateDiseaseDto): Observable<Disease>
  softDeleteDisease(id: number): Observable<void>
  restoreDisease(id: number): Observable<Disease>
  getSubDiseases(diseaseId: number): Observable<SubDisease[]>
  createSubDisease(diseaseId: number, payload: CreateSubDiseaseDto): Observable<SubDisease>
}
```

### `TemplateService`

```typescript
@Injectable({ providedIn: 'root' })
export class TemplateService {
  getTemplates(params: PageParams): Observable<PaginatedResponse<FormTemplate>>
  getTemplate(id: number): Observable<FormTemplate>
  getActiveTemplateForDisease(diseaseId: number): Observable<FormTemplate>
  createTemplate(payload: CreateTemplateDto): Observable<FormTemplate>
  updateTemplate(id: number, payload: UpdateTemplateDto): Observable<FormTemplate>
  softDeleteTemplate(id: number): Observable<void>
}
```

### `AssessmentService`

```typescript
@Injectable({ providedIn: 'root' })
export class AssessmentService {
  // Signals
  activeAssessment = signal<Assessment | null>(null);
  assessmentStatus = computed(() => this.activeAssessment()?.status ?? null);

  getAssessments(params: AssessmentQueryParams): Observable<PaginatedResponse<Assessment>>
  getAssessment(id: number): Observable<AssessmentDetail>
  createDraft(payload: CreateAssessmentDto): Observable<Assessment>
  saveDraft(id: number, payload: UpdateAssessmentDto): Observable<Assessment>
  submitAssessment(id: number): Observable<Assessment>
  getDashboardKpis(): Observable<DoctorKpis>
}
```

### `PatientService`

```typescript
@Injectable({ providedIn: 'root' })
export class PatientService {
  getPatients(params: PageParams): Observable<PaginatedResponse<Patient>>
  getPatient(id: number): Observable<PatientDetail>
  registerPatient(payload: RegisterPatientDto): Observable<Patient>
  updatePatient(id: number, payload: UpdatePatientDto): Observable<Patient>
}
```

### `MedicineService`

```typescript
@Injectable({ providedIn: 'root' })
export class MedicineService {
  getMedicines(params: PageParams): Observable<PaginatedResponse<Medicine>>
  createMedicine(payload: CreateMedicineDto): Observable<Medicine>
  updateMedicine(id: number, payload: UpdateMedicineDto): Observable<Medicine>
  softDeleteMedicine(id: number): Observable<void>
  importMedicines(file: File): Observable<ImportResult>
  downloadTemplate(): void
}
```

### `AnalyticsService`

```typescript
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  getAdminKpis(filters: AnalyticsFilters): Observable<AdminKpis>
  getMonthlyVolume(filters: AnalyticsFilters): Observable<MonthlyVolumeData[]>
  getByDisease(filters: AnalyticsFilters): Observable<DiseaseDistributionData[]>
  getTrend(filters: AnalyticsFilters): Observable<TrendData[]>
  getDiseaseSummary(filters: AnalyticsFilters): Observable<DiseaseSummaryRow[]>
}
```

### `ExportService`

```typescript
@Injectable({ providedIn: 'root' })
export class ExportService {
  exportDoctorExcel(month: number, year: number): void  // client-side XLSX generation
  exportAdminExcel(filters: ExportFilters): void
  exportAssessmentPdf(assessmentId: number): void       // jspdf + jspdf-autotable
  exportAuditLog(filters: AuditFilters): void
}
```

### `AuditService`

```typescript
@Injectable({ providedIn: 'root' })
export class AuditService {
  getAuditLog(params: AuditQueryParams): Observable<PaginatedResponse<AuditEntry>>
}
```

### `ConfigService`

```typescript
@Injectable({ providedIn: 'root' })
export class ConfigService {
  configs = signal<AppConfig[]>([]);

  loadConfigs(): void
  updateConfig(key: string, value: string): Observable<AppConfig>
  getLockWindowHours(): number
}
```


---

## 7. Dynamic Form Rendering Engine

The `DynamicFormComponent` consumes a `FormTemplate` JSON schema and builds a reactive Angular form at runtime. It is a standalone component used inside `AssessmentFormComponent`.

### Architecture

```
AssessmentFormComponent
  │
  ├─ ConsentSectionComponent        ← always first
  ├─ DemographicsSectionComponent   ← always second (pre-populated from Patient)
  ├─ DynamicFormComponent           ← renders sections/fields from JSON schema
  │    ├─ DynamicSectionComponent   ← iterates schema.sections[]
  │    │    └─ DynamicFieldComponent  ← switch on field.type → PrimeNG control
  └─ PrescriptionGridComponent      ← always last section
```

### `DynamicFormComponent`

```typescript
@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [ReactiveFormsModule, DynamicSectionComponent, ...PrimeNG],
  template: `
    <form [formGroup]="form">
      @for (section of schema().sections; track section.section_key) {
        <app-dynamic-section [section]="section" [formGroup]="getSection(section.section_key)" />
      }
    </form>
  `
})
export class DynamicFormComponent {
  schema = input.required<FormSchema>();
  initialData = input<Record<string, unknown>>({});
  isReadonly = input<boolean>(false);

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.buildForm(this.schema());
    if (Object.keys(this.initialData()).length) {
      this.form.patchValue(this.initialData());
    }
    if (this.isReadonly()) {
      this.form.disable();
    }
  }

  private buildForm(schema: FormSchema): FormGroup {
    const sectionGroups: Record<string, FormGroup> = {};
    for (const section of schema.sections) {
      const fields: Record<string, AbstractControl> = {};
      for (const field of section.fields) {
        fields[field.field_key] = new FormControl(
          field.type === 'checkbox_group' ? [] : null,
          this.buildValidators(field)
        );
      }
      sectionGroups[section.section_key] = new FormGroup(fields);
    }
    return new FormGroup(sectionGroups);
  }

  private buildValidators(field: FormField): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.required) validators.push(Validators.required);
    if (field.validation?.min !== undefined) validators.push(Validators.min(field.validation.min));
    if (field.validation?.max !== undefined) validators.push(Validators.max(field.validation.max));
    if (field.validation?.minLength) validators.push(Validators.minLength(field.validation.minLength));
    if (field.validation?.maxLength) validators.push(Validators.maxLength(field.validation.maxLength));
    if (field.validation?.pattern) validators.push(Validators.pattern(field.validation.pattern));
    return validators;
  }

  getFormData(): Record<string, Record<string, unknown>> {
    return this.form.getRawValue();
  }

  isValid(): boolean {
    return this.form.valid;
  }
}
```

### `DynamicFieldComponent`

Uses an `@switch` on `field.type` to render the corresponding PrimeNG control:

```typescript
@switch (field.type) {
  @case ('text')           { <input pInputText [formControlName]="field.field_key" /> }
  @case ('number')         { <p-inputnumber [formControlName]="field.field_key" /> }
  @case ('date')           { <p-datepicker [formControlName]="field.field_key" /> }
  @case ('select')         { <p-select [formControlName]="field.field_key" [options]="field.options" /> }
  @case ('multiselect')    { <p-multiselect [formControlName]="field.field_key" [options]="field.options" /> }
  @case ('radio')          { /* p-radiobutton group */ }
  @case ('checkbox_group') { /* p-checkbox group */ }
  @case ('textarea')       { <textarea pTextarea [formControlName]="field.field_key"></textarea> }
}
```


---

## 8. Assessment State Machine

```
                  ┌─────────────────────────┐
         save     │                         │  save
    ┌────────────►│         DRAFT           │◄──────────────────┐
    │             │   (draft_saved_at set)  │                   │
    │             └────────────┬────────────┘                   │
    │                          │ submit                         │
    │                          ▼                                │
    │             ┌─────────────────────────┐                   │
    │             │       SUBMITTED          │  edit+resubmit   │
    │             │  (submitted_at set,      │──────────────────┘
    │             │   lock_expires_at set)   │
    │             └────────────┬────────────┘
    │                          │ lock_expires_at < NOW()
    │                          │ (APScheduler background task)
    │                          ▼
    │             ┌─────────────────────────┐
    │             │        LOCKED           │
    │             │   (locked_at set,       │
    │             │    read-only)           │
    │             └─────────────────────────┘
    │
    └──── Draft can be created at any point for a new visit
```

### State Transition Rules

| From | To | Trigger | Condition |
|---|---|---|---|
| — | `draft` | Doctor initiates new visit | Active template exists for disease |
| `draft` | `draft` | Doctor saves | Always allowed |
| `draft` | `submitted` | Doctor clicks Submit | Form valid + consent given + ≥1 prescription row |
| `submitted` | `submitted` | Doctor edits + re-submits | `NOW() < lock_expires_at` |
| `submitted` | `locked` | Scheduler background task | `NOW() ≥ lock_expires_at` |

### Lock Window Calculation

```python
from datetime import datetime, timedelta, timezone

def calculate_lock_expires(submitted_at: datetime, lock_hours: int) -> datetime:
    return submitted_at + timedelta(hours=lock_hours)
```

`lock_expires_at` is computed at submission time using the current `lock_window_hours` from `app_config`. Config changes do NOT retroactively update existing `lock_expires_at` values.

### Frontend Lock Status Display

```typescript
// In AssessmentDetailComponent
remainingLockTime = computed(() => {
  const assessment = this.assessment();
  if (!assessment || assessment.status !== 'submitted') return null;
  const expires = new Date(assessment.lock_expires_at);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes}m remaining`;
});
```


---

## 9. Lock Window Scheduler

The auto-lock mechanism uses **APScheduler** (AsyncIOScheduler) running as a FastAPI background task. It avoids requiring a separate worker process.

### Implementation

```python
# app/services/lock_scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import update
from datetime import datetime, timezone
from app.models import Assessment
from app.database import AsyncSessionLocal

scheduler = AsyncIOScheduler()

async def lock_expired_assessments():
    """Bulk-update all submitted assessments past their lock_expires_at."""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(Assessment)
            .where(
                Assessment.status == 'submitted',
                Assessment.lock_expires_at <= now
            )
            .values(status='locked', locked_at=now)
        )
        await session.commit()

def start_scheduler():
    scheduler.add_job(
        lock_expired_assessments,
        trigger='interval',
        minutes=5,          # runs every 5 minutes
        id='lock_assessments',
        replace_existing=True
    )
    scheduler.start()

# app/main.py
@app.on_event("startup")
async def startup():
    start_scheduler()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
```

### Alternative: DB Function Approach

For deployments with direct DB access, a PostgreSQL trigger function can be used as a fallback. However, the APScheduler approach is preferred to keep lock transitions visible in the application layer (enabling audit log writes):

```sql
-- Fallback: read-time computed status via SQL view
CREATE VIEW assessment_effective_status AS
  SELECT id,
    CASE
      WHEN status = 'submitted' AND lock_expires_at <= NOW() THEN 'locked'
      ELSE status
    END AS effective_status
  FROM assessments;
```


---

## 10. Analytics Aggregation Queries

All analytics queries are executed in `app/services/analytics_service.py` using SQLAlchemy Core or raw SQL for performance.

### Admin KPI Cards

```sql
-- Total assessments all time
SELECT COUNT(*) FROM assessments;

-- Assessments this month
SELECT COUNT(*) FROM assessments
WHERE DATE_TRUNC('month', submitted_at) = DATE_TRUNC('month', NOW());

-- Active patients
SELECT COUNT(DISTINCT patient_id) FROM assessments
WHERE status IN ('submitted', 'locked');

-- Active doctors
SELECT COUNT(*) FROM users WHERE role = 'doctor' AND is_active = TRUE;

-- Active diseases
SELECT COUNT(*) FROM diseases WHERE is_active = TRUE;
```

### Monthly Volume (12-month bar chart)

```sql
SELECT
  TO_CHAR(DATE_TRUNC('month', submitted_at), 'Mon YYYY') AS month_label,
  DATE_TRUNC('month', submitted_at) AS month_start,
  COUNT(*) AS count
FROM assessments
WHERE submitted_at >= NOW() - INTERVAL '12 months'
  AND (:disease_ids IS NULL OR disease_id = ANY(:disease_ids))
  AND (:doctor_ids IS NULL OR doctor_id = ANY(:doctor_ids))
GROUP BY month_start, month_label
ORDER BY month_start;
```

### Assessment Distribution by Disease (pie/donut chart)

```sql
SELECT d.name AS disease_name, COUNT(a.id) AS count
FROM assessments a
JOIN diseases d ON d.id = a.disease_id
WHERE (:from_date IS NULL OR a.submitted_at >= :from_date)
  AND (:to_date IS NULL OR a.submitted_at <= :to_date)
GROUP BY d.name
ORDER BY count DESC;
```

### Assessment Trend (line chart)

```sql
SELECT
  DATE_TRUNC('day', submitted_at) AS day,
  COUNT(*) AS count
FROM assessments
WHERE submitted_at BETWEEN :from_date AND :to_date
  AND (:disease_ids IS NULL OR disease_id = ANY(:disease_ids))
  AND (:doctor_ids IS NULL OR doctor_id = ANY(:doctor_ids))
GROUP BY day
ORDER BY day;
```

### Disease Summary Table

```sql
SELECT
  d.name,
  COUNT(a.id) AS total,
  COUNT(a.id) FILTER (
    WHERE DATE_TRUNC('month', a.submitted_at) = DATE_TRUNC('month', NOW())
  ) AS this_month,
  COUNT(a.id) FILTER (WHERE a.status = 'locked') AS locked_count,
  COUNT(a.id) FILTER (WHERE a.status = 'submitted') AS submitted_count
FROM diseases d
LEFT JOIN assessments a ON a.disease_id = d.id
WHERE d.is_active = TRUE
GROUP BY d.name
ORDER BY total DESC;
```


---

## 11. Bulk Excel Import Strategy

Medicine bulk import uses a streaming, transactional upsert pattern.

### Flow

```
Browser → FileUpload (PrimeNG p-fileupload)
       → POST /api/v1/medicines/import (multipart/form-data)
       → FastAPI: read bytes in-memory (openpyxl)
       → Row-level Pydantic validation (all rows)
       → IF any row invalid → raise 422 with row-level error list (DB unchanged)
       → IF all rows valid → SQLAlchemy bulk upsert (INSERT ... ON CONFLICT DO UPDATE)
       → Return { inserted: N, updated: M, errors: [] }
```

### Backend Implementation

```python
# routers/medicines.py
@router.post("/import")
async def import_medicines(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin"))
):
    contents = await file.read()
    wb = openpyxl.load_workbook(BytesIO(contents), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))  # skip header

    errors = []
    validated = []
    for i, row in enumerate(rows, start=2):
        try:
            validated.append(MedicineImportSchema(
                name=row[0], category=row[1], unit=row[2]
            ))
        except ValidationError as e:
            errors.append({"row": i, "errors": e.errors()})

    if errors:
        raise HTTPException(status_code=422, detail=errors)

    # Bulk upsert — all or nothing
    stmt = pg_insert(Medicine).values([m.dict() for m in validated])
    stmt = stmt.on_conflict_do_update(
        index_elements=['name'],
        set_={'category': stmt.excluded.category, 'unit': stmt.excluded.unit, 'is_active': True}
    )
    await db.execute(stmt)
    await db.commit()
    return {"inserted": len(validated), "updated": 0}
```

### Import Template (download)

A pre-built `.xlsx` template with column headers `Name`, `Category`, `Unit` is served as a static file at `GET /api/v1/medicines/template`.


---

## 12. Export Strategy

Both Excel and PDF exports are fully **client-side** to avoid server memory load from large datasets.

### Excel Export (XLSX.js)

The backend `/exports/assessments/excel` endpoint returns a structured JSON payload (array of flat row objects). The Angular `ExportService` calls XLSX.js to generate the file in the browser.

```typescript
// core/services/export.service.ts
import * as XLSX from 'xlsx';

exportDoctorExcel(month: number, year: number): void {
  this.http.get<AssessmentExportRow[]>(
    `/api/v1/exports/assessments/excel?month=${month}&year=${year}`
  ).subscribe(rows => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assessments');
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `MEDRecords_DoctorExport_${date}.xlsx`);
    this.logExportAudit('doctor_excel', rows.length);
  });
}
```

### Dynamic Form Data Flattening

Assessment `form_data` JSONB is flattened in the backend before returning the export payload:

```python
# Flatten nested section.field_key → "section_key__field_key" columns
def flatten_form_data(form_data: dict) -> dict:
    flat = {}
    for section_key, fields in form_data.items():
        for field_key, value in fields.items():
            flat[f"{section_key}__{field_key}"] = (
                ", ".join(value) if isinstance(value, list) else value
            )
    return flat
```

### PDF Export (jspdf + jspdf-autotable)

```typescript
exportAssessmentPdf(assessmentId: number): void {
  this.http.get<AssessmentPdfData>(`/api/v1/exports/assessments/${assessmentId}/pdf-data`)
    .subscribe(data => {
      const doc = new jsPDF();

      // Header with logo
      doc.addImage('/assets/logo.png', 'PNG', 14, 10, 30, 12);
      doc.setFontSize(14);
      doc.text('MEDRecords Portal', 50, 18);
      doc.setFontSize(10);
      doc.text(`Patient: ${data.patient_name}  |  ID: ${data.patient_uid}`, 14, 30);
      doc.text(`Visit Date: ${this.safeDate(data.visit_date)}  |  Disease: ${data.disease}`, 14, 36);

      // Dynamic form fields table
      autoTable(doc, {
        startY: 44,
        head: [['Field', 'Value']],
        body: data.form_fields.map(f => [f.label, this.safeValue(f.value)]),
        styles: { fontSize: 9 }
      });

      // Prescription table
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions']],
        body: data.prescription_rows.map(r => [
          r.medicine_name, r.dosage, r.frequency, r.duration, r.instructions ?? ''
        ]),
        styles: { fontSize: 9 }
      });

      const date = this.safeDate(data.visit_date).replace(/\//g, '-');
      doc.save(`MEDRecords_Patient_${data.patient_uid}_Visit_${date}.pdf`);
    });
}

private safeDate(val: unknown): string {
  if (!val) return 'N/A';
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('en-IN');
}

private safeValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}
```


---

## 13. Audit Log Write Strategy

Audit entries are written via a **FastAPI dependency** that is injected into every router that produces auditable events. This ensures consistent, structured audit writes without coupling business logic to audit code.

### `AuditWriter` Dependency

```python
# dependencies/audit_dep.py
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog
from app.dependencies.auth import get_current_user

class AuditWriter:
    def __init__(self, db: AsyncSession, user: User, request: Request):
        self.db = db
        self.user = user
        self.ip = request.client.host if request.client else None

    async def log(
        self,
        event_type: str,
        entity_type: str | None = None,
        entity_id: int | None = None,
        description: str | None = None
    ):
        entry = AuditLog(
            event_type=event_type,
            actor_id=self.user.id if self.user else None,
            actor_username=self.user.username if self.user else 'anonymous',
            actor_role=self.user.role if self.user else 'unknown',
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            ip_address=self.ip
        )
        self.db.add(entry)
        # Flushed with the parent transaction — no separate commit needed

def get_audit_writer(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user_optional)
) -> AuditWriter:
    return AuditWriter(db, user, request)
```

### Usage in a Router

```python
# routers/assessments.py
@router.post("/{id}/submit")
async def submit_assessment(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("doctor")),
    audit: AuditWriter = Depends(get_audit_writer)
):
    assessment = await get_assessment_or_404(id, db)
    assessment.status = 'submitted'
    assessment.submitted_at = datetime.now(timezone.utc)
    assessment.lock_expires_at = calculate_lock_expires(
        assessment.submitted_at,
        await get_lock_window_hours(db)
    )
    await audit.log(
        event_type='assessment_submitted',
        entity_type='assessment',
        entity_id=assessment.id,
        description=f"Assessment submitted by doctor {current_user.username}"
    )
    await db.commit()
    return assessment
```

### Audit Event Type Catalogue

| Event Type | Trigger |
|---|---|
| `login_success` | Successful JWT login |
| `login_failure` | Invalid credentials |
| `logout` | User-initiated logout |
| `assessment_created` | New draft created |
| `assessment_updated` | Draft saved |
| `assessment_submitted` | Draft → Submitted |
| `assessment_locked` | Submitted → Locked (scheduler) |
| `patient_registered` | New patient saved |
| `master_data_created` | Any master record created |
| `master_data_updated` | Any master record updated |
| `master_data_deleted` | Soft-delete of master record |
| `template_saved` | Form template saved |
| `excel_exported` | .xlsx file generated |
| `pdf_exported` | .pdf file generated |
| `consent_recorded` | Consent checkbox confirmed |
| `config_updated` | Platform config changed |
| `password_reset` | Doctor password reset by admin |


---

## 14. JWT Authentication Flow

```
Browser          Angular              FastAPI              PostgreSQL
   │                │                    │                     │
   │──POST /login──►│                    │                     │
   │                │──POST /auth/login─►│                     │
   │                │                    │──SELECT users WHERE─►│
   │                │                    │◄─ user row ─────────│
   │                │                    │   bcrypt.verify()   │
   │                │                    │   create JWT        │
   │                │◄── { access_token }│                     │
   │                │  localStorage.set  │                     │
   │                │  currentUser sig   │                     │
   │                │                    │                     │
   │   navigate      │                    │                     │
   │◄──to /role/dash │                    │                     │
```

### JWT Payload

```json
{
  "sub": "username",
  "user_id": 42,
  "role": "doctor",
  "exp": 1720000000,
  "iat": 1719996400
}
```

### JWT Configuration

```python
# config.py
class Settings(BaseSettings):
    SECRET_KEY: str             # loaded from env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480   # 8 hours default
```

### Token Revocation Strategy

FastAPI is stateless — tokens cannot be server-side revoked. When a user is deactivated or a doctor is soft-deleted, the `is_active` check in `get_current_user` ensures all subsequent requests return 401 even if the token has not expired:

```python
async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    payload = decode_token(token)  # raises 401 on invalid/expired
    user = await db.get(User, payload['user_id'])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive or unknown user")
    return user
```

---

## 15. Sidebar Navigation & RBAC

The `SidebarComponent` is a standalone Angular Signal-driven component. Navigation items are rendered conditionally using `@if (auth.hasRole(...))`.

```typescript
@Component({
  selector: 'app-sidebar',
  standalone: true,
  template: `
    <nav class="sidebar" [class.collapsed]="isCollapsed()">
      <div class="logo-area">
        <img src="assets/logo.png" alt="Emcure MEDRecords" />
      </div>

      @if (auth.hasRole('doctor')) {
        <a routerLink="/doctor/dashboard">Dashboard</a>
        <a routerLink="/doctor/patients">Patients</a>
        <a routerLink="/doctor/assessments">Assessments</a>
      }

      @if (auth.hasRole('admin')) {
        <a routerLink="/admin/analytics">Analytics</a>
        <a routerLink="/admin/diseases">Diseases</a>
        <a routerLink="/admin/templates">Templates</a>
        <a routerLink="/admin/medicines">Medicines</a>
        <a routerLink="/admin/doctors">Doctors</a>
        <a routerLink="/admin/audit">Audit Log</a>
      }

      @if (auth.hasRole('pharma_viewer')) {
        <a routerLink="/pharma/analytics">Analytics</a>
      }

      @if (auth.hasRole('sys_admin')) {
        <a routerLink="/sysadmin/users">User Management</a>
        <a routerLink="/sysadmin/config">Configuration</a>
        <a routerLink="/admin/audit">Audit Log</a>
      }
    </nav>
  `
})
export class SidebarComponent {
  auth = inject(AuthService);
  isCollapsed = signal(false);
  toggleCollapse = () => this.isCollapsed.update(v => !v);
}
```

All sidebar widths and top-bar heights use CSS variables: `--sidenav-width: 220px`, `--topbar-height: 55px`.


---

## 16. Virtual Scrolling

Tables that may exceed 50 rows use Angular CDK Virtual Scrolling via PrimeNG's built-in `[virtualScroll]` option on `p-table`.

```html
<!-- Example: Recent Assessments table in Doctor Dashboard -->
<p-table
  [value]="assessments()"
  [virtualScroll]="assessments().length > 50"
  [virtualScrollItemSize]="46"
  [scrollHeight]="'480px'"
  [lazy]="true"
  (onLazyLoad)="loadPage($event)">
  <ng-template pTemplate="header">
    <tr>
      <th>Patient Name</th>
      <th>Patient ID</th>
      <th>Disease</th>
      <th>Visit Date</th>
      <th>Status</th>
    </tr>
  </ng-template>
  <ng-template pTemplate="body" let-row>
    <tr (click)="openAssessment(row.id)" class="cursor-pointer">
      <td>{{ row.patient_name }}</td>
      <td>{{ row.patient_uid }}</td>
      <td>{{ row.disease_name }}</td>
      <td>{{ row.visit_date | date:'dd MMM yyyy' }}</td>
      <td><span [class]="'badge-' + row.status">{{ row.status | titlecase }}</span></td>
    </tr>
  </ng-template>
</p-table>
```

---

## 17. Pagination Response Envelope

Every paginated endpoint returns:

```json
{
  "items": [...],
  "total": 284,
  "page": 1,
  "page_size": 20,
  "pages": 15
}
```

### FastAPI Pagination Helper

```python
# schemas/pagination.py
from typing import Generic, TypeVar, List
from pydantic import BaseModel
import math

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int

def paginate(query_result: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": query_result,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if page_size else 1
    }
```


---

## 18. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: JWT Payload Completeness

*For any* valid user of any role, the JWT issued upon successful login SHALL contain a `role` field matching the user's database role and an `exp` field that is a future timestamp relative to the moment of issuance.

**Validates: Requirements 1.4**

---

### Property 2: Route Guard Enforcement

*For any* internal route registered in the Angular router, a request carrying no valid JWT SHALL be redirected to `/login` and SHALL NOT render the protected component.

**Validates: Requirements 1.6**

---

### Property 3: Audit Log Completeness

*For any* triggering event of any of the defined audit event types (login, logout, assessment lifecycle, master data mutations, exports, consent), the audit log SHALL contain exactly one new entry with a non-null `event_type`, `actor_username`, `actor_role`, and `created_at` timestamp after the event completes.

**Validates: Requirements 1.10, 14.1**

---

### Property 4: Disease Name Uniqueness

*For any* disease name that already exists in the database as an active or inactive record, attempting to create a second disease with the same name SHALL return an error and leave the total disease count unchanged.

**Validates: Requirements 2.2**

---

### Property 5: Soft-Delete Cascade

*For any* disease with N associated sub-diseases, performing a soft-delete on the disease SHALL result in all N sub-diseases and the disease itself having `is_active = false`, while the total number of rows in the `diseases` and `sub_diseases` tables remains unchanged.

**Validates: Requirements 2.5**

---

### Property 6: Pagination Correctness

*For any* paginated API endpoint with total `T` records and any valid combination of `page` and `page_size`, the response SHALL satisfy: `len(items) ≤ page_size`, `total = T`, and `page * page_size - page_size < total` (page is within bounds). The response envelope SHALL always contain `items`, `total`, `page`, `page_size`, and `pages` fields.

**Validates: Requirements 2.7, 17.1, 17.3**

---

### Property 7: Form Template Schema Round-Trip

*For any* valid form template definition object containing sections and fields, serializing it to JSONB and then deserializing it back SHALL produce an object that is structurally equivalent to the original (same sections, same fields, same validation rules, same order values).

**Validates: Requirements 3.4**

---

### Property 8: Schema Validation Rejects Malformed Fields

*For any* form template schema where at least one field definition is missing a `field_key`, `label`, `type`, or `required` attribute, the validation layer SHALL reject the schema and return a descriptive error — the template SHALL NOT be persisted to the database.

**Validates: Requirements 3.5**

---

### Property 9: Template Version Isolation

*For any* assessment record that was submitted under template version V, updating the disease's active template to version V+1 SHALL leave the `template_snapshot` stored on the submitted assessment record unchanged and equal to the schema of version V.

**Validates: Requirements 3.6**

---

### Property 10: Bulk Import Atomicity

*For any* Excel import batch that contains at least one row failing Pydantic validation, the entire batch SHALL be rejected, the database state SHALL be byte-for-byte identical to its state before the import request, and the response SHALL list each failing row by row number with a descriptive error.

**Validates: Requirements 4.4**

---

### Property 11: Bulk Import Upsert Correctness

*For any* valid Excel import batch of N unique medicine names, after a successful import the total count of medicines with those names in the database SHALL equal N (regardless of whether they existed before), with all rows reflecting the values from the imported batch.

**Validates: Requirements 4.3**

---

### Property 12: Patient ID Uniqueness

*For any* sequence of patient registration operations, the set of generated `patient_uid` values SHALL contain no duplicates, even under concurrent registration of multiple patients.

**Validates: Requirements 6.2**

---

### Property 13: Duplicate Contact Number Rejection

*For any* contact number already associated with an existing active patient record, attempting to register a second patient with that same contact number SHALL be rejected with an error and the total patient count SHALL remain unchanged.

**Validates: Requirements 6.5**

---

### Property 14: Dynamic Form Field Rendering Fidelity

*For any* disease with an active form template containing S sections with a total of F fields, the rendered Angular reactive form SHALL contain exactly S section `FormGroup` instances and exactly F `FormControl` instances, with each control's validators corresponding to the `validation` rules declared in the schema.

**Validates: Requirements 7.2, 7.4**

---

### Property 15: Assessment State Machine Invariant

*For any* assessment record at any point in its lifecycle, its `status` field SHALL be one of exactly `{'draft', 'submitted', 'locked'}`, and the state transitions SHALL only flow in the direction: draft → submitted → locked (no backward transitions).

**Validates: Requirements 9.1**

---

### Property 16: Lock Window Immutability After Submission

*For any* assessment record that has been submitted with a computed `lock_expires_at` value, a subsequent change to the `lock_window_hours` platform configuration SHALL NOT alter the `lock_expires_at` value of that already-submitted record.

**Validates: Requirements 9.9**

---

### Property 17: Auto-Lock Correctness

*For any* assessment record in `submitted` state where the current UTC time is greater than or equal to `lock_expires_at`, the record's effective status SHALL be `locked` after the next scheduler cycle completes.

**Validates: Requirements 9.5**

---

### Property 18: Excel Export Row Completeness

*For any* export request targeting a dataset of N assessment records, the generated XLSX file SHALL contain exactly N data rows (excluding the header), and every row SHALL include columns for all dynamic form field values present in the assessment's `form_data`.

**Validates: Requirements 12.4, 12.2**

---

### Property 19: Consent Gate on Submission

*For any* assessment record where the `consent_given` flag is `false` or no `consent_records` row is linked to the assessment's `id`, the submit endpoint SHALL return a 422 validation error and the assessment status SHALL remain `draft`.

**Validates: Requirements 15.4**

