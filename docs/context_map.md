# MEDRecords — Context Map

> Maps every spec task/section to its implementation files, API endpoints, Angular routes, and database models.

---

## Legend

| Column | Meaning |
|---|---|
| **Task #** | Task number from `tasks.md` |
| **Feature / Section** | Human-readable feature name |
| **Angular Route** | URL path exposed in the browser |
| **Angular Component File** | `frontend/src/app/` relative path |
| **Angular Service / Guard** | Supporting services or guards |
| **Backend Router File** | Router file relative path |
| **API Endpoints** | HTTP method + path (base: `/api/v1`) |
| **Pydantic Schemas** | Schema files |
| **DB Models** | Model files |

---

## Backend Architecture Note

The backend has two parallel structures:

1. **Legacy path** (`backend/app/`) — Original FastAPI routers, models, schemas used during initial development
2. **Clean Architecture path** (`backend/src/`) — Refactored with domain-driven design layers:
   - `src/api/v1/` — Routers, schemas, dependencies
   - `src/application/use_cases/` — Business logic
   - `src/domain/entities/` — Core domain models
   - `src/infrastructure/persistence/` — SQLAlchemy models, repositories, database

Both paths serve the same API contract. The `src/` path is the canonical implementation.

---

## Phase 1 — Backend Foundation

### Task 1 — FastAPI Project Scaffold

| Item | Value |
|---|---|
| **Backend Files (legacy)** | `backend/app/main.py`, `backend/app/config.py`, `backend/app/database.py`, `backend/requirements.txt`, `backend/run.py` |
| **Backend Files (clean)** | `backend/src/main.py`, `backend/src/config/settings.py`, `backend/src/infrastructure/persistence/database.py` |
| **Key Config** | DB: `postgresql+asyncpg://postgres:root@localhost:5432/medrecords` |
| **CORS Origin** | `http://localhost:4200` |
| **API Docs** | `GET /api/docs` (Swagger), `GET /api/redoc`, `GET /api/openapi.json` |
| **Health Check** | `GET /health` |
| **Middleware** | `src/api/middleware/correlation_id.py`, `src/api/middleware/exception_handler.py` |

---

### Task 2 — SQLAlchemy ORM Models

| Model File (legacy) | Model File (clean) | Domain Entity | DB Table | Key Columns |
|---|---|---|---|---|
| `app/models/user.py` | `src/infrastructure/persistence/models/user_model.py` | `src/domain/entities/user.py` | `users` | id, username, email, full_name, hashed_password, role, specialty, is_active |
| `app/models/disease.py` | `src/infrastructure/persistence/models/disease_model.py` | `src/domain/entities/disease.py` | `diseases`, `sub_diseases` | id, name, description, is_active, created_by |
| `app/models/form_template.py` | `src/infrastructure/persistence/models/form_template_model.py` | `src/domain/entities/form_template.py` | `form_templates` | id, disease_id, version, schema (JSONB), is_active, created_by |
| `app/models/medicine.py` | `src/infrastructure/persistence/models/medicine_model.py` | `src/domain/entities/medicine.py` | `medicines` | id, name, category, unit, is_active |
| `app/models/patient.py` | `src/infrastructure/persistence/models/patient_model.py` | `src/domain/entities/patient.py` | `patients` | id, patient_uid, first_name, last_name, date_of_birth, gender, contact_number, email, registered_by |
| `app/models/assessment.py` | `src/infrastructure/persistence/models/assessment_model.py` | `src/domain/entities/assessment.py` | `assessments` | id, patient_id, doctor_id, disease_id, sub_disease_id, template_id, template_snapshot, form_data, status, consent_given, lock_expires_at |
| `app/models/prescription_row.py` | `src/infrastructure/persistence/models/prescription_row_model.py` | `src/domain/entities/prescription_row.py` | `prescription_rows` | id, assessment_id, medicine_id, dosage, frequency, duration, instructions, sort_order |
| `app/models/consent_record.py` | `src/infrastructure/persistence/models/consent_record_model.py` | `src/domain/entities/consent_record.py` | `consent_records` | id, assessment_id, patient_id, doctor_id, consent_statement_version, consented_at |
| `app/models/audit_log.py` | `src/infrastructure/persistence/models/audit_log_model.py` | `src/domain/entities/audit_log.py` | `audit_logs` | id, event_type, actor_id, actor_username, actor_role, entity_type, entity_id, description, ip_address |
| `app/models/app_config.py` | `src/infrastructure/persistence/models/app_config_model.py` | `src/domain/entities/app_config.py` | `app_config` | id, config_key, config_value, updated_by |
| `app/models/followup.py` | `src/infrastructure/persistence/models/followup_model.py` | `src/domain/entities/followup.py` | `followups` | id, patient_id, doctor_id, assessment_id, scheduled_date, notes, status |

---

### Task 3 — Alembic Migrations & Seed Data

| Item | Value |
|---|---|
| **Migration Files** | `backend/alembic/versions/0001_initial_schema.py`, `0002_medicine_brd_fields.py`, `0003_followups_table.py` |
| **Alembic Config** | `backend/alembic.ini`, `backend/alembic/env.py` |
| **Seed Script** | `backend/seed.py` |
| **Seed Data** | `users`: sys_admin (username=`admin`, password=`Admin@1234`) |
| **Seed Data** | `app_config`: `lock_window_hours = 24` |

---

### Task 4 — Authentication Router

