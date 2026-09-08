# Requirements Document

## Introduction

The Doctor Follow-up Scheduling feature enables doctors in the MEDRecords portal to schedule follow-up visits for patients. Follow-ups can be created from the assessment form (after completing a visit) or from the patient detail page. Each follow-up captures a scheduled date and optional notes. Follow-ups are surfaced on the doctor dashboard and patient detail page, with status tracking (pending, completed, cancelled) to support the doctor's workflow.

## Glossary

- **Follow_Up**: A scheduled future visit record linking a doctor, patient, and optionally an assessment, with a date, notes, and status.
- **Follow_Up_Service**: The backend API service responsible for creating, reading, updating, and listing follow-up records.
- **Follow_Up_Scheduler**: The frontend UI component (dialog/form) that allows a doctor to create or edit a follow-up.
- **Doctor_Dashboard**: The main landing page for doctors showing KPI cards and recent assessments.
- **Patient_Detail_Page**: The page displaying a single patient's demographics and visit history.
- **Assessment_Form**: The multi-step form used by doctors to create or edit patient assessments.
- **Follow_Up_Status**: An enumeration of follow-up states: pending, completed, cancelled.

## Requirements

### Requirement 1: Create Follow-Up from Assessment Form

**User Story:** As a doctor, I want to schedule a follow-up directly after completing an assessment, so that I can plan the patient's next visit while the clinical context is fresh.

#### Acceptance Criteria

1. WHEN an assessment is in submitted or locked status, THE Assessment_Form SHALL display a "Schedule Follow-up" button in the action bar.
2. WHEN the doctor clicks the "Schedule Follow-up" button, THE Follow_Up_Scheduler SHALL open a dialog with a date picker (required) and a notes text field (optional, maximum 500 characters).
3. WHEN the doctor submits the follow-up dialog with a valid date that is at least 1 calendar day after today and no more than 365 calendar days from today, THE Follow_Up_Service SHALL create a Follow_Up record linked to the current patient, doctor, and assessment.
4. IF the doctor submits the follow-up dialog without a date, THEN THE Follow_Up_Scheduler SHALL display a validation error indicating the date is required.
5. IF the doctor submits a date that is today or in the past, THEN THE Follow_Up_Scheduler SHALL display a validation error indicating the date must be at least 1 day in the future.
6. WHEN a Follow_Up is successfully created, THE Follow_Up_Scheduler SHALL close the dialog and display a success notification for 5 seconds.
7. IF the Follow_Up_Service fails to create the record due to a server or network error, THEN THE Follow_Up_Scheduler SHALL keep the dialog open with the entered data preserved and display an error notification indicating the follow-up could not be saved.

### Requirement 2: Create Follow-Up from Patient Detail Page

**User Story:** As a doctor, I want to schedule a follow-up from the patient detail page, so that I can plan visits for patients without needing to open a specific assessment.

#### Acceptance Criteria

1. THE Patient_Detail_Page SHALL display a "Schedule Follow-up" button in the page header actions.
2. WHEN the doctor clicks the "Schedule Follow-up" button, THE Follow_Up_Scheduler SHALL open a dialog with a date picker (required) and a notes text field (optional, maximum 500 characters).
3. WHEN the doctor submits the follow-up dialog with a date that is at least one calendar day after today and no more than 365 days from today, THE Follow_Up_Service SHALL create a Follow_Up record linked to the current patient and doctor, without an assessment reference.
4. WHEN a Follow_Up is successfully created from the Patient_Detail_Page, THE Patient_Detail_Page SHALL refresh the follow-ups list to include the new record.
5. IF the doctor submits the follow-up dialog with a date that is today or in the past, or more than 365 days from today, or with the date field empty, THEN THE Follow_Up_Scheduler SHALL display a validation error message indicating the date constraint and keep the dialog open with the entered data preserved.
6. IF the Follow_Up_Service fails to create the record due to a server or network error, THEN THE Patient_Detail_Page SHALL display an error message indicating the follow-up could not be saved and keep the dialog open with the entered data preserved.

### Requirement 3: Follow-Up Data Model

**User Story:** As a system administrator, I want follow-up data stored with proper relationships and constraints, so that data integrity is maintained.

#### Acceptance Criteria

