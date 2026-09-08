# Implementation Plan: Doctor Follow-Up Scheduling

## Overview

This plan implements the follow-up scheduling feature end-to-end: backend data layer (model, migration, schemas), backend API (router + registration), frontend service, shared dialog component, and frontend integration into the assessment form, patient detail page, and doctor dashboard.

## Tasks

- [x] 1. Backend data layer — model, migration, and schemas
  - [x] 1.1 Create the Followup SQLAlchemy model and register it
    - Create `backend/app/models/followup.py` with the `Followup` class as specified in the design (columns: id, patient_id, doctor_id, assessment_id, scheduled_date, notes, status, created_at, updated_at; relationships to Patient, User, Assessment; check constraint on status; indexes)
    - Add `from app.models.followup import Followup` to `backend/app/models/__init__.py` and include `"Followup"` in `__all__`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 Create the Alembic migration for the followups table
    - Create `backend/alembic/versions/0003_followups_table.py` with revision `0003`, down_revision `0002`
    - `upgrade()`: create `followups` table with all columns, foreign keys (ON DELETE RESTRICT), check constraint on status, and all five indexes (patient_id, doctor_id, status, scheduled_date, composite doctor_id+status+scheduled_date)
    - `downgrade()`: drop the `followups` table (indexes drop automatically with the table)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 1.3 Create Pydantic schemas for follow-up CRUD
    - Create `backend/app/schemas/followup.py` with `FollowupCreate`, `FollowupUpdate`, `FollowupResponse`, and `FollowupDashboard` schemas as specified in the design
    - `FollowupCreate`: validate scheduled_date is 1–365 days in the future, notes max 500 chars
    - `FollowupUpdate`: validate status enum, optional date validation
    - `FollowupResponse`: include denormalized fields (patient_name, patient_uid, disease_name), `from_attributes = True`
    - `FollowupDashboard`: pending_count (int) + today_followups (list of FollowupResponse)
    - _Requirements: 3.1, 3.5, 6.1, 6.8_

- [x] 2. Backend API — followups router and registration
  - [x] 2.1 Implement the followups router
    - Create `backend/app/routers/followups.py` with `APIRouter(tags=["Follow-ups"])`
    - Implement `POST /` — create follow-up (doctor role only), set doctor_id from current_user, validate patient exists, validate assessment exists if provided, return 201
    - Implement `GET /` — paginated list scoped to current doctor, filterable by status and patient_id, return items + total + page + page_size + total_pages
    - Implement `GET /dashboard` — return pending_count and today_followups for current doctor (MUST be defined before `GET /{id}` to avoid route conflict)
    - Implement `GET /{id}` — single follow-up scoped to current doctor, return 404 if not found, 403 if belongs to another doctor
    - Implement `PATCH /{id}` — update follow-up with state machine enforcement (VALID_TRANSITIONS dict), return 422 on invalid transition, 403 if not owner
    - Populate denormalized fields (patient_name, patient_uid, disease_name) on all response objects by joining patient and assessment→disease
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2, 7.3, 7.4_

  - [x] 2.2 Register the followups router in main.py
    - Add `from app.routers import followups` import in `backend/app/main.py`
    - Add `app.include_router(followups.router, prefix=settings.api_prefix + "/followups")` after the existing router registrations
    - _Requirements: 6.1_

  - [ ]* 2.3 Write property tests for follow-up backend logic
    - **Property 1: Follow-up creation round-trip** — Generate valid payloads, POST then GET, assert field equality
    - **Property 2: Valid date acceptance** — Generate dates in [tomorrow, today+365], assert 201
    - **Property 3: Invalid date rejection** — Generate dates outside valid range, assert 422
    - **Property 4: Status enum constraint** — Generate non-valid status strings, assert 422
    - **Property 5: State machine transitions** — Generate all (current_status, target_status) pairs, assert only valid transitions succeed
    - **Property 6: Doctor isolation** — Generate follow-ups for two doctors, cross-access returns 403
    - **Property 7: Pagination correctness** — Generate N records, query with random page/page_size, assert pagination math
    - **Property 8: Follow-up sorting invariant** — Generate mixed statuses/dates, assert sort order
    - **Validates: Requirements 3.1, 1.3, 1.5, 2.3, 2.5, 3.5, 6.2, 6.5, 6.7, 6.8, 7.1, 7.2, 7.4, 4.3**