| Item | Value |
|---|---|
| **Route** | `/login` (frontend) |
| **Backend Router (legacy)** | `app/routers/auth.py` |
| **Backend Router (clean)** | `src/api/v1/auth.py` |
| **Dependencies** | `app/dependencies/auth.py`, `src/api/v1/dependencies/auth.py` |
| **Schema** | `app/schemas/auth.py`, `src/api/v1/schemas/auth.py` |
| **Use Cases** | `src/application/use_cases/auth/` |
| **DB Models** | `users`, `audit_logs` |

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/auth/login` | POST | public | Validate credentials → JWT |
| `/api/v1/auth/me` | GET | authenticated | Current user profile |
| `/api/v1/auth/logout` | POST | authenticated | Audit log entry |

---

### Task 5 — Disease & Sub-Disease Router

| Item | Value |
|---|---|
| **Angular Route** | `/admin/diseases` |
| **Angular Component** | `features/diseases/diseases.component.ts` |
| **Backend Router (legacy)** | `app/routers/diseases.py` |
| **Backend Router (clean)** | `src/api/v1/diseases.py` |
| **Repository** | `src/infrastructure/persistence/repositories/disease_repository_impl.py` |
| **Use Cases** | `src/application/use_cases/diseases/` |
| **Schema** | `app/schemas/disease.py` |
| **DB Models** | `diseases`, `sub_diseases` |

| Endpoint | Method | Role |
|---|---|---|
| `/api/v1/diseases/` | GET | all roles (active only) |
| `/api/v1/diseases/` | POST | admin |
| `/api/v1/diseases/{id}` | GET | all roles |
| `/api/v1/diseases/{id}` | PATCH | admin |
| `/api/v1/diseases/{id}` | DELETE | admin |
| `/api/v1/diseases/{id}/restore` | POST | admin |
| `/api/v1/diseases/{id}/sub-diseases` | GET | all roles |
| `/api/v1/diseases/{id}/sub-diseases` | POST | admin |
| `/api/v1/diseases/{id}/sub-diseases/{sid}` | PATCH | admin |
| `/api/v1/diseases/{id}/sub-diseases/{sid}` | DELETE | admin |

---

### Task 6 — Form Template Router

| Item | Value |
|---|---|
| **Angular Routes** | `/admin/templates`, `/admin/templates/new`, `/admin/templates/:id` |
| **Angular Components** | `features/templates/templates-list.component.ts`, `features/templates/template-builder.component.ts` |
| **Backend Router (legacy)** | `app/routers/templates.py` |
| **Backend Router (clean)** | `src/api/v1/templates.py` |
| **Repository** | `src/infrastructure/persistence/repositories/template_repository_impl.py` |
| **Use Cases** | `src/application/use_cases/templates/` |
| **Schema** | `app/schemas/template.py` |
| **DB Models** | `form_templates` |

| Endpoint | Method | Role |
|---|---|---|
| `/api/v1/templates/` | GET | all roles |
| `/api/v1/templates/` | POST | admin |
| `/api/v1/templates/{id}` | GET | all roles |
| `/api/v1/templates/{id}` | PUT | admin |
| `/api/v1/templates/{id}` | DELETE | admin |
| `/api/v1/templates/disease/{disease_id}/active` | GET | all roles |

---

### Task 7 — Medicine Router with Bulk Import

| Item | Value |
|---|---|
| **Angular Route** | `/admin/medicines` |
| **Angular Component** | `features/medicines/medicines.component.ts` |
| **Backend Router (legacy)** | `app/routers/medicines.py` |
| **Backend Router (clean)** | `src/api/v1/medicines.py` |
| **Repository** | `src/infrastructure/persistence/repositories/medicine_repository_impl.py` |
| **Use Cases** | `src/application/use_cases/medicines/` |
| **Schema** | `app/schemas/medicine.py` |
| **DB Models** | `medicines` |

| Endpoint | Method | Role |
|---|---|---|
| `/api/v1/medicines/` | GET | all roles |
| `/api/v1/medicines/` | POST | admin |
| `/api/v1/medicines/{id}` | GET | all roles |
| `/api/v1/medicines/{id}` | PATCH | admin |
| `/api/v1/medicines/{id}` | DELETE | admin |
| `/api/v1/medicines/import` | POST | admin |
| `/api/v1/medicines/template` | GET | admin |

---

### Task 8 — Patients Router

| Item | Value |
|---|---|
| **Angular Routes** | `/doctor/patients`, `/doctor/patients/new`, `/doctor/patients/:id` |
| **Angular Components** | `features/patients/patients-list.component.ts`, `features/patients/register-patient.component.ts`, `features/patients/patient-detail.component.ts` |
| **Backend Router (legacy)** | `app/routers/patients.py` |
| **Backend Router (clean)** | `src/api/v1/patients.py` |
| **Repository** | `src/infrastructure/persistence/repositories/patient_repository_impl.py` |
| **Use Cases** | `src/application/use_cases/patients/` |
| **Schema** | `app/schemas/patient.py`, `src/api/v1/schemas/patient.py` |
| **DB Models** | `patients` |

| Endpoint | Method | Role |
|---|---|---|
| `/api/v1/patients/` | GET | doctor (own), admin (all) |
| `/api/v1/patients/` | POST | doctor |
| `/api/v1/patients/{id}` | GET | doctor (own), admin |
| `/api/v1/patients/{id}` | PATCH | doctor (own) |
| `/api/v1/patients/{id}` | DELETE | doctor (own) |

---

### Task 9 — Assessments Router & Lock Scheduler

| Item | Value |
|---|---|
| **Angular Routes** | `/doctor/assessments/new`, `/doctor/assessments/:id` |
| **Angular Component** | `features/assessments/assessment-form.component.ts` |
| **Backend Router (legacy)** | `app/routers/assessments.py` |
| **Backend Router (clean)** | `src/api/v1/assessments.py` |
| **Repository** | `src/infrastructure/persistence/repositories/assessment_repository_impl.py` |
| **Use Cases** | `src/application/use_cases/assessments/` |
| **Background Service** | `app/services/lock_scheduler.py` |
| **Schema** | `app/schemas/assessment.py`, `src/api/v1/schemas/assessment.py` |
| **DB Models** | `assessments`, `consent_records` |

| Endpoint | Method | Role |
|---|---|---|
| `/api/v1/assessments/` | GET | doctor (own), admin (all) |
| `/api/v1/assessments/` | POST | doctor |
| `/api/v1/assessments/{id}` | GET | doctor (own), admin |
| `/api/v1/assessments/{id}` | PUT | doctor (within lock window) |
| `/api/v1/assessments/{id}/submit` | POST | doctor |
| `/api/v1/assessments/dashboard/kpis` | GET | doctor |

---

### Task 10 — Prescription, Analytics, Export, Audit, Config, Users Routers

#### Prescriptions

| Endpoint | Method | Role | DB Models |
|---|---|---|---|
| `/api/v1/prescriptions/assessment/{aid}` | GET | doctor, admin | `prescription_rows`, `medicines` |
| `/api/v1/prescriptions/assessment/{aid}` | POST | doctor | `prescription_rows` |

**Backend Router:** `app/routers/prescriptions.py`, `src/api/v1/prescriptions.py`
**Repository:** `src/infrastructure/persistence/repositories/prescription_repository_impl.py`
**Use Cases:** `src/application/use_cases/prescriptions/`

#### Analytics

| Endpoint | Method | Role | DB Models |
|---|---|---|---|
| `/api/v1/analytics/kpis` | GET | admin, pharma_viewer | `assessments`, `patients`, `users` |
| `/api/v1/analytics/monthly-volume` | GET | admin, pharma_viewer | `assessments` |
| `/api/v1/analytics/by-disease` | GET | admin, pharma_viewer | `assessments`, `diseases` |
| `/api/v1/analytics/trend` | GET | admin, pharma_viewer | `assessments` |
| `/api/v1/analytics/disease-summary` | GET | admin, pharma_viewer | `assessments`, `diseases` |

**Backend Router:** `app/routers/analytics.py`, `src/api/v1/analytics.py`
**Schema:** `app/schemas/analytics.py`
**Use Cases:** `src/application/use_cases/analytics/`

#### Exports

| Endpoint | Method | Role | DB Models |
|---|---|---|---|
| `/api/v1/exports/assessments/excel` | GET | doctor, admin | `assessments`, `patients`, `prescription_rows` |
| `/api/v1/exports/assessments/{id}/pdf-data` | GET | doctor, admin | `assessments`, `patients`, `prescription_rows`, `form_templates` |
| `/api/v1/exports/audit/excel` | GET | admin, sys_admin | `audit_logs` |

**Backend Router:** `app/routers/exports.py`, `src/api/v1/exports.py`
**Use Cases:** `src/application/use_cases/exports/`

#### Audit Log

| Endpoint | Method | Role | DB Models |
|---|---|---|---|
| `/api/v1/audit/` | GET | admin, sys_admin | `audit_logs` |

**Backend Router:** `app/routers/audit.py`, `src/api/v1/audit.py`
**Schema:** `app/schemas/audit_log.py`
**Repository:** `src/infrastructure/persistence/repositories/audit_log_repository_impl.py`
**Use Cases:** `src/application/use_cases/audit/`

#### App Config

| Endpoint | Method | Role | DB Models |
|---|---|---|---|
| `/api/v1/config/` | GET | sys_admin | `app_config` |
| `/api/v1/config/{key}` | PATCH | sys_admin | `app_config` |

**Backend Router:** `app/routers/config_router.py`, `src/api/v1/config_router.py`
**Repository:** `src/infrastructure/persistence/repositories/config_repository_impl.py`
**Use Cases:** `src/application/use_cases/config/`

#### Users

| Endpoint | Method | Role | DB Models |
|---|---|---|---|
| `/api/v1/users/` | GET | sys_admin, admin | `users` |
| `/api/v1/users/` | POST | sys_admin | `users` |
| `/api/v1/users/{id}` | GET | sys_admin, admin | `users` |
| `/api/v1/users/{id}` | PATCH | sys_admin | `users` |
| `/api/v1/users/{id}` | DELETE | sys_admin | `users` |
| `/api/v1/users/{id}/reset-password` | POST | sys_admin | `users` |

**Backend Router:** `app/routers/users.py`, `src/api/v1/users.py`
**Schema:** `app/schemas/user.py`
**Repository:** `src/infrastructure/persistence/repositories/user_repository_impl.py`
**Use Cases:** `src/application/use_cases/users/`

---

## Phase 2 — Angular Frontend Foundation

### Task 11 — Angular Scaffold & Design System

| Item | Value |
|---|---|
| **Files** | `frontend/angular.json`, `frontend/package.json` |
| **Styles** | `frontend/src/styles.css` (Emcure tokens from `docs/index.css`) |
| **Assets** | `frontend/src/assets/logo.png`, `frontend/src/favicon.ico` |
| **App Config** | `frontend/src/app/app.config.ts` |
| **Theme** | `frontend/src/app/core/theme/` |
| **Key Libraries** | `primeng`, `@primeuix/themes`, `primeicons`, `tailwindcss`, `xlsx`, `jspdf`, `jspdf-autotable` |

---

### Task 12 — Auth Service, Interceptors & Guards

| Item | Value |
|---|---|
| **Service** | `core/auth/auth.service.ts` |
| **Auth Models** | `core/auth/models/auth.models.ts` |
| **Guards** | `core/auth/auth.guard.ts`, `core/auth/doctor.guard.ts`, `core/auth/admin.guard.ts`, `core/auth/pharma.guard.ts`, `core/auth/sysadmin.guard.ts`, `core/auth/guest.guard.ts` |
| **Interceptors** | `core/interceptors/jwt.interceptor.ts`, `core/interceptors/error.interceptor.ts` |
| **Token Storage** | `localStorage` key: `med_token` |
| **Signals** | `currentUser: signal<UserProfile\|null>`, `isAuthenticated: computed(...)` |

---

### Task 13 — Shared Layout Components

| Component | File | Purpose |
|---|---|---|
| `AppShellComponent` | `shared/components/app-shell/app-shell.component.ts` | Layout: sidebar + topbar + router-outlet |
| `SidebarComponent` | `shared/components/sidebar/sidebar.component.ts` | Role-based nav, collapsible signal |
| `TopbarComponent` | `shared/components/topbar/topbar.component.ts` | Logo, user name, logout |
| `KpiCardComponent` | `shared/components/kpi-card/kpi-card.component.ts` | Icon, value, label, hover animation |
| `StatusBadgeComponent` | `shared/components/status-badge/status-badge.component.ts` | draft / submitted / locked badges |
| `SafeDatePipe` | `shared/pipes/safe-date.pipe.ts` | Null-safe date formatting |

---

### Task 14 — App Routing & Login Feature

| Route | Component File | Guard(s) |
|---|---|---|
| `/login` | `features/auth/login.component.ts` | `guestGuard` |
| `/doctor` (shell) | `shared/components/app-shell/app-shell.component.ts` | `authGuard`, `doctorGuard` |
| `/doctor/dashboard` | `features/doctor-dashboard/doctor-dashboard.component.ts` | (child of doctor shell) |
| `/doctor/patients` | `features/patients/patients-list.component.ts` | (child of doctor shell) |
| `/doctor/patients/new` | `features/patients/register-patient.component.ts` | (child of doctor shell) |
| `/doctor/patients/:id` | `features/patients/patient-detail.component.ts` | (child of doctor shell) |
| `/doctor/assessments/new` | `features/assessments/assessment-form.component.ts` | (child of doctor shell) |
| `/doctor/assessments/:id` | `features/assessments/assessment-form.component.ts` | (child of doctor shell) |
| `/doctor/followups` | `features/followup-calendar/followup-calendar.component.ts` | (child of doctor shell) |
| `/admin` (shell) | `shared/components/app-shell/app-shell.component.ts` | `authGuard`, `adminGuard` |
| `/admin/analytics` | `features/analytics-admin/admin-analytics.component.ts` | (child of admin shell) |
| `/admin/diseases` | `features/diseases/diseases.component.ts` | (child of admin shell) |
| `/admin/templates` | `features/templates/templates-list.component.ts` | (child of admin shell) |
| `/admin/templates/new` | `features/templates/template-builder.component.ts` | (child of admin shell) |
| `/admin/templates/:id` | `features/templates/template-builder.component.ts` | (child of admin shell) |
| `/admin/medicines` | `features/medicines/medicines.component.ts` | (child of admin shell) |
| `/admin/doctors` | `features/doctors/doctors.component.ts` | (child of admin shell) |
| `/admin/audit` | `features/audit-log/audit-log.component.ts` | (child of admin shell) |
| `/pharma` (shell) | `shared/components/app-shell/app-shell.component.ts` | `authGuard`, `pharmaGuard` |
| `/pharma/analytics` | `features/analytics-pharma/pharma-analytics.component.ts` | (child of pharma shell) |
| `/sysadmin` (shell) | `shared/components/app-shell/app-shell.component.ts` | `authGuard`, `sysAdminGuard` |
| `/sysadmin/config` | `features/system-config/system-config.component.ts` | (child of sysadmin shell) |
| `/sysadmin/users` | `features/system-config/user-management.component.ts` | (child of sysadmin shell) |

**Route Config File:** `frontend/src/app/app.routes.ts`

---

## Phase 3 — Admin Master Data Features

### Task 15 — Disease & Sub-Disease Management Feature

| Item | Value |
|---|---|
| **Angular Route** | `/admin/diseases` |
| **Component** | `features/diseases/diseases.component.ts` |
| **Service** | `features/diseases/disease.service.ts` |
| **Guards** | `authGuard`, `adminGuard` |
| **Backend Router** | `app/routers/diseases.py`, `src/api/v1/diseases.py` |
| **API Endpoints** | `GET/POST/PATCH/DELETE /api/v1/diseases/`, sub-disease sub-routes |
| **DB Models** | `diseases`, `sub_diseases` |
| **PrimeNG Components** | `p-table`, `p-dialog`, `p-confirmdialog`, `p-button`, `p-tag` |

---

### Task 16 — Form Template Builder Feature

| Item | Value |
|---|---|
| **Angular Routes** | `/admin/templates`, `/admin/templates/new`, `/admin/templates/:id` |
| **Components** | `features/templates/templates-list.component.ts`, `features/templates/template-builder.component.ts` |
| **Guards** | `authGuard`, `adminGuard` |
| **Backend Router** | `app/routers/templates.py`, `src/api/v1/templates.py` |
| **API Endpoints** | `GET/POST/PUT/DELETE /api/v1/templates/`, `GET /api/v1/templates/disease/{id}/active` |
| **DB Models** | `form_templates` |
| **Dependencies** | Uses `DynamicFormComponent` for live preview |
| **Schema Format** | Design spec §3 — sections → fields → type/validation JSON |

---

### Task 17 — Medicine Master Feature

| Item | Value |
|---|---|
| **Angular Route** | `/admin/medicines` |
| **Component** | `features/medicines/medicines.component.ts` |
| **Guards** | `authGuard`, `adminGuard` |
| **Backend Router** | `app/routers/medicines.py`, `src/api/v1/medicines.py` |
| **API Endpoints** | `GET/POST/PATCH/DELETE /api/v1/medicines/`, `POST /api/v1/medicines/import`, `GET /api/v1/medicines/template` |
| **DB Models** | `medicines` |
| **PrimeNG Components** | `p-table`, `p-dialog`, `p-fileupload`, `p-button` |

---

### Task 18 — Doctor Account Management Feature

| Item | Value |
|---|---|
| **Angular Route** | `/admin/doctors` |
| **Component** | `features/doctors/doctors.component.ts` |
| **Guards** | `authGuard`, `adminGuard` |
| **Backend Router** | `app/routers/users.py`, `src/api/v1/users.py` |
| **API Endpoints** | `GET/POST/PATCH/DELETE /api/v1/users/`, `POST /api/v1/users/{id}/reset-password` |
| **DB Models** | `users` (role filter: `doctor`) |
| **PrimeNG Components** | `p-table`, `p-dialog`, `p-password` |

---

## Phase 4 — Doctor Workflow

### Task 19 — Patient Registration & List Feature

| Item | Value |
|---|---|
| **Angular Routes** | `/doctor/patients`, `/doctor/patients/new`, `/doctor/patients/:id` |
| **Components** | `features/patients/patients-list.component.ts`, `features/patients/register-patient.component.ts`, `features/patients/patient-detail.component.ts` |
| **Guards** | `authGuard`, `doctorGuard` |
| **Backend Router** | `app/routers/patients.py`, `src/api/v1/patients.py` |
| **API Endpoints** | `GET/POST/PATCH/DELETE /api/v1/patients/`, `GET /api/v1/patients/{id}` |
| **DB Models** | `patients` |
| **UID Format** | `PAT-000001` (zero-padded sequential) |
| **UID Generator** | `src/infrastructure/persistence/uid_generator.py` |

---

### Task 20 — Dynamic Form Rendering Engine

| Item | Value |
|---|---|
| **Components** | `shared/components/dynamic-form/dynamic-form.component.ts`, `shared/components/dynamic-form/dynamic-section.component.ts`, `shared/components/dynamic-form/dynamic-field.component.ts` |
| **Input** | `schema: input.required<FormSchema>()` (JSON from `form_templates.schema`) |
| **Outputs** | `getFormData(): Record<string, Record<string, unknown>>`, `isValid(): boolean` |
| **Read-only Mode** | `isReadonly: input<boolean>(false)` — disables all controls (locked assessments) |
| **Schema Source** | `GET /api/v1/templates/disease/{id}/active` |
| **DB Models** | `form_templates` |

| Field Type | Angular Control | PrimeNG Component |
|---|---|---|
| `text` | `FormControl<string>` | `p-inputtext` |
| `number` | `FormControl<number>` | `p-inputnumber` |
| `date` | `FormControl<Date>` | `p-datepicker` |
| `select` | `FormControl<string>` | `p-select` |
| `multiselect` | `FormControl<string[]>` | `p-multiselect` |
| `radio` | `FormControl<string>` | `p-radiobutton` group |
| `checkbox_group` | `FormControl<string[]>` | `p-checkbox` group |
| `textarea` | `FormControl<string>` | `p-textarea` |

---

### Task 21 — Prescription Grid Component

| Item | Value |
|---|---|
| **Component** | `shared/components/prescription-grid/prescription-grid.component.ts` |
| **Form Structure** | `FormArray` of `FormGroup` rows |
| **Medicine Field** | Searchable `p-select` — calls `GET /api/v1/medicines/` |
| **Row Fields** | medicine_id, dosage, frequency, duration, instructions, sort_order |
| **Read-only Mode** | Hides add/remove buttons, renders plain text |
| **Validation** | At least one row required before assessment submit |
| **API** | `GET/POST /api/v1/prescriptions/assessment/{aid}` |
| **DB Models** | `prescription_rows`, `medicines` |

---

### Task 22 — Assessment Form (New / Edit / View)

| Item | Value |
|---|---|
| **Angular Routes** | `/doctor/assessments/new?patientId=X`, `/doctor/assessments/:id` |
| **Component** | `features/assessments/assessment-form.component.ts` |
| **Service** | `features/assessments/assessment.service.ts` |
| **Guards** | `authGuard`, `doctorGuard` |
| **Sub-components** | `DynamicFormComponent`, `PrescriptionGridComponent`, `StatusBadgeComponent` |
| **Backend Routers** | `app/routers/assessments.py`, `app/routers/prescriptions.py`, `app/routers/templates.py` |
| **DB Models** | `assessments`, `consent_records`, `prescription_rows` |

| Assessment State | UI Behaviour |
|---|---|
| `draft` | All inputs editable, Save Draft + Submit buttons visible |
| `submitted` | Lock window countdown displayed, editable within window |
| `locked` | All inputs disabled (`isReadonly=true`), no Save/Submit, status badge |

---

## Phase 5 — Export Features

### Task 23 — Doctor Dashboard

| Item | Value |
|---|---|
| **Angular Route** | `/doctor/dashboard` |
| **Component** | `features/doctor-dashboard/doctor-dashboard.component.ts` |
| **Guards** | `authGuard`, `doctorGuard` |
| **API Endpoints** | `GET /api/v1/assessments/dashboard/kpis` |
| **DB Models** | `assessments`, `patients` |

| KPI Card | Metric |
|---|---|
| Total Patients | Distinct patients registered by doctor |
| This Month Assessments | Submitted this calendar month |
| Drafts | Assessments in `draft` status |
| Locked | Assessments in `locked` status |

---

### Task 24 — Client-Side Excel Export

| Item | Value |
|---|---|
| **Service** | `core/services/export.service.ts` |
| **Library** | `xlsx` (SheetJS) |
| **Doctor Export API** | `GET /api/v1/exports/assessments/excel?month=&year=` |
| **Admin Export API** | `GET /api/v1/exports/assessments/excel` (with filter params) |
| **Audit Export API** | `GET /api/v1/exports/audit/excel` |
| **File Naming** | `MEDRecords_[ExportType]_[YYYY-MM-DD].xlsx` |
| **DB Models** | `assessments`, `patients`, `prescription_rows`, `audit_logs` |

---

### Task 25 — Client-Side PDF Export

| Item | Value |
|---|---|
| **Service** | `core/services/export.service.ts` (extended) |
| **Libraries** | `jspdf`, `jspdf-autotable` |
| **API** | `GET /api/v1/exports/assessments/{id}/pdf-data` |
| **PDF Sections** | Emcure logo header, patient demographics, assessment fields (label+value), prescription table, disclaimer footer |
| **File Naming** | `MEDRecords_Patient_[PatientID]_Visit_[YYYY-MM-DD].pdf` |
| **DB Models** | `assessments`, `patients`, `prescription_rows`, `form_templates` |

---

## Phase 6 — Admin Analytics & Audit

### Task 26 — Admin Analytics Dashboard

| Item | Value |
|---|---|
| **Angular Route** | `/admin/analytics` |
| **Component** | `features/analytics-admin/admin-analytics.component.ts` |
| **Guards** | `authGuard`, `adminGuard` |
| **Backend Router** | `app/routers/analytics.py`, `src/api/v1/analytics.py` |
| **DB Models** | `assessments`, `patients`, `diseases`, `users` |

| View Mode | Charts / Tables |
|---|---|
| Graphical | Bar chart (monthly volume), Donut chart (by disease), Line chart (trend) |
| Numerical | Statistical summary table |

| Filter | API Parameter |
|---|---|
| Date range | `date_from`, `date_to` |
| Disease | `disease_id` (multi) |
| Doctor | `doctor_id` (multi) |

---

### Task 27 — Audit Log Feature

| Item | Value |
|---|---|
| **Angular Route** | `/admin/audit` |
| **Component** | `features/audit-log/audit-log.component.ts` |
| **Guards** | `authGuard`, `adminGuard` |
| **Backend Router** | `app/routers/audit.py`, `src/api/v1/audit.py` |
| **API Endpoints** | `GET /api/v1/audit/` (paginated, filterable), `GET /api/v1/exports/audit/excel` |
| **DB Models** | `audit_logs` |
| **Note** | Append-only: no edit/delete controls in UI or backend |

---

### Task 28 — Pharma Analytics View

| Item | Value |
|---|---|
| **Angular Route** | `/pharma/analytics` |
| **Component** | `features/analytics-pharma/pharma-analytics.component.ts` |
| **Guards** | `authGuard`, `pharmaGuard` |
| **Backend Router** | `app/routers/analytics.py`, `src/api/v1/analytics.py` (same endpoints, different role) |
| **API Endpoints** | Same as admin analytics (`/kpis`, `/monthly-volume`, `/by-disease`, `/trend`, `/disease-summary`) |
| **DB Models** | `assessments`, `diseases`, `prescription_rows` |
| **Privacy Rule** | No patient identifiers (no names, no patient UIDs) — aggregated data only |

---

## Phase 7 — Pharma Viewer & System Admin

### Task 29 — User Management & Platform Config

| Item | Value |
|---|---|
| **Angular Routes** | `/sysadmin/users`, `/sysadmin/config` |
| **Components** | `features/system-config/user-management.component.ts`, `features/system-config/system-config.component.ts` |
| **Service** | `core/services/config.service.ts` |
| **Guards** | `authGuard`, `sysAdminGuard` |
| **Backend Routers** | `app/routers/users.py`, `app/routers/config_router.py`, `src/api/v1/users.py`, `src/api/v1/config_router.py` |
| **DB Models** | `users`, `app_config` |

| Config Key | Default | Description |
|---|---|---|
| `lock_window_hours` | `24` | Hours after submission before assessment auto-locks |

---

## Phase 8 — Supporting Files

### Task 30 — Project Documentation

| File | Path | Description |
|---|---|---|
| `agents.md` | `docs/agents.md` | Agent roles, responsibilities, handoff contracts |
| `context_map.md` | `docs/context_map.md` | This file — spec-to-implementation mapping |

---

## Follow-up Calendar Feature

### Backend — Follow-ups API

| Item | Value |
|---|---|
| **Backend Router (legacy)** | `app/routers/followups.py` |
| **Backend Router (clean)** | `src/api/v1/followups.py` |
| **Repository** | `src/infrastructure/persistence/repositories/followup_repository_impl.py` |
| **Use Cases** | `src/application/use_cases/followups/` |
| **Domain Entity** | `src/domain/entities/followup.py` |
| **Persistence Model** | `src/infrastructure/persistence/models/followup_model.py` |
| **Migration** | `alembic/versions/0003_followups_table.py` |
| **DB Table** | `followups` |

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/followups/` | POST | doctor | Create follow-up (1–365 days in future) |
| `/api/v1/followups/` | GET | doctor | Paginated list (doctor-scoped), filter by status/patient |
| `/api/v1/followups/dashboard` | GET | doctor | Pending count + today's follow-ups |
| `/api/v1/followups/calendar` | GET | doctor | Date range query (max 42 days, start_date/end_date) |
| `/api/v1/followups/{id}` | GET | doctor | Get single follow-up (doctor-scoped) |
| `/api/v1/followups/{id}` | PATCH | doctor | Update status/date/notes (state machine enforced) |