1. THE Follow_Up_Service SHALL store each Follow_Up with the following fields: id (auto-incrementing integer, primary key), patient_id (required integer), doctor_id (required integer), assessment_id (optional integer), scheduled_date (required, date without time), notes (optional, max 500 characters), status (required, default "pending"), created_at (auto-generated timezone-aware timestamp on creation), and updated_at (auto-generated timezone-aware timestamp, updated on every modification).
2. THE Follow_Up_Service SHALL enforce a foreign key relationship between Follow_Up.patient_id and the patients table with RESTRICT on delete, preventing deletion of a patient who has associated follow-ups.
3. THE Follow_Up_Service SHALL enforce a foreign key relationship between Follow_Up.doctor_id and the users table with RESTRICT on delete, preventing deletion of a user who has associated follow-ups.
4. WHERE an assessment_id is provided, THE Follow_Up_Service SHALL enforce a foreign key relationship between Follow_Up.assessment_id and the assessments table with RESTRICT on delete, preventing deletion of an assessment that has associated follow-ups.
5. THE Follow_Up_Service SHALL restrict Follow_Up_Status values to exactly: pending, completed, cancelled.
6. IF a follow-up creation or update references a patient_id, doctor_id, or assessment_id that does not exist in the corresponding table, THEN THE Follow_Up_Service SHALL reject the operation and return an error indicating the referenced record was not found.

### Requirement 4: Follow-Up List on Patient Detail Page

**User Story:** As a doctor, I want to see all scheduled follow-ups for a patient on their detail page, so that I can review upcoming and past follow-up history.

#### Acceptance Criteria

1. THE Patient_Detail_Page SHALL display a "Follow-ups" section below the visit history table, listing all Follow_Up records for the current patient with columns: scheduled_date (formatted as dd MMM yyyy), notes (truncated to 100 characters with ellipsis if longer), and status (displayed as a status badge with value "pending", "completed", or "cancelled").
2. IF no Follow_Up records exist for the current patient, THEN THE Patient_Detail_Page SHALL display an empty-state message indicating no follow-ups are scheduled.
3. THE Patient_Detail_Page SHALL sort follow-ups with pending items first (ordered by nearest scheduled_date ascending), then completed and cancelled items ordered by scheduled_date descending.
4. IF a follow-up has status "pending", THEN THE Patient_Detail_Page SHALL display action buttons to mark it as completed or cancelled.
5. WHEN the doctor clicks a button to mark a follow-up as completed or cancelled, THE Patient_Detail_Page SHALL display a confirmation dialog before submitting the status change.
6. WHEN the doctor confirms marking a follow-up as completed, THE Follow_Up_Service SHALL update the Follow_Up status to "completed" and THE Patient_Detail_Page SHALL refresh the follow-up list to reflect the updated status.
7. WHEN the doctor confirms marking a follow-up as cancelled, THE Follow_Up_Service SHALL update the Follow_Up status to "cancelled" and THE Patient_Detail_Page SHALL refresh the follow-up list to reflect the updated status.
8. IF the Follow_Up_Service fails to update the status, THEN THE Patient_Detail_Page SHALL display an error notification indicating the status change failed and SHALL retain the follow-up in its previous state.

### Requirement 5: Dashboard Pending Follow-Ups Integration

**User Story:** As a doctor, I want the "Pending Follow-ups" KPI card on my dashboard to reflect actual follow-up data, so that I can see at a glance how many patients need follow-up visits.

#### Acceptance Criteria

1. THE Doctor_Dashboard SHALL display the count of Follow_Up records with status "pending" for the logged-in doctor in the "Pending Follow-ups" KPI card.
2. WHEN the doctor clicks the "Pending Follow-ups" KPI card, THE Doctor_Dashboard SHALL navigate to a follow-ups list view or expand an inline section showing pending follow-ups.
3. THE Doctor_Dashboard SHALL display follow-ups where the scheduled_date is today or overdue (past the scheduled date) with a visually differentiated background color or border distinct from future follow-ups.
4. THE Doctor_Dashboard SHALL display a "Today's Follow-ups" section listing all Follow_Up records with scheduled_date equal to today for the logged-in doctor, showing at minimum the patient name, patient ID, disease name, and follow-up date.
5. IF the logged-in doctor has zero pending follow-ups, THEN THE Doctor_Dashboard SHALL display "0" in the "Pending Follow-ups" KPI card and the "Today's Follow-ups" section SHALL display an empty-state message indicating no follow-ups are scheduled for today.

