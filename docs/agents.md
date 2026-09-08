# MEDRecords — Agent Roles, Responsibilities & Handoff Contracts

> This document describes the eight AI agent personas used to build the MEDRecords portal end-to-end.
> Each agent owns a distinct slice of the spec (tasks.md phases), consumes outputs from prior agents,
> and produces well-defined artifacts that downstream agents depend on.

---

## Table of Contents

1. [Backend Foundation Agent](#1-backend-foundation-agent-tasks-1-10)
2. [Frontend Foundation Agent](#2-frontend-foundation-agent-tasks-11-14)
3. [Admin Master Data Agent](#3-admin-master-data-agent-tasks-15-18)
4. [Doctor Workflow Agent](#4-doctor-workflow-agent-tasks-19-23)
5. [Dashboard & Export Agent](#5-dashboard--export-agent-tasks-23-25)
6. [Analytics & Audit Agent](#6-analytics--audit-agent-tasks-26-28)
7. [System Admin Agent](#7-system-admin-agent-tasks-29-30)
8. [Follow-up Calendar Agent](#8-follow-up-calendar-agent)

---

## 1. Backend Foundation Agent (Tasks 1–10)

### Role
Sets up the entire Python/FastAPI backend: project scaffold, ORM models, database migrations,
and every API router the frontend will consume.

### Responsibilities
- Scaffold FastAPI project with `pydantic-settings`, SQLAlchemy async engine, and CORS
- Define all 12 SQLAlchemy ORM models (`users`, `diseases`, `sub_diseases`, `form_templates`, `medicines`, `patients`, `assessments`, `prescription_rows`, `consent_records`, `audit_logs`, `app_config`, `followups`)
- Configure Alembic async migrations and seed data (sys_admin + lock config)
- Implement JWT authentication (`/api/v1/auth/*`) with `get_current_user` + `role_required` dependencies
- Implement all domain routers: diseases, templates, medicines, patients, assessments, prescriptions, analytics, exports, audit, config, users, followups
- Run APScheduler background task for assessment auto-lock
- Ensure every write endpoint emits an audit log entry
- Maintain clean architecture in `backend/src/` with domain entities, application use cases, and infrastructure persistence

### Architecture Layers (backend/src/)
| Layer | Path | Responsibility |
|---|---|---|
| API | `src/api/v1/` | FastAPI routers, schemas, request validation |
| Application | `src/application/use_cases/` | Business logic orchestration |
| Domain | `src/domain/entities/` | Core domain models, exceptions, value objects |
| Infrastructure | `src/infrastructure/persistence/` | SQLAlchemy models, repositories, DB session |

### Input Dependencies
- `docs/BRD_Med_Record.docx` — business rules
- `docs/index.css` — confirms Emcure branding (no backend impact)
- Design spec §2 (database schema), §4 (router structure)

### Output Artifacts
| File | Purpose |
|---|---|
| `backend/app/main.py` | FastAPI app, CORS, router mounts, lifespan |
| `backend/app/config.py` | `Settings` via pydantic-settings |
| `backend/app/database.py` | Async SQLAlchemy engine + `get_db` dependency |
| `backend/app/models/*.py` | 12 ORM model files + `__init__.py` |
| `backend/app/schemas/*.py` | Pydantic request/response schemas per router |
| `backend/app/routers/*.py` | 13 router files (incl. followups) |
| `backend/app/dependencies/auth.py` | `get_current_user`, `role_required` |
| `backend/app/services/lock_scheduler.py` | APScheduler lock task |
| `backend/src/main.py` | Refactored entrypoint (clean architecture) |
| `backend/src/api/v1/router.py` | Aggregated v1 sub-routers |
| `backend/src/api/v1/*.py` | 13 router modules |
| `backend/src/api/middleware/` | Correlation ID, exception handling |
| `backend/src/application/use_cases/` | Use case modules per domain |
| `backend/src/domain/entities/*.py` | 12 domain entity files |
| `backend/src/infrastructure/persistence/` | Models, repositories, DB, UID generator |
| `backend/alembic/` | Migrations + env.py |
| `backend/seed.py` | Seed script (sys_admin, app_config) |
| `backend/requirements.txt` | Pinned Python dependencies |

### API Contracts Owned

| Prefix | Router File | Roles |
|---|---|---|
| `POST /api/v1/auth/login` | `auth.py` | public |
| `GET /api/v1/auth/me` | `auth.py` | authenticated |
| `GET/POST/PATCH/DELETE /api/v1/diseases/` | `diseases.py` | admin (write), all (read) |
| `GET/POST/PUT/DELETE /api/v1/templates/` | `templates.py` | admin (write), doctor (read) |
| `GET/POST/PATCH/DELETE /api/v1/medicines/` | `medicines.py` | admin (write), doctor (read) |
| `GET/POST/PATCH/DELETE /api/v1/patients/` | `patients.py` | doctor-scoped |
| `GET/POST/PUT /api/v1/assessments/` | `assessments.py` | doctor-scoped / admin-all |
| `GET/POST /api/v1/prescriptions/assessment/{aid}` | `prescriptions.py` | doctor |
| `GET /api/v1/analytics/*` | `analytics.py` | admin, pharma_viewer |
| `GET /api/v1/exports/*` | `exports.py` | doctor, admin |
| `GET /api/v1/audit/` | `audit.py` | admin, sys_admin |
| `GET/PATCH /api/v1/config/` | `config_router.py` | sys_admin |
| `GET/POST/PATCH/DELETE /api/v1/users/` | `users.py` | sys_admin, admin |
| `GET/POST/PATCH /api/v1/followups/` | `followups.py` | doctor |

### Handoff Contract to Frontend Foundation Agent
> The backend is running at `http://localhost:8000`.
> `GET /api/docs` (Swagger UI) is accessible.
> `POST /api/v1/auth/login` returns `{ access_token, token_type, role }`.
> Seed credentials: `admin / Admin@1234` (role: `sys_admin`).
> All protected routes require `Authorization: Bearer <token>`.
> CORS allows `http://localhost:4200`.

---

## 2. Frontend Foundation Agent (Tasks 11–14)

### Role
Bootstraps the Angular 19 SPA with the Emcure design system, wires authentication, builds the shared layout shell, and defines all app routes.

### Responsibilities
- Scaffold Angular project (standalone, routing, CSS)
- Install and configure PrimeNG (Aura theme), Tailwind CSS with Emcure tokens, `xlsx`, `jspdf`, `jspdf-autotable`
- Apply Emcure design tokens from `docs/index.css` into `src/styles.css`
- Implement `AuthService` with Angular Signals (`currentUser`, `isAuthenticated`)
- `JwtInterceptor` (attaches Bearer token) + `ErrorInterceptor` (401→logout, 403→toast)
- Functional route guards: `authGuard`, `doctorGuard`, `adminGuard`, `pharmaGuard`, `sysAdminGuard`, `guestGuard`
- Shared layout components: `SidebarComponent`, `TopbarComponent`, `KpiCardComponent`, `StatusBadgeComponent`, `AppShellComponent`
- `SafeDatePipe` for null-safe date formatting
- `app.routes.ts` with all lazy-loaded, guarded routes
- `LoginComponent` with Emcure-branded form

### Input Dependencies
- Backend Foundation Agent handoff (running API, auth endpoint, CORS)
- `docs/index.css` — Emcure CSS design tokens
- `docs/Emcure_Logo.png`, `docs/Emcure_Favicon.png` — assets
- Design spec §5 (Angular routes), §6 (service layer)

### Output Artifacts
| File | Purpose |
|---|---|
| `frontend/angular.json` | Angular build config |
| `frontend/package.json` | Dependencies (PrimeNG, Tailwind, xlsx, jspdf) |
| `frontend/src/styles.css` | Emcure design tokens |
| `frontend/src/assets/logo.png` | Emcure logo |
| `frontend/src/app/app.config.ts` | `provideAnimationsAsync`, `providePrimeNG` |
| `frontend/src/app/app.routes.ts` | All application routes |
| `frontend/src/app/core/auth/auth.service.ts` | AuthService + Signals |
| `frontend/src/app/core/auth/*.guard.ts` | 6 functional guards |
| `frontend/src/app/core/auth/models/auth.models.ts` | TS interfaces for auth |
| `frontend/src/app/core/interceptors/jwt.interceptor.ts` | Bearer token attachment |
| `frontend/src/app/core/interceptors/error.interceptor.ts` | 401/403 handling |
| `frontend/src/app/shared/components/sidebar/` | Role-aware nav |
| `frontend/src/app/shared/components/topbar/` | Header bar |
| `frontend/src/app/shared/components/kpi-card/` | KPI card widget |
| `frontend/src/app/shared/components/status-badge/` | Status badge |
| `frontend/src/app/shared/components/app-shell/` | Layout shell |
| `frontend/src/app/features/auth/login.component.ts` | Login page |

### Route Table Owned
| Route | Guard(s) | Component |
|---|---|---|
| `/login` | `guestGuard` | `LoginComponent` |
| `/doctor/*` | `authGuard`, `doctorGuard` | Doctor sub-routes |
| `/admin/*` | `authGuard`, `adminGuard` | Admin sub-routes |
| `/pharma/*` | `authGuard`, `pharmaGuard` | Pharma sub-routes |
| `/sysadmin/*` | `authGuard`, `sysAdminGuard` | SysAdmin sub-routes |

### Handoff Contract to Feature Agents
> `AuthService.currentUser` signal is populated after login.
> `AuthService.hasRole(role)` returns a boolean for guard/template use.
> `AppShellComponent` (`app-shell`) wraps all authenticated feature views.
> All HTTP calls to `http://localhost:8000/api/v1` are intercepted with Bearer token.
> PrimeNG, Tailwind, and Emcure tokens are available globally.
> `SafeDatePipe`, `KpiCardComponent`, `StatusBadgeComponent` are importable from `shared`.

---

## 3. Admin Master Data Agent (Tasks 15–18)

### Role
Builds four admin-facing CRUD feature modules: Diseases, Form Templates, Medicines, and Doctor Management.

### Responsibilities
- `DiseasesComponent`: paginated table, disease create/edit dialog, soft-delete + restore, inline sub-disease management
- `DiseaseService`: wires all `/api/v1/diseases` and sub-disease sub-routes
- `TemplatesListComponent`: lists templates with disease filter, version badge, active/inactive
- `TemplateBuilderComponent`: visual JSON schema editor with add/remove sections + fields, field type selector, validation rule inputs, live preview using `DynamicFormComponent`
- `MedicinesComponent`: paginated table, CRUD dialog, bulk Excel import with row-level error reporting, download import template
- `DoctorsComponent`: paginated table, create/edit doctor, reset password dialog, soft-delete

### Input Dependencies
- Frontend Foundation Agent handoff (shared components, AuthService, interceptors, AppShellComponent)
- Backend API: `/api/v1/diseases`, `/api/v1/templates`, `/api/v1/medicines`, `/api/v1/users`
- Design spec §6 (service layer) for `DiseaseService`, `TemplateService`, `MedicineService`
- Design spec §3 (form template JSON schema format)

### Output Artifacts
| File | Purpose |
|---|---|
| `frontend/src/app/features/diseases/diseases.component.ts` | Disease CRUD UI |
| `frontend/src/app/features/diseases/disease.service.ts` | Disease API service |
| `frontend/src/app/features/templates/templates-list.component.ts` | Template list |
| `frontend/src/app/features/templates/template-builder.component.ts` | Schema builder |
| `frontend/src/app/features/medicines/medicines.component.ts` | Medicine CRUD + import |
| `frontend/src/app/features/doctors/doctors.component.ts` | Doctor management |

### API Contracts Consumed
| Endpoint | Usage |
|---|---|
| `GET/POST/PATCH/DELETE /api/v1/diseases/` | Disease CRUD |
| `POST /api/v1/diseases/{id}/restore` | Restore soft-deleted disease |
| `GET/POST/PATCH/DELETE /api/v1/diseases/{id}/sub-diseases/` | Sub-disease management |
| `GET/POST/PUT/DELETE /api/v1/templates/` | Template CRUD |
| `GET /api/v1/templates/disease/{disease_id}/active` | Active template lookup |
| `GET/POST/PATCH/DELETE /api/v1/medicines/` | Medicine CRUD |
| `POST /api/v1/medicines/import` | Bulk Excel import |
| `GET /api/v1/medicines/template` | Download import template |
| `GET/POST/PATCH/DELETE /api/v1/users/` | Doctor account management |

### Handoff Contract to Doctor Workflow Agent
> `DiseaseService` is available for disease/sub-disease dropdowns in assessment form.
> Active templates are fetchable via `GET /api/v1/templates/disease/{id}/active`.
> Medicine list is available via `GET /api/v1/medicines/` (paginated, searchable).
> `TemplateBuilderComponent` uses `DynamicFormComponent` for live preview — the shared component must be complete before preview works.

---

## 4. Doctor Workflow Agent (Tasks 19–22)

### Role
Builds the core doctor-facing features: patient registration/list, the dynamic form rendering engine, the prescription grid, and the full assessment form orchestrator.

### Responsibilities
- `PatientsListComponent`: paginated table, search by name/patient ID, "New Patient" button
- `RegisterPatientComponent`: reactive form (name, DOB, gender, contact, email), duplicate contact check
- Patient detail view: demographics + visit history table
- `PatientService`: wires all `/api/v1/patients` calls
- `DynamicFormComponent`: builds `FormGroup` from JSON schema at runtime (design spec §7)
- `DynamicSectionComponent`: renders schema sections as `p-fieldset`
- `DynamicFieldComponent`: `@switch` on `field.type` → PrimeNG control
- `PrescriptionGridComponent`: `FormArray` of prescription rows, searchable medicine dropdown, read-only mode
- `AssessmentFormComponent`: full five-step orchestrator (consent → demographics → disease+form → prescription → action bar), draft/submit/lock-window display
- `AssessmentService`: wires all `/api/v1/assessments` calls

### Input Dependencies
- Frontend Foundation Agent (AppShellComponent, AuthService, shared components)
- Admin Master Data Agent (DiseaseService for dropdowns, medicines API for prescription grid)
- Backend API: `/api/v1/patients`, `/api/v1/assessments`, `/api/v1/prescriptions`, `/api/v1/templates`
- Design spec §7 (Dynamic Form engine), §8 (Assessment State Machine)

### Output Artifacts
| File | Purpose |
|---|---|
| `frontend/src/app/features/patients/patients-list.component.ts` | Patient list |
| `frontend/src/app/features/patients/register-patient.component.ts` | Registration form |
| `frontend/src/app/features/patients/patient-detail.component.ts` | Patient detail + history |
| `frontend/src/app/features/patients/patient.service.ts` | Patient API service |
| `frontend/src/app/shared/components/dynamic-form/dynamic-form.component.ts` | Form engine |
| `frontend/src/app/shared/components/dynamic-form/dynamic-section.component.ts` | Section renderer |
| `frontend/src/app/shared/components/dynamic-form/dynamic-field.component.ts` | Field renderer |
| `frontend/src/app/shared/components/prescription-grid/prescription-grid.component.ts` | Prescription grid |
| `frontend/src/app/features/assessments/assessment-form.component.ts` | Assessment orchestrator |
| `frontend/src/app/features/assessments/assessment.service.ts` | Assessment API service |

### API Contracts Consumed
| Endpoint | Usage |
|---|---|
| `GET/POST/PATCH/DELETE /api/v1/patients/` | Patient CRUD |
| `GET /api/v1/patients/{id}` | Patient profile + visit history |
| `GET/POST/PUT /api/v1/assessments/` | Assessment CRUD |
| `POST /api/v1/assessments/{id}/submit` | Submit assessment |
| `GET/POST /api/v1/prescriptions/assessment/{aid}` | Prescription upsert |
| `GET /api/v1/templates/disease/{id}/active` | Active template for form |
| `GET /api/v1/diseases/` | Disease dropdown |
| `GET /api/v1/diseases/{id}/sub-diseases` | Sub-disease cascade |
| `GET /api/v1/medicines/` | Medicine search in prescription grid |

### Handoff Contract to Dashboard & Export Agent
> `AssessmentService.getDashboardKpis()` is wired to `GET /api/v1/assessments/dashboard/kpis`.
> `AssessmentFormComponent` exposes an "Export PDF" action that calls `ExportService`.
> `DynamicFormComponent` and `PrescriptionGridComponent` are reusable and available from `shared`.
> Patient data structure is stable (PAT-XXXXXX UID, demographics, visit history).

---

## 5. Dashboard & Export Agent (Tasks 23–25)

### Role
Builds the Doctor Dashboard KPI view and implements client-side XLSX and PDF exports.

### Responsibilities
- `DoctorDashboardComponent`: 4 KPI cards, recent assessments table (20 rows, virtual scroll >50), "New Visit" button, "Export Monthly Excel" button with month/year picker
- `ExportService.exportDoctorExcel(month, year)`: fetch from `/exports/assessments/excel`, generate `.xlsx` via `xlsx` library
- `ExportService.exportAdminExcel(filters)`: fetch admin export data, generate consolidated `.xlsx`
- `ExportService.exportAssessmentPdf(assessmentId)`: fetch from `/exports/assessments/{id}/pdf-data`, generate PDF via `jspdf` + `jspdf-autotable`
- `ExportService.exportAuditLog(filters)`: fetch from `/exports/audit/excel`, generate audit `.xlsx`
- Null-safe date handling using `SafeDatePipe` logic
- File naming conventions: `MEDRecords_[Type]_[YYYY-MM-DD].xlsx/.pdf`

### Input Dependencies
- Doctor Workflow Agent (AssessmentFormComponent, AssessmentService, DoctorDashboardComponent hook points)
- Backend API: `/api/v1/assessments/dashboard/kpis`, `/api/v1/exports/*`
- `docs/Emcure_Logo.png` — embedded in PDF header
- Design spec §6 (ExportService contract)

### Output Artifacts
| File | Purpose |
|---|---|
| `frontend/src/app/features/doctor-dashboard/doctor-dashboard.component.ts` | Doctor KPI dashboard |
| `frontend/src/app/core/services/export.service.ts` | XLSX + PDF generation |

### API Contracts Consumed
| Endpoint | Usage |
|---|---|
| `GET /api/v1/assessments/dashboard/kpis` | KPI card data |
| `GET /api/v1/exports/assessments/excel` | Doctor/admin Excel data |
| `GET /api/v1/exports/assessments/{id}/pdf-data` | PDF payload |
| `GET /api/v1/exports/audit/excel` | Audit log export |

### Handoff Contract to Analytics & Audit Agent
> `ExportService` is fully implemented and available from `core/services/export.service.ts`.
> `ExportService.exportAuditLog(filters)` is ready for the Audit Log feature to call.
> `KpiCardComponent` from shared is proven and styled — reuse for admin analytics KPIs.
> `SafeDatePipe` handles null dates safely throughout.

---

## 6. Analytics & Audit Agent (Tasks 26–28)

### Role
Builds the Admin Analytics Dashboard, the Audit Log viewer, and the Pharma-restricted analytics view.

### Responsibilities
- `AdminAnalyticsComponent`: 5 KPI cards, filter panel (date range, disease multi-select, doctor multi-select), view toggle (Graphical / Numerical), bar/donut/line charts, statistical summary table
- `AuditLogComponent`: paginated p-table with virtual scroll, filter by event type/actor/date range, "Export Audit Log" button
- `PharmaAnalyticsComponent`: read-only subset of admin analytics — no patient identifiers, same graphical/numerical toggle
- `AnalyticsService`: wires all `/api/v1/analytics/*` endpoints
- `AuditService`: wires `GET /api/v1/audit/`

### Input Dependencies
- Frontend Foundation Agent (AppShellComponent, KpiCardComponent, StatusBadgeComponent)
- Dashboard & Export Agent (ExportService for audit export)
- Backend API: `/api/v1/analytics/*`, `/api/v1/audit/`

### Output Artifacts
| File | Purpose |
|---|---|
| `frontend/src/app/features/analytics-admin/admin-analytics.component.ts` | Admin analytics dashboard |
| `frontend/src/app/features/audit-log/audit-log.component.ts` | Audit log viewer |
| `frontend/src/app/features/analytics-pharma/pharma-analytics.component.ts` | Pharma analytics view |

### API Contracts Consumed
| Endpoint | Usage |
|---|---|
| `GET /api/v1/analytics/kpis` | Admin KPI cards |
| `GET /api/v1/analytics/monthly-volume` | Bar chart — 12-month rolling |
| `GET /api/v1/analytics/by-disease` | Donut chart data |
| `GET /api/v1/analytics/trend` | Line chart with filters |
| `GET /api/v1/analytics/disease-summary` | Numerical statistics table |
| `GET /api/v1/audit/` | Audit log paginated |
| `GET /api/v1/exports/audit/excel` | Audit Excel export |

### Handoff Contract to System Admin Agent
> Analytics components and routes under `/admin/analytics` and `/pharma/analytics` are complete.
> Audit log at `/admin/audit` is complete with export capability.

---

## 7. System Admin Agent (Tasks 29–30)

### Role
Implements the system administration features (user management and platform config) and creates project-level documentation files.

### Responsibilities
- `UserManagementComponent`: full CRUD for all users across all roles, paginated table, create/edit/soft-delete dialogs, password reset
- `SystemConfigComponent`: list of config key-value pairs (`lock_window_hours`, etc.), inline edit per key, save via PATCH
- Both components guarded by `sysAdminGuard`
- `ConfigService`: `configs` signal, `loadConfigs()`, `updateConfig()`, `getLockWindowHours()`
- `docs/agents.md` (this file): agent roles, responsibilities, handoff contracts
- `docs/context_map.md`: comprehensive mapping of every spec section → implementation file → API endpoint → DB model

### Input Dependencies
- All prior agents (complete project for documentation)
- Backend API: `/api/v1/users`, `/api/v1/config`
- Design spec §6 (ConfigService contract)

### Output Artifacts
| File | Purpose |
|---|---|
| `frontend/src/app/features/system-config/user-management.component.ts` | User CRUD UI |
| `frontend/src/app/features/system-config/system-config.component.ts` | Platform config UI |
| `frontend/src/app/core/services/config.service.ts` | Config signal + API service |
| `docs/agents.md` | This file |
| `docs/context_map.md` | Spec-to-implementation mapping |

### API Contracts Consumed
| Endpoint | Usage |
|---|---|
| `GET/POST/PATCH/DELETE /api/v1/users/` | User management CRUD |
| `POST /api/v1/users/{id}/reset-password` | Password reset |
| `GET /api/v1/config/` | Load all config entries |
| `PATCH /api/v1/config/{key}` | Update a config value |

---

## 8. Follow-up Calendar Agent

### Role
Builds the follow-up scheduling and calendar view feature for doctors, including backend API and frontend calendar UI.

### Responsibilities
- Backend: `followups` router with CRUD, dashboard, and calendar-range query endpoints
- Frontend: `FollowupCalendarComponent` with month/week/day views, scheduling dialog, event rendering, and status transitions
- `FollowupService`: wires all `/api/v1/followups` calls
- `FollowupDialogComponent`: shared dialog for scheduling follow-ups from assessment or patient views
- State machine: `pending` → `completed` | `cancelled` (no reverse transitions)
- Validation: scheduled_date must be 1–365 days in the future; date range queries capped at 42 days

### Input Dependencies
- Doctor Workflow Agent (patient and assessment data structures)
- Frontend Foundation Agent (AppShellComponent, AuthService)
- Backend Foundation Agent (DB models, auth dependencies)

### Output Artifacts
| File | Purpose |
|---|---|
| `backend/app/routers/followups.py` | Follow-ups router (legacy path) |
| `backend/src/api/v1/followups.py` | Follow-ups router (clean architecture) |
| `backend/src/domain/entities/followup.py` | Followup domain entity |
| `backend/src/infrastructure/persistence/models/followup_model.py` | SQLAlchemy model |
| `backend/src/infrastructure/persistence/repositories/followup_repository_impl.py` | Repository |
| `backend/src/application/use_cases/followups/` | Followup use cases |
| `backend/alembic/versions/0003_followups_table.py` | DB migration |
| `frontend/src/app/features/followup-calendar/followup-calendar.component.ts` | Calendar orchestrator |
| `frontend/src/app/features/followup-calendar/calendar-month-view.component.ts` | Month grid |
| `frontend/src/app/features/followup-calendar/calendar-week-view.component.ts` | Week grid |
| `frontend/src/app/features/followup-calendar/calendar-day-view.component.ts` | Day grid |
| `frontend/src/app/features/followup-calendar/calendar-header.component.ts` | Navigation header |
| `frontend/src/app/features/followup-calendar/calendar-event.component.ts` | Event chip |
| `frontend/src/app/features/followup-calendar/event-action-panel.component.ts` | Status action panel |
| `frontend/src/app/features/followup-calendar/schedule-dialog.component.ts` | Schedule new dialog |
| `frontend/src/app/features/followup-calendar/calendar-date.utils.ts` | Date utilities |
| `frontend/src/app/shared/components/followup-dialog/followup-dialog.component.ts` | Shared scheduling dialog |
| `frontend/src/app/core/services/followup.service.ts` | Followup API service |

### API Contracts Consumed
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/followups/` | POST | doctor | Create follow-up |
| `/api/v1/followups/` | GET | doctor | Paginated list (doctor-scoped) |
| `/api/v1/followups/dashboard` | GET | doctor | Pending count + today's follow-ups |
| `/api/v1/followups/calendar` | GET | doctor | Date-range query (max 42 days) |
| `/api/v1/followups/{id}` | GET | doctor | Get single follow-up |
| `/api/v1/followups/{id}` | PATCH | doctor | Update status/date/notes |

### Handoff Contract
> Follow-up calendar is accessible at `/doctor/followups`.
> `FollowupDialogComponent` can be imported from `shared/components/followup-dialog/` for use in assessment or patient views.
> `FollowupService` is available at `core/services/followup.service.ts`.

---

## Inter-Agent Dependency Graph

```
Backend Foundation Agent (1–10)
        │
        ▼
Frontend Foundation Agent (11–14)
        │
        ├──► Admin Master Data Agent (15–18)
        │           │
        │           ▼
        └──► Doctor Workflow Agent (19–22)
                    │
                    ├──► Follow-up Calendar Agent
                    │
                    ▼
             Dashboard & Export Agent (23–25)
                    │
                    ▼
             Analytics & Audit Agent (26–28)
                    │
                    ▼
             System Admin Agent (29–30)
```

---

## JWT Role Reference

| Role Value | Allowed Feature Areas |
|---|---|
| `doctor` | `/doctor/*` — patients, assessments, dashboard, follow-ups, exports |
| `admin` | `/admin/*` — diseases, templates, medicines, doctors, analytics, audit |
| `pharma_viewer` | `/pharma/*` — aggregated analytics (no patient identifiers) |
| `sys_admin` | `/sysadmin/*` — user management, system config |

---

## Technology Stack Summary

| Layer | Technology |
|---|---|
| Frontend framework | Angular 19 (standalone components, Signals) |
| UI component library | PrimeNG (Aura theme) |
| CSS framework | Tailwind CSS + Emcure design tokens |
| HTTP | Angular `HttpClient` with functional interceptors |
| Charts | PrimeNG Charts (Chart.js) |
| XLSX generation | `xlsx` (SheetJS) |
| PDF generation | `jspdf` + `jspdf-autotable` |
| Backend framework | FastAPI (Python 3.11+) |
| ORM | SQLAlchemy (async) |
| Database | PostgreSQL (local, `medrecords` DB) |
| Migrations | Alembic (async) |
| Auth | Stateless JWT (HMAC-SHA256, `python-jose`) |
| Scheduling | APScheduler (assessment auto-lock) |
| Config | `pydantic-settings` |
| Architecture | Clean Architecture (domain/application/infrastructure layers) |