**State Machine:**
```
pending → completed
pending → cancelled
completed → (terminal)
cancelled → (terminal)
```

### Frontend — Follow-up Calendar

| Item | Value |
|---|---|
| **Angular Route** | `/doctor/followups` |
| **Guards** | `authGuard`, `doctorGuard` |
| **Service** | `core/services/followup.service.ts` |

| Component File | Purpose |
|---|---|
| `features/followup-calendar/followup-calendar.component.ts` | Calendar orchestrator (month/week/day toggle) |
| `features/followup-calendar/calendar-month-view.component.ts` | Month grid view |
| `features/followup-calendar/calendar-week-view.component.ts` | Week grid view |
| `features/followup-calendar/calendar-day-view.component.ts` | Day view |
| `features/followup-calendar/calendar-header.component.ts` | Navigation (prev/next, view toggle) |
| `features/followup-calendar/calendar-event.component.ts` | Event chip rendering |
| `features/followup-calendar/event-action-panel.component.ts` | Status transition actions |
| `features/followup-calendar/schedule-dialog.component.ts` | Schedule new follow-up dialog |
| `features/followup-calendar/calendar-date.utils.ts` | Date utility functions |
| `shared/components/followup-dialog/followup-dialog.component.ts` | Shared scheduling dialog (reusable from assessment/patient views) |