- [x] 3. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend service
  - [x] 4.1 Create the FollowupService
    - Create `frontend/src/app/core/services/followup.service.ts`
    - Injectable with `providedIn: 'root'`, inject `HttpClient`
    - Implement methods: `create(payload)`, `list(params)`, `getById(id)`, `update(id, payload)`, `getDashboard()`
    - Define interfaces: `Followup`, `FollowupCreatePayload`, `FollowupUpdatePayload`, `FollowupListParams`, `FollowupDashboard`, `PaginatedResponse<T>` (reuse if already exists)
    - Base URL: `http://localhost:8000/api/v1/followups`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. Frontend shared dialog component
  - [x] 5.1 Create the FollowupDialogComponent
    - Create `frontend/src/app/shared/components/followup-dialog/followup-dialog.component.ts` (standalone component)
    - Create `frontend/src/app/shared/components/followup-dialog/followup-dialog.component.html`
    - Imports: CommonModule, FormsModule, PrimeNG DialogModule, CalendarModule, InputTextareaModule, ButtonModule
    - Inputs: `visible` (boolean), `patientId` (number), `assessmentId` (optional number)
    - Outputs: `visibleChange` (EventEmitter<boolean>), `created` (EventEmitter<Followup>)
    - Date picker with minDate = tomorrow, maxDate = today + 365 days
    - Notes textarea with maxlength 500
    - Validation: show inline error if date missing or out of range
    - On submit: call `FollowupService.create()`, emit `created` on success, show toast, close dialog
    - On error: keep dialog open, show error toast
    - On close: reset form state
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.2, 2.3, 2.5, 2.6_

- [x] 6. Frontend integration — Assessment form
  - [x] 6.1 Add follow-up scheduling to AssessmentFormComponent
    - In the assessment form component, add a "Schedule Follow-up" button visible when `status === 'submitted' || status === 'locked'`
    - Include `<app-followup-dialog>` with `[patientId]` bound to the assessment's patient_id and `[assessmentId]` bound to the assessment id
    - Handle `(created)` event to show success feedback
    - Import `FollowupDialogComponent` in the component's imports array
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7_

- [x] 7. Frontend integration — Patient detail page
  - [x] 7.1 Add follow-up scheduling button and dialog to PatientDetailComponent
    - Add "Schedule Follow-up" button in the page header actions area
    - Include `<app-followup-dialog>` with `[patientId]` binding
    - Handle `(created)` event to refresh the follow-ups list
    - Import `FollowupDialogComponent` in the component's imports array
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 7.2 Add follow-ups list section to PatientDetailComponent
    - Add a "Follow-ups" section below the visit history table
    - Display columns: scheduled_date (formatted dd MMM yyyy), notes (truncated to 100 chars with ellipsis), status (badge with color coding)
    - Sort: pending first (by scheduled_date ascending), then completed/cancelled (by scheduled_date descending)
    - Show empty-state message when no follow-ups exist
    - For pending follow-ups: show "Complete" and "Cancel" action buttons
    - On action click: show PrimeNG confirmation dialog, then call `FollowupService.update()` with new status
    - On success: refresh list, show toast
    - On error: show error toast, retain previous state
    - Call `FollowupService.list({ patient_id: patientId })` on component init and after mutations
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 8. Frontend integration — Doctor dashboard
  - [x] 8.1 Integrate real follow-up data into DoctorDashboardComponent
    - Call `FollowupService.getDashboard()` on component init
    - Replace the proxy/hardcoded "Pending Follow-ups" KPI value with `dashboard.pending_count`
    - Display "0" when no pending follow-ups exist
    - Add "Today's Follow-ups" section below KPI cards showing: patient name, patient UID, disease name, scheduled date
    - Show empty-state message when no follow-ups are scheduled for today
    - Visually differentiate overdue follow-ups (scheduled_date < today) with a distinct background/border color
    - Import `FollowupService` in the component
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Final checkpoint — Full feature complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The backend must be completed and verified before frontend integration tasks
- The shared dialog component (task 5) must be built before integration tasks (6, 7) that depend on it
- Frontend service (task 4) must exist before the dialog or integration tasks can call it

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["6.1", "7.1", "8.1"] },
    { "id": 7, "tasks": ["7.2"] }
  ]
}
```
