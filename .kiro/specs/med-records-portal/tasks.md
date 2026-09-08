# Tasks

## Phase 1 — Backend Foundation

- [x] 1. Scaffold FastAPI backend project structure
  - Create `backend/` directory with `app/main.py`, `app/config.py`, `app/database.py`, `requirements.txt`
  - Configure pydantic-settings for DB connection (host=localhost, port=5432, db=medrecords, user=postgres, password=root)
  - Set up SQLAlchemy async engine with asyncpg driver
  - Add CORS middleware allowing Angular dev origin (http://localhost:4200)
  - Add uvicorn startup script
  - **File:** `backend/app/main.py`, `backend/app/config.py`, `backend/app/database.py`, `backend/requirements.txt`

- [x] 2. Create all SQLAlchemy ORM models
  - Implement models for: `users`, `diseases`, `sub_diseases`, `form_templates`, `medicines`, `patients`, `assessments`, `prescription_rows`, `consent_records`, `audit_logs`, `app_config`
  - All models follow design spec: BIGSERIAL PKs, `is_active`, `TIMESTAMPTZ`, FK constraints, indexes
  - **File:** `backend/app/models/` (one file per model + `__init__.py`)
  - **Depends on:** Task 1

- [x] 3. Create Alembic migrations and seed data
  - Initialize Alembic with async support
  - Generate initial migration from ORM models
  - Add seed script: default sys_admin user (username: admin, password: Admin@1234), `app_config` lock_window_hours=24
  - **File:** `backend/alembic/`, `backend/seed.py`
  - **Depends on:** Task 2

- [x] 4. Implement authentication router and JWT utilities
  - `POST /api/v1/auth/login` — validate credentials, return JWT with role + expiry (HMAC-SHA256)
  - `GET /api/v1/auth/me` — return current user profile
  - `POST /api/v1/auth/logout` — write audit log entry (client discards token)
  - `get_current_user` dependency, `role_required(role)` dependency
  - Audit log entry on every login attempt (success/failure)
  - **File:** `backend/app/routers/auth.py`, `backend/app/dependencies/auth.py`
  - **Depends on:** Task 3

- [x] 5. Implement Disease & Sub-Disease router
  - Full CRUD: paginated list, create, get, update, soft-delete, restore
  - Sub-disease sub-routes: list, create, update, soft-delete
  - Validate unique disease name; cascade soft-delete to sub-diseases
  - Guard: admin only for write; all roles for read (active only)
  - Audit log on create/update/delete
  - **File:** `backend/app/routers/diseases.py`, `backend/app/schemas/disease.py`
  - **Depends on:** Task 4

- [x] 6. Implement Form Template router
  - `GET /api/v1/templates/` — paginated list with disease filter
  - `POST /api/v1/templates/` — create template (validates JSON schema structure)
  - `GET /api/v1/templates/{id}` — get template + schema
  - `PUT /api/v1/templates/{id}` — replace active template (deactivates previous version, increments version)
  - `DELETE /api/v1/templates/{id}` — soft-delete
  - `GET /api/v1/templates/disease/{disease_id}/active` — get active template for a disease
  - Validate schema: every field must have unique field_key, label, type, required flag
  - **File:** `backend/app/routers/templates.py`, `backend/app/schemas/template.py`
  - **Depends on:** Task 5

- [x] 7. Implement Medicine router with bulk import
  - Full CRUD with paginated search
  - `POST /api/v1/medicines/import` — parse uploaded .xlsx, validate rows, upsert; reject entire batch on any validation error
  - `GET /api/v1/medicines/template` — return downloadable import template .xlsx
  - **File:** `backend/app/routers/medicines.py`, `backend/app/schemas/medicine.py`
  - **Depends on:** Task 4

- [x] 8. Implement Patients router
  - `POST /api/v1/patients/` — register patient, generate PAT-XXXXXX UID, check duplicate contact number
  - `GET /api/v1/patients/` — paginated + search, doctor-scoped
  - `GET /api/v1/patients/{id}` — profile + visit history summary
  - `PATCH /api/v1/patients/{id}` — update
  - `DELETE /api/v1/patients/{id}` — soft-delete
  - **File:** `backend/app/routers/patients.py`, `backend/app/schemas/patient.py`
  - **Depends on:** Task 4

- [x] 9. Implement Assessments router and lock scheduler
  - `POST /api/v1/assessments/` — create draft (links patient, doctor, disease, template_id, template_snapshot)
  - `GET /api/v1/assessments/` — paginated list, doctor-scoped or admin-all
  - `GET /api/v1/assessments/{id}` — full record including form_data and prescription rows
  - `PUT /api/v1/assessments/{id}` — update draft / re-submit within lock window
  - `POST /api/v1/assessments/{id}/submit` — draft → submitted, set `submitted_at`, compute `lock_expires_at`
  - `GET /api/v1/assessments/dashboard/kpis` — doctor KPI aggregates
  - APScheduler background task: scan submitted records where `lock_expires_at <= now()`, transition to locked
  - Audit log on every state transition
  - **File:** `backend/app/routers/assessments.py`, `backend/app/services/lock_scheduler.py`, `backend/app/schemas/assessment.py`
  - **Depends on:** Task 8

- [x] 10. Implement Prescription, Consent, Analytics, Export, Audit, and Config routers
  - `POST /api/v1/prescriptions/assessment/{aid}` — upsert full grid (replace existing rows)
  - `GET /api/v1/prescriptions/assessment/{aid}` — list rows
  - Analytics: `/kpis`, `/monthly-volume`, `/by-disease`, `/trend`, `/disease-summary` (all with filter params)
  - Export data endpoints: `/exports/assessments/excel`, `/exports/assessments/{id}/pdf-data`, `/exports/audit/excel`
  - `GET /api/v1/audit/` — paginated with filters
  - `GET /api/v1/config/`, `PATCH /api/v1/config/{key}` (sys_admin only)
  - Users CRUD router (sys_admin manages all roles)
  - **File:** `backend/app/routers/` (prescriptions, analytics, exports, audit, config, users)
  - **Depends on:** Task 9

---

## Phase 2 — Angular Frontend Foundation

- [x] 11. Scaffold Angular project with PrimeNG, Tailwind, and Emcure design system
  - `ng new frontend --standalone --routing --style=css`
  - Install: `primeng`, `@primeuix/themes`, `primeicons`, `tailwindcss`, `@tailwindcss/vite`, `xlsx`, `jspdf`, `jspdf-autotable`
  - Copy `docs/index.css` content into `src/styles.css` (Emcure design tokens)
  - Configure `app.config.ts`: `provideAnimationsAsync()`, `providePrimeNG({ theme: Aura, ripple: true })`
  - Configure Tailwind with Poppins font and Emcure primary color tokens
  - Copy Emcure logo to `src/assets/logo.png`, favicon to `src/favicon.ico`
  - **File:** `frontend/` scaffold
  - **Depends on:** Task 1

- [x] 12. Implement core auth service, interceptors, and route guards
  - `AuthService` with Angular Signals: `currentUser`, `isAuthenticated`, `login()`, `logout()`, `hasRole()`
  - `JwtInterceptor`: attach `Authorization: Bearer <token>` to all API requests
  - `ErrorInterceptor`: catch 401 → `logout()`, 403 → toast notification
  - Functional guards: `authGuard`, `doctorGuard`, `adminGuard`, `pharmaGuard`, `sysAdminGuard`, `guestGuard`
  - Token stored in `localStorage` key `med_token`
  - **File:** `frontend/src/app/core/auth/`, `frontend/src/app/core/interceptors/`
  - **Depends on:** Task 11

- [x] 13. Build shared layout components: Sidebar, Topbar, KPI card, Status badge
  - `SidebarComponent`: role-based nav links using `@if(auth.hasRole(...))`, collapsible via Angular Signal, Emcure primary red active state
  - `TopbarComponent`: Emcure logo, doctor name, notification bell, logout button
  - `KpiCardComponent`: icon slot, value, label, hover animation (kpi-card CSS class from design system)
  - `StatusBadgeComponent`: maps `draft|submitted|locked` to badge CSS classes
  - `ConfirmDialogComponent`: wraps PrimeNG `p-confirmdialog`
  - `SafeDatePipe`: null-safe date formatting
  - `AppShellComponent`: layout wrapper combining sidebar + topbar + router outlet
  - **File:** `frontend/src/app/shared/`
  - **Depends on:** Task 12

- [x] 14. Implement app routing and login feature
  - `app.routes.ts` with all routes per design spec (lazy-loaded, guarded)
  - `LoginComponent`: Emcure-branded login form with logo, username/password fields, error display
  - On success: store token, call `loadProfile()`, navigate to role dashboard
  - **File:** `frontend/src/app/app.routes.ts`, `frontend/src/app/features/auth/login.component.ts`
  - **Depends on:** Task 13

---

## Phase 3 — Admin Master Data Features

- [x] 15. Disease & Sub-Disease management feature (Admin)
  - `DiseasesComponent`: paginated p-table with search, add/edit dialog (p-dialog), soft-delete with confirmation, restore action, status badge
  - Inline sub-disease management: expand row or side panel showing sub-diseases list with add/edit/soft-delete
  - `DiseaseService` wiring all API calls
  - **File:** `frontend/src/app/features/diseases/`
  - **Depends on:** Task 14

- [x] 16. Form Template Builder feature (Admin)
  - `TemplatesListComponent`: list templates with disease filter, version badge, active/inactive status
  - `TemplateBuilderComponent`: visual JSON schema builder
    - Add/remove sections (named, ordered)
    - Per section: add/remove/reorder fields
    - Per field: field_key (auto-slug from label), label, type selector, required toggle, options (for select/radio/checkbox), validation rules (min/max/minLength/maxLength/pattern)
    - Live preview panel rendering the form using `DynamicFormComponent` in read-only mode
    - Save: serializes to JSON schema, sends to API; warns if replacing active template
  - **File:** `frontend/src/app/features/templates/`
  - **Depends on:** Task 15

- [x] 17. Medicine Master feature (Admin)
  - `MedicinesComponent`: paginated p-table, add/edit dialog, soft-delete, restore
  - Bulk import: file upload (p-fileupload), row-level error report display on validation failure
  - Download import template button
  - **File:** `frontend/src/app/features/medicines/`
  - **Depends on:** Task 14

- [x] 18. Doctor account management feature (Admin)
  - `DoctorsComponent`: paginated p-table with name, username, specialty, status
  - Create doctor dialog: name, username, email, specialty, initial password
  - Edit doctor: update fields (not password)
  - Reset password dialog: new password with complexity validation
  - Soft-delete with confirmation
  - **File:** `frontend/src/app/features/doctors/`
  - **Depends on:** Task 14

---

## Phase 4 — Doctor Workflow

- [x] 19. Patient registration and list feature (Doctor)
  - `PatientsListComponent`: paginated p-table, search by name/patient ID, "New Patient" button
  - `RegisterPatientComponent`: reactive form — first/last name, DOB, gender, contact, email; duplicate contact check on blur
  - Patient detail view: demographics + visit history table (visit date, disease, status badge, PDF link)
  - **File:** `frontend/src/app/features/patients/`
  - **Depends on:** Task 14

- [x] 20. Dynamic Form rendering engine
  - `DynamicFormComponent`: builds `FormGroup` from JSON schema at runtime (see design spec section 7)
  - `DynamicSectionComponent`: renders a named section as a PrimeNG `p-fieldset`
  - `DynamicFieldComponent`: `@switch` on `field.type` → correct PrimeNG control (text, number, date, select, multiselect, radio, checkbox_group, textarea)
  - Validation: builds Angular validators from schema rules (required, min, max, minLength, maxLength, pattern, minDate)
  - `isReadonly` input: disables entire form when assessment is Locked
  - **File:** `frontend/src/app/shared/components/dynamic-form/`
  - **Depends on:** Task 13

- [x] 21. Prescription Grid component
  - `PrescriptionGridComponent`: reactive `FormArray` of rows
  - Each row: Medicine (searchable p-select calling medicines API), Dosage, Frequency, Duration, Instructions
  - Add row button, remove row button per row
  - Read-only mode: hides add/remove, renders plain text
  - At least one medicine validation before assessment submit
  - **File:** `frontend/src/app/shared/components/prescription-grid/`
  - **Depends on:** Task 20

- [x] 22. Assessment Form (new / edit / view)
  - `AssessmentFormComponent`: full visit form orchestrator
    - Step 1: Consent section (`ConsentSectionComponent`) — consent statement, checkbox, records consent on check
    - Step 2: Patient demographics (pre-populated from selected patient, editable)
    - Step 3: Disease + Sub-Disease selector → triggers template fetch → renders `DynamicFormComponent`
    - Step 4: `PrescriptionGridComponent`
    - Step 5: Action bar — Save Draft, Submit Assessment, Export PDF
  - Disease selector: p-select from DiseaseService; sub-disease: cascades from selection
  - If no active template found: show info message, disable form submission
  - Lock Window countdown display for Submitted records
  - Locked records: all inputs disabled, status badge, no save/submit buttons
  - Navigate from `/doctor/assessments/new?patientId=X` or `/doctor/assessments/:id`
  - **File:** `frontend/src/app/features/assessments/`
  - **Depends on:** Task 21

- [x] 23. Doctor Dashboard
  - `DoctorDashboardComponent`: 4 KPI cards (Total Patients, This Month Assessments, Drafts, Locked)
  - Recent assessments table: 20 rows, virtual scroll beyond 50, columns per spec
  - "New Visit" shortcut button
  - "Export Monthly Excel" button (month/year picker dialog)
  - All KPI data from `/assessments/dashboard/kpis`
  - **File:** `frontend/src/app/features/doctor-dashboard/`
  - **Depends on:** Task 22

---

## Phase 5 — Export Features

- [x] 24. Client-side Excel export (Doctor monthly & Admin consolidated)
  - `ExportService.exportDoctorExcel(month, year)`: fetch data from `/exports/assessments/excel?month=&year=`, generate .xlsx with XLSX library, dynamic column headers including all form field values
  - `ExportService.exportAdminExcel(filters)`: fetch admin export data, generate consolidated .xlsx
  - File naming: `MEDRecords_[ExportType]_[YYYY-MM-DD].xlsx`
  - Log export event via audit endpoint
  - **File:** `frontend/src/app/core/services/export.service.ts`
  - **Depends on:** Task 23

- [x] 25. Client-side PDF export (Individual assessment)
  - `ExportService.exportAssessmentPdf(assessmentId)`: fetch data from `/exports/assessments/{id}/pdf-data`
  - Generate PDF using `jspdf` + `jspdf-autotable`: header with Emcure logo + portal name, patient demographics section, assessment form fields (label + value per field), prescription grid table, footer with generated timestamp and disclaimer
  - Null-safe date formatting using `SafeDatePipe` logic
  - File naming: `MEDRecords_Patient_[PatientID]_Visit_[YYYY-MM-DD].pdf`
  - **File:** `frontend/src/app/core/services/export.service.ts` (extend)
  - **Depends on:** Task 24

---

## Phase 6 — Admin Analytics & Audit

- [x] 26. Admin Analytics Dashboard
  - `AdminAnalyticsDashboardComponent`: 5 KPI cards + filter panel + view toggle (Graphical / Numerical)
  - Graphical View: bar chart (monthly volume, PrimeNG chart / Chart.js), donut chart (by disease), line chart (trend)
  - Numerical View: statistical summary table — disease name, total count, this month count, locked vs submitted
  - Filter controls: date range (p-datepicker range), disease multi-select, doctor multi-select
  - All data reloaded on filter change without full page reload
  - **File:** `frontend/src/app/features/analytics-admin/`
  - **Depends on:** Task 14

- [x] 27. Audit Log feature
  - `AuditLogComponent`: paginated p-table with virtual scroll, filter by event type/actor/date range
  - Export audit log as Excel button
  - Read-only; no edit/delete controls
  - **File:** `frontend/src/app/features/audit-log/`
  - **Depends on:** Task 14

---

## Phase 7 — Pharma Viewer & System Admin

- [x] 28. Pharma Analytics view
  - `PharmaAnalyticsComponent`: read-only analytics dashboard (subset of admin analytics)
  - No patient identifiers shown; aggregated data only
  - Same graphical/numerical toggle, same charts, same filters
  - **File:** `frontend/src/app/features/analytics-pharma/`
  - **Depends on:** Task 26

- [x] 29. System Admin: User Management & Platform Config
  - `UserManagementComponent`: CRUD for all users across roles, paginated table, create/edit/soft-delete, password reset
  - `SystemConfigComponent`: list of config key-value pairs (lock_window_hours, etc.), inline edit, save
  - Both guarded by `sysAdminGuard`
  - **File:** `frontend/src/app/features/system-config/`
  - **Depends on:** Task 14

---

## Phase 8 — Supporting Files

- [x] 30. Create agents.md and context_map.md
  - Write `agents.md` with agent roles, responsibilities, and handoff contracts for this project
  - Write `context_map.md` mapping every spec section to implementation files, API endpoints, and Angular routes
  - **File:** `docs/agents.md`, `docs/context_map.md`
  - **Depends on:** Task 1