---

## Full Feature × Implementation Matrix

| Feature | Route | Component | Service | Backend Router | DB Models |
|---|---|---|---|---|---|
| Login | `/login` | `auth/login.component.ts` | `auth.service.ts` | `auth.py` | `users`, `audit_logs` |
| Doctor Dashboard | `/doctor/dashboard` | `doctor-dashboard/doctor-dashboard.component.ts` | `assessment.service.ts` | `assessments.py` | `assessments`, `patients` |
| Patient List | `/doctor/patients` | `patients/patients-list.component.ts` | `patient.service.ts` | `patients.py` | `patients` |
| Patient Registration | `/doctor/patients/new` | `patients/register-patient.component.ts` | `patient.service.ts` | `patients.py` | `patients` |
| Patient Detail | `/doctor/patients/:id` | `patients/patient-detail.component.ts` | `patient.service.ts` | `patients.py`, `assessments.py` | `patients`, `assessments` |
| New Assessment | `/doctor/assessments/new` | `assessments/assessment-form.component.ts` | `assessment.service.ts` | `assessments.py`, `prescriptions.py` | `assessments`, `consent_records`, `prescription_rows` |
| Edit/View Assessment | `/doctor/assessments/:id` | `assessments/assessment-form.component.ts` | `assessment.service.ts` | `assessments.py`, `prescriptions.py` | `assessments`, `prescription_rows` |
| Follow-up Calendar | `/doctor/followups` | `followup-calendar/followup-calendar.component.ts` | `followup.service.ts` | `followups.py` | `followups`, `patients`, `assessments` |
| Disease Management | `/admin/diseases` | `diseases/diseases.component.ts` | `disease.service.ts` | `diseases.py` | `diseases`, `sub_diseases` |
| Template List | `/admin/templates` | `templates/templates-list.component.ts` | TemplateService | `templates.py` | `form_templates` |
| Template Builder | `/admin/templates/new`, `/admin/templates/:id` | `templates/template-builder.component.ts` | TemplateService | `templates.py` | `form_templates` |
| Medicine Management | `/admin/medicines` | `medicines/medicines.component.ts` | MedicineService | `medicines.py` | `medicines` |
| Doctor Management | `/admin/doctors` | `doctors/doctors.component.ts` | UserService | `users.py` | `users` |
| Admin Analytics | `/admin/analytics` | `analytics-admin/admin-analytics.component.ts` | AnalyticsService | `analytics.py` | `assessments`, `diseases`, `users` |
| Audit Log | `/admin/audit` | `audit-log/audit-log.component.ts` | AuditService | `audit.py`, `exports.py` | `audit_logs` |
| Pharma Analytics | `/pharma/analytics` | `analytics-pharma/pharma-analytics.component.ts` | AnalyticsService | `analytics.py` | `assessments`, `diseases` |
| User Management | `/sysadmin/users` | `system-config/user-management.component.ts` | UserService | `users.py` | `users` |
| System Config | `/sysadmin/config` | `system-config/system-config.component.ts` | `config.service.ts` | `config_router.py` | `app_config` |