### Requirement 6: Follow-Up API Endpoints

**User Story:** As a frontend developer, I want well-defined API endpoints for follow-up CRUD operations, so that the UI can interact with follow-up data reliably.

#### Acceptance Criteria

1. THE Follow_Up_Service SHALL expose a POST /api/v1/followups endpoint that accepts a JSON body containing patient_id (required), scheduled_date (required), assessment_id (optional), and notes (optional, maximum 500 characters), creates a new Follow_Up record associated with the authenticated doctor, and returns the created record with HTTP 201.
2. THE Follow_Up_Service SHALL expose a GET /api/v1/followups endpoint that returns a paginated list of Follow_Up records filtered by the logged-in doctor, with optional query parameters for status (one of: "pending", "completed", "cancelled") and patient_id, supporting page (minimum 1) and page_size (1 to 100, default 20) parameters, and returning items, total, page, page_size, and total_pages in the response.
3. THE Follow_Up_Service SHALL expose a GET /api/v1/followups/{id} endpoint that returns a single Follow_Up record belonging to the authenticated doctor.
4. THE Follow_Up_Service SHALL expose a PATCH /api/v1/followups/{id} endpoint that allows updating the status (one of: "pending", "completed", "cancelled"), scheduled_date, or notes of a Follow_Up record belonging to the authenticated doctor, and returns the updated record.
5. THE Follow_Up_Service SHALL scope all follow-up queries to the authenticated doctor, preventing access to other doctors' follow-up records.
6. IF a request targets a Follow_Up that does not exist, THEN THE Follow_Up_Service SHALL return HTTP 404 with an error message indicating the follow-up record was not found.
7. IF an authenticated doctor attempts to access or modify a Follow_Up record belonging to another doctor, THEN THE Follow_Up_Service SHALL return HTTP 403 with an error message indicating insufficient permissions.
8. IF a POST or PATCH request contains invalid or missing required fields, THEN THE Follow_Up_Service SHALL return HTTP 422 with a response body identifying the fields that failed validation.

### Requirement 7: Follow-Up Status Transitions

**User Story:** As a doctor, I want follow-up status changes to follow valid transitions, so that data remains consistent and meaningful.

#### Acceptance Criteria

1. THE Follow_Up_Service SHALL allow status transitions only in the following directions: pending to completed, pending to cancelled.
2. THE Follow_Up_Service SHALL prevent status changes from completed or cancelled to any other status.
3. IF an invalid status transition is attempted, THEN THE Follow_Up_Service SHALL return HTTP 422 with a message indicating the current status and the list of allowed target statuses from that state.
4. IF an invalid status transition is attempted, THEN THE Follow_Up_Service SHALL leave the follow-up record unchanged with its previous status preserved.

### Requirement 8: Database Migration

**User Story:** As a developer, I want the follow-up table created via an Alembic migration, so that the schema change is versioned and reproducible.

#### Acceptance Criteria

1. THE Follow_Up_Service SHALL include an Alembic migration that creates a "followups" table with the following columns: id (BIGSERIAL, primary key), patient_id (BIGINT, NOT NULL, FK → patients.id ON DELETE RESTRICT), doctor_id (BIGINT, NOT NULL, FK → users.id ON DELETE RESTRICT), assessment_id (BIGINT, NULLABLE, FK → assessments.id ON DELETE RESTRICT), scheduled_date (DATE, NOT NULL), notes (VARCHAR(500), NULLABLE), status (VARCHAR(20), NOT NULL, DEFAULT 'pending'), created_at (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()), and updated_at (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()).
2. THE Follow_Up_Service SHALL constrain the status column to accept only the values "pending", "completed", and "cancelled".
3. THE Follow_Up_Service SHALL include single-column indexes on patient_id, doctor_id, status, and scheduled_date columns of the followups table.
4. THE Follow_Up_Service SHALL include a composite index on (doctor_id, status, scheduled_date) to support the dashboard pending follow-ups query.
5. THE Follow_Up_Service SHALL include a downgrade function in the migration that drops the followups table and all associated indexes, allowing the migration to be fully reversed.