---

## Shared Component Usage Map

| Shared Component | Used In |
|---|---|
| `AppShellComponent` | All authenticated routes (wraps sidebar + topbar) |
| `SidebarComponent` | `AppShellComponent` |
| `TopbarComponent` | `AppShellComponent` |
| `KpiCardComponent` | `DoctorDashboardComponent`, `AdminAnalyticsComponent`, `PharmaAnalyticsComponent` |
| `StatusBadgeComponent` | `AssessmentFormComponent`, `PatientsListComponent`, `DoctorDashboardComponent`, `AuditLogComponent` |
| `DynamicFormComponent` | `AssessmentFormComponent`, `TemplateBuilderComponent` (preview) |
| `DynamicSectionComponent` | `DynamicFormComponent` |
| `DynamicFieldComponent` | `DynamicSectionComponent` |
| `PrescriptionGridComponent` | `AssessmentFormComponent` |
| `FollowupDialogComponent` | `AssessmentFormComponent`, `PatientDetailComponent`, `FollowupCalendarComponent` |
| `SafeDatePipe` | `ExportService`, date columns throughout |
| `JwtInterceptor` | All HTTP calls (via `app.config.ts`) |
| `ErrorInterceptor` | All HTTP calls (via `app.config.ts`) |

---

## Core Services Map

| Service | File | Responsibilities |
|---|---|---|
| `AuthService` | `core/auth/auth.service.ts` | Login, logout, token management, user signals |
| `ExportService` | `core/services/export.service.ts` | XLSX and PDF client-side generation |
| `FollowupService` | `core/services/followup.service.ts` | Follow-up CRUD, calendar, dashboard queries |
| `ConfigService` | `core/services/config.service.ts` (if exists) | Platform config signal + API |

---

## DB Model Dependency Graph

```
users
  ├── diseases (created_by → users.id)
  │     └── sub_diseases (disease_id → diseases.id)
  │           └── form_templates (disease_id → diseases.id, created_by → users.id)
  ├── patients (registered_by → users.id)
  │     ├── assessments (patient_id → patients.id, doctor_id → users.id,
  │     │                 disease_id → diseases.id, template_id → form_templates.id)
  │     │     ├── prescription_rows (assessment_id → assessments.id,
  │     │     │                       medicine_id → medicines.id)
  │     │     └── consent_records (assessment_id → assessments.id,
  │     │                           patient_id → patients.id,
  │     │                           doctor_id → users.id)
  │     └── followups (patient_id → patients.id, doctor_id → users.id,
  │                     assessment_id → assessments.id [nullable])
  ├── audit_logs (actor_id → users.id)
  └── app_config (updated_by → users.id)

medicines (standalone master, referenced by prescription_rows)
```

---

## Clean Architecture Layer Map

### Domain Layer (`backend/src/domain/`)

| File | Entity |
|---|---|
| `entities/user.py` | User domain model |
| `entities/disease.py` | Disease + SubDisease |
| `entities/form_template.py` | Form template with JSON schema |
| `entities/medicine.py` | Medicine catalogue item |
| `entities/patient.py` | Patient record |
| `entities/assessment.py` | Assessment with state machine |
| `entities/prescription_row.py` | Prescription line item |
| `entities/consent_record.py` | Consent record |
| `entities/audit_log.py` | Audit event |
| `entities/app_config.py` | Configuration key-value |
| `entities/followup.py` | Follow-up scheduling |
| `exceptions.py` | Domain exceptions |
| `repositories/` | Repository interfaces (ports) |
| `services/` | Domain services |
| `value_objects/` | Value object types |

### Application Layer (`backend/src/application/`)

| Directory | Use Cases |
|---|---|
| `use_cases/auth/` | Login, token validation |
| `use_cases/diseases/` | Disease CRUD + sub-diseases |
| `use_cases/templates/` | Template CRUD + versioning |
| `use_cases/medicines/` | Medicine CRUD + bulk import |
| `use_cases/patients/` | Patient registration + search |
| `use_cases/assessments/` | Assessment lifecycle (draft/submit/lock) |
| `use_cases/prescriptions/` | Prescription upsert |
| `use_cases/analytics/` | KPI aggregation, charts data |
| `use_cases/exports/` | Export data preparation |
| `use_cases/audit/` | Audit log queries |
| `use_cases/config/` | Config read/update |
| `use_cases/users/` | User management |
| `use_cases/followups/` | Follow-up CRUD + calendar |
| `interfaces/` | Abstract interface definitions |

### Infrastructure Layer (`backend/src/infrastructure/persistence/`)

| File | Purpose |
|---|---|
| `database.py` | Async SQLAlchemy session factory |
| `uid_generator.py` | Patient UID generation (PAT-XXXXXX) |
| `unit_of_work.py` | Unit of Work pattern implementation |
| `models/*.py` | 12 SQLAlchemy ORM models |
| `repositories/*_impl.py` | 11 repository implementations |
| `services/` | Infrastructure services |

### API Layer (`backend/src/api/`)

| File | Purpose |
|---|---|
| `v1/router.py` | Aggregates all v1 sub-routers under `/api/v1` |
| `v1/auth.py` | Auth endpoints |
| `v1/diseases.py` | Disease endpoints |
| `v1/templates.py` | Template endpoints |
| `v1/medicines.py` | Medicine endpoints |
| `v1/patients.py` | Patient endpoints |
| `v1/assessments.py` | Assessment endpoints |
| `v1/prescriptions.py` | Prescription endpoints |
| `v1/analytics.py` | Analytics endpoints |
| `v1/exports.py` | Export data endpoints |
| `v1/audit.py` | Audit log endpoints |
| `v1/config_router.py` | Config endpoints |
| `v1/users.py` | User management endpoints |
| `v1/followups.py` | Follow-up endpoints |
| `v1/dependencies/auth.py` | Auth dependency (`role_required`) |
| `v1/dependencies/container.py` | DI container (`get_db`) |
| `v1/schemas/` | API-level Pydantic schemas |
| `middleware/correlation_id.py` | Request correlation ID middleware |
| `middleware/exception_handler.py` | Global exception handler |

---

## Configuration & Infrastructure

| File | Purpose |
|---|---|
| `backend/src/config/settings.py` | Application settings (pydantic-settings) |
| `backend/src/config/container.py` | Dependency injection container |
| `backend/alembic.ini` | Alembic configuration |
| `backend/alembic/env.py` | Alembic async environment |
| `backend/requirements.txt` | Python dependencies |
| `backend/run.py` | Uvicorn startup script |
| `backend/seed.py` | Database seed script |
| `frontend/angular.json` | Angular CLI configuration |
| `frontend/package.json` | Node dependencies |
| `frontend/src/styles.css` | Emcure design tokens |
| `frontend/src/app/app.config.ts` | Angular app providers |
| `frontend/src/app/app.routes.ts` | Route definitions |
