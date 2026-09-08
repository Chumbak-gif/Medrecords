# Requirements Document

## Introduction

MEDRecords is a Doctor-Patient Assessment & Pharma Analytics Portal developed for Emcure. The system enables doctors to conduct structured, visit-centric patient assessments using dynamically configured forms driven by disease-specific JSON schemas. Administrators manage all master data (diseases, form templates, medicines, doctors) through a governed CRUD interface. Pharma Viewers access aggregated analytics dashboards in read-only mode. System Administrators govern platform-level configuration and user provisioning. The portal enforces role-based access control (RBAC), a configurable record-lock window, a unified audit log, and compliance-grade consent capture across all 15 modules.

The frontend is built with Angular, PrimeNG, and Tailwind CSS using the Emcure design system (primary color `#ed1c24`, Poppins font, CSS variable design tokens). The backend is FastAPI (Python) with a PostgreSQL database. Authentication uses JWT (username/password). All records subject to soft-delete. Navigation is managed by a role-gated sidebar using Angular Signals and functional route guards.

---

## Glossary

- **MEDRecords System**: The full-stack web application described in this document.
- **Doctor**: A licensed medical professional who logs in to conduct patient assessments.
- **Admin**: The operational administrator responsible for managing all master data and viewing analytics.
- **Pharma Viewer**: A read-only stakeholder who accesses analytics dashboards and export logs.
- **System Admin**: A privileged user with platform-level configuration access and user provisioning rights.
- **Patient**: A person registered in the system who is the subject of one or more assessment visits.
- **Visit**: A single encounter between a Doctor and a Patient, resulting in one Assessment Record.
- **Assessment Record**: The complete data artifact of a Visit, including disease selection, dynamic form responses, prescription, and consent.
- **Disease**: A medical condition managed in the Disease Master; each Disease may have one or more Sub-Diseases.
- **Sub-Disease**: A subcategory or variant of a Disease, also managed in the Disease Master.
- **Form Template**: A JSON schema object configured by the Admin that defines sections and fields for a specific Disease's assessment form.
- **JSON Schema**: A structured JSON object that defines field types, labels, validation rules, and section grouping for a Form Template.
- **Medicine**: A pharmaceutical product managed in the Medicine Master, selectable in a Prescription.
- **Prescription**: A multi-row grid on the Assessment Form that captures prescribed medicines, dosage, and instructions for a Visit.
- **Draft**: The initial state of an Assessment Record that has been saved but not yet submitted.
- **Submitted**: The finalized state of an Assessment Record after the Doctor submits it.
- **Lock Window**: A configurable time period (defaulting to 24–48 hours) after submission during which an Assessment Record may be edited; once the window expires, the record auto-locks.
- **Locked**: The terminal state of an Assessment Record when the Lock Window has expired and no further edits are permitted.
- **Soft-Delete**: The practice of marking a record as inactive (is_active = false) rather than removing it from the database.
- **Audit Log**: A unified, append-only record of all create, update, delete, login, export, and state-change events across all roles.
- **Consent**: A per-patient acknowledgment captured digitally (checkbox or signature) before assessment data is recorded.
- **KPI Card**: A summary metric widget displayed on a dashboard.
- **Excel Export**: A spreadsheet file generated in .xlsx format.
- **PDF Export**: A structured document generated in .pdf format containing an individual patient assessment.
- **RBAC**: Role-Based Access Control — the mechanism that restricts UI routes and API endpoints based on the authenticated user's role.
- **JWT**: JSON Web Token used for stateless authentication.
- **Angular Signals**: Angular's reactive primitive used for state management in the frontend.
- **Functional Route Guard**: An Angular `canActivate` guard implemented as a pure function to protect routes.
- **PrimeNG**: The Angular UI component library used across all frontend views.
- **Emcure Design System**: The Emcure-branded design token set (CSS variables, Poppins font, primary `#ed1c24`) defined in `styles.css`.
- **Virtual Scrolling**: A rendering technique that renders only the visible subset of rows in large data tables to maintain performance.
- **Paginated API**: A backend endpoint that accepts `page` and `pageSize` parameters and returns a bounded result set with total count.

---

## Requirements

### Requirement 1 — Authentication & Role-Based Routing

**User Story:** As a user of any role, I want to log in with my username and password and be routed to the correct dashboard, so that I access only the features permitted for my role.

#### Acceptance Criteria

1. THE MEDRecords System SHALL authenticate users via a username and password credential pair validated against a PostgreSQL user store, returning a JWT access token on success.
2. WHEN a user provides invalid credentials, THE MEDRecords System SHALL return an HTTP 401 response and display an error message on the login page without revealing whether the username or password was incorrect.
3. WHEN a user successfully authenticates, THE MEDRecords System SHALL route the user to the role-specific default dashboard: Doctor to the Doctor Dashboard, Admin to the Admin Analytics Dashboard, Pharma Viewer to the Pharma Analytics Dashboard, and System Admin to the User Management panel.
4. THE MEDRecords System SHALL sign every JWT with HMAC-SHA256 and include the user's role and a configurable expiry timestamp in the token payload.
5. WHEN a JWT expires or is absent, THE MEDRecords System SHALL redirect the browser to `/login` using `replaceUrl: true` to prevent back-navigation to protected views.
6. THE MEDRecords System SHALL protect every internal route with a functional `canActivate` route guard that validates the JWT and the user's role before rendering the route component.
7. THE MEDRecords System SHALL prevent authenticated users from accessing the `/login` route by redirecting them to their role-specific dashboard via a `guestGuard`.
8. THE MEDRecords System SHALL render sidebar navigation items conditionally using `@if (auth.hasRole(...))` so that menu entries inaccessible to the current role are never injected into the DOM.
9. WHEN a user logs out, THE MEDRecords System SHALL clear the JWT from client storage and navigate to `/login` using `replaceUrl: true`.
10. THE MEDRecords System SHALL record every login attempt (successful and failed) in the Audit Log, including the username, timestamp, IP address, and outcome.

---

### Requirement 2 — Disease & Sub-Disease Master

**User Story:** As an Admin, I want to manage diseases and their sub-diseases through a governed CRUD interface, so that the Disease Master remains accurate and drives dynamic form loading.

#### Acceptance Criteria

1. THE MEDRecords System SHALL provide the Admin with a paginated, searchable list of all Diseases and their associated Sub-Diseases.
2. WHEN an Admin creates a Disease, THE MEDRecords System SHALL require a unique disease name and an active status flag, and persist the record to the database.
3. WHEN an Admin creates a Sub-Disease, THE MEDRecords System SHALL require the Sub-Disease to be associated with exactly one parent Disease.
4. WHEN an Admin updates a Disease or Sub-Disease record, THE MEDRecords System SHALL validate all required fields before persisting the change and record the update in the Audit Log.
5. WHEN an Admin soft-deletes a Disease, THE MEDRecords System SHALL set `is_active = false` on the Disease and all associated Sub-Diseases, and exclude them from Doctor-facing disease selection dropdowns.
6. IF a Disease has associated Assessment Records, THEN THE MEDRecords System SHALL prevent hard deletion and display a notification explaining that the Disease is referenced by existing records.
7. THE MEDRecords System SHALL expose Disease and Sub-Disease data through a Paginated API accepting `page`, `pageSize`, and `search` query parameters.
8. WHEN an Admin restores a soft-deleted Disease, THE MEDRecords System SHALL set `is_active = true` and make the Disease available again in Doctor-facing dropdowns.

---

### Requirement 3 — Form Template Builder

**User Story:** As an Admin, I want to configure assessment form templates per disease using a visual builder, so that Doctors see disease-appropriate structured forms during patient visits.

#### Acceptance Criteria

1. THE MEDRecords System SHALL allow the Admin to create, update, and soft-delete Form Templates, each associated with exactly one Disease.
2. WHEN an Admin configures a Form Template, THE MEDRecords System SHALL allow the Admin to define one or more named sections, each containing one or more fields.
3. THE MEDRecords System SHALL support the following field types in a Form Template: text input, number input, date picker, single-select dropdown, multi-select dropdown, radio button group, checkbox group, and textarea.
4. WHEN an Admin saves a Form Template, THE MEDRecords System SHALL serialize the template definition as a JSON Schema and persist it to the database linked to the Disease record.
5. THE MEDRecords System SHALL validate the JSON Schema structure before persisting, ensuring every field definition contains a unique field key, a label, a type, and a required flag.
6. WHEN a Form Template is updated, THE MEDRecords System SHALL preserve historical JSON Schemas for Assessment Records already submitted under the previous template version, so that locked records remain readable.
7. THE MEDRecords System SHALL display a live preview of the form layout to the Admin within the Form Template Builder before the template is saved.
8. IF a Disease already has an active Form Template, THEN THE MEDRecords System SHALL prompt the Admin to confirm before replacing the active template with a new version.

---

### Requirement 4 — Medicine Master

**User Story:** As an Admin, I want to maintain a catalogue of medicines with support for bulk import, so that Doctors can select accurate medicines when writing prescriptions.

#### Acceptance Criteria

1. THE MEDRecords System SHALL provide the Admin with a paginated, searchable list of all active Medicines.
2. WHEN an Admin creates a Medicine record, THE MEDRecords System SHALL require a unique medicine name and an active status flag before persisting.
3. WHEN an Admin uploads an Excel file to the Medicine Master, THE MEDRecords System SHALL validate every row against the Medicine schema and perform an upsert (insert new, update existing by medicine name) using bulk database operations.
4. IF one or more rows in the uploaded Excel file fail validation, THEN THE MEDRecords System SHALL reject the entire batch, return a row-level error report to the Admin, and leave the database unchanged.
5. THE MEDRecords System SHALL provide the Admin with a downloadable Excel template defining the required column headers for bulk Medicine import.
6. WHEN an Admin soft-deletes a Medicine, THE MEDRecords System SHALL set `is_active = false` and exclude the Medicine from Doctor-facing prescription dropdowns.
7. THE MEDRecords System SHALL expose Medicine data through a Paginated API accepting `page`, `pageSize`, and `search` query parameters.

---

### Requirement 5 — Doctor Master

**User Story:** As an Admin, I want to create and manage Doctor accounts, so that only authorized Doctors can access the portal and conduct assessments.

#### Acceptance Criteria

1. THE MEDRecords System SHALL allow the Admin to create Doctor accounts by providing a full name, username, email address, specialty, and an initial password.
2. WHEN an Admin creates a Doctor account, THE MEDRecords System SHALL hash the password using a secure one-way hashing algorithm before storing it.
3. THE MEDRecords System SHALL provide the Admin with a paginated, searchable list of all Doctor accounts showing name, username, specialty, and active status.
4. WHEN an Admin updates a Doctor account, THE MEDRecords System SHALL validate all required fields and record the update in the Audit Log.
5. WHEN an Admin soft-deletes a Doctor account, THE MEDRecords System SHALL set `is_active = false`, immediately revoke any active JWT sessions for that Doctor, and prevent future logins.
6. IF a Doctor has submitted Assessment Records, THEN THE MEDRecords System SHALL retain the Doctor record with `is_active = false` to preserve data integrity of historical assessment records.
7. WHEN an Admin resets a Doctor's password, THE MEDRecords System SHALL require the new password to meet a minimum complexity rule (at least 8 characters, at least one digit) and record the reset event in the Audit Log.

---

### Requirement 6 — Patient Registration & Management

**User Story:** As a Doctor, I want to register new patients and retrieve existing patient records, so that assessments are always linked to the correct patient identity.

#### Acceptance Criteria

1. THE MEDRecords System SHALL allow a Doctor to register a new Patient by providing a first name, last name, date of birth, gender, contact number, and an optional email address.
2. WHEN a new Patient is registered, THE MEDRecords System SHALL generate a unique Patient ID and persist the record.
3. THE MEDRecords System SHALL provide the Doctor with a paginated, searchable patient list filtered to patients assessed by that Doctor, supporting search by patient name and Patient ID.
4. WHEN a Doctor selects an existing Patient to begin a new Visit, THE MEDRecords System SHALL display a summary of the Patient's previous Visit history, including visit dates, disease names, and Assessment Record statuses.
5. THE MEDRecords System SHALL prevent duplicate Patient registrations by checking for an existing record with the same contact number before saving a new Patient.
6. IF a duplicate contact number is detected during Patient registration, THEN THE MEDRecords System SHALL display a warning with a link to the existing Patient record and prevent saving the duplicate.
7. THE MEDRecords System SHALL expose Patient data through a Paginated API that accepts `page`, `pageSize`, and `search` parameters, returning only records the requesting Doctor is authorized to view.

---

### Requirement 7 — Dynamic Assessment Form (Visit-Centric)

**User Story:** As a Doctor, I want to select a disease and have the corresponding assessment form render automatically, so that I can capture structured clinical data during a patient visit.

#### Acceptance Criteria

1. WHEN a Doctor initiates a new Visit, THE MEDRecords System SHALL require the Doctor to select a Disease (and optionally a Sub-Disease) before the assessment form renders.
2. WHEN a Disease is selected, THE MEDRecords System SHALL fetch the active Form Template JSON Schema for that Disease from the API and dynamically render all sections and fields defined in the schema.
3. THE MEDRecords System SHALL render each field according to its declared type in the JSON Schema: text input, number input, date picker, single-select dropdown, multi-select dropdown, radio button group, checkbox group, or textarea.
4. THE MEDRecords System SHALL enforce field-level validation rules defined in the JSON Schema (required fields, numeric ranges, date constraints) before allowing the Doctor to submit the Assessment Record.
5. THE MEDRecords System SHALL capture patient demographics (name, date of birth, gender, contact) within the Assessment Form as the first section, populated from the selected Patient record and editable before submission.
6. WHEN an Assessment Record is in Draft state, THE MEDRecords System SHALL allow the Doctor to save progress at any time without triggering full form validation.
7. WHEN the Doctor submits an Assessment Record, THE MEDRecords System SHALL transition the record from Draft to Submitted state, record the submission timestamp, and start the Lock Window timer.
8. THE MEDRecords System SHALL render the Prescription Grid as a distinct section within the Assessment Form, allowing the Doctor to add, edit, and remove prescription rows before submission.
9. WHEN a Doctor opens an Assessment Record in Submitted state within the active Lock Window, THE MEDRecords System SHALL permit editing and re-submission, updating the submission timestamp.
10. WHEN a Doctor opens a Locked Assessment Record, THE MEDRecords System SHALL display the record in read-only mode and indicate the locked status with a visible badge.
11. IF no active Form Template exists for the selected Disease, THEN THE MEDRecords System SHALL display an informational message to the Doctor and prevent Assessment Record creation until the Admin configures a template.

---

### Requirement 8 — Prescription Grid

**User Story:** As a Doctor, I want to prescribe multiple medicines with dosage and instructions in a structured grid, so that prescription data is captured consistently with every assessment.

#### Acceptance Criteria

1. THE MEDRecords System SHALL render the Prescription Grid as a multi-row table within the Assessment Form, with each row containing: Medicine (searchable dropdown from the Medicine Master), Dosage, Frequency, Duration, and Instructions (free text).
2. THE MEDRecords System SHALL allow the Doctor to add a new prescription row by clicking an "Add Medicine" action, with no upper limit on the number of rows per Visit.
3. THE MEDRecords System SHALL allow the Doctor to remove any individual prescription row from the grid before submission.
4. WHEN the Assessment Record is submitted, THE MEDRecords System SHALL require at least one prescription row to contain a selected Medicine; an empty Prescription Grid SHALL prevent submission and display a validation message.
5. THE MEDRecords System SHALL populate the Medicine dropdown in the Prescription Grid using a searchable, paginated API call to the Medicine Master, filtered to active medicines only.
6. WHEN a Locked Assessment Record is viewed, THE MEDRecords System SHALL render the Prescription Grid in read-only mode with no add or remove controls visible.

---

### Requirement 9 — Draft & Submit Workflow with Configurable Lock Window

**User Story:** As a System Admin, I want to configure the lock window duration, and as a Doctor I want clear status indicators, so that records are editable for a defined period and then auto-lock.

#### Acceptance Criteria

1. THE MEDRecords System SHALL maintain three Assessment Record states: Draft, Submitted, and Locked.
2. WHEN a Doctor saves an Assessment Record without submitting, THE MEDRecords System SHALL persist the record in Draft state with a `draft_saved_at` timestamp.
3. WHEN a Doctor submits an Assessment Record, THE MEDRecords System SHALL record a `submitted_at` timestamp and begin the Lock Window countdown.
4. THE MEDRecords System SHALL apply a configurable Lock Window duration (in hours) defined by the System Admin via a platform configuration setting, defaulting to 24 hours.
5. WHEN the current UTC time exceeds `submitted_at` plus the configured Lock Window duration, THE MEDRecords System SHALL transition the Assessment Record to Locked state automatically, without requiring a manual trigger.
6. THE MEDRecords System SHALL display the current state of every Assessment Record using a visible status badge (Draft, Submitted, Locked) on all list and detail views.
7. WHEN a Submitted record is within the active Lock Window, THE MEDRecords System SHALL display the remaining editable time (in hours and minutes) to the Doctor viewing the record.
8. THE MEDRecords System SHALL record every state transition (Draft → Submitted, Submitted → Locked, Submitted → re-Submitted) in the Audit Log with the acting user, timestamp, and record identifier.
9. WHERE the System Admin adjusts the Lock Window duration, THE MEDRecords System SHALL apply the new duration to all subsequent submissions and NOT retroactively alter the lock times of already-submitted records.

---

### Requirement 10 — Doctor Dashboard

**User Story:** As a Doctor, I want a personalized dashboard showing my key activity metrics and recent records, so that I can quickly navigate to ongoing or recent work.

#### Acceptance Criteria

1. THE MEDRecords System SHALL display the following KPI Cards on the Doctor Dashboard: total patients assessed (all time), assessments submitted this month, assessments in Draft state, and assessments in Locked state.
2. THE MEDRecords System SHALL display a Recent Assessment Records table on the Doctor Dashboard showing the 20 most recent records for the logged-in Doctor, sorted by last-modified date descending.
3. THE MEDRecords System SHALL include the following columns in the Recent Assessment Records table: Patient Name, Patient ID, Disease, Visit Date, and Status badge.
4. WHEN a Doctor clicks a row in the Recent Assessment Records table, THE MEDRecords System SHALL navigate to the full Assessment Record view for that record.
5. THE MEDRecords System SHALL load the Doctor Dashboard KPI counts from dedicated aggregation API endpoints, not by loading all records client-side.
6. THE MEDRecords System SHALL apply Virtual Scrolling to the Recent Assessment Records table when the dataset exceeds 50 rows.
7. THE MEDRecords System SHALL provide a shortcut action button on the Doctor Dashboard to initiate a new Visit.

---

### Requirement 11 — Admin Analytics Dashboard

**User Story:** As an Admin, I want an analytics dashboard with graphical and statistical views filtered by date, disease, and doctor, so that I can monitor assessment activity and identify trends.

#### Acceptance Criteria

1. THE MEDRecords System SHALL display the following KPI Cards on the Admin Analytics Dashboard: total assessments (all time), assessments this month, total active patients, total active doctors, and total active diseases.
2. THE MEDRecords System SHALL render a bar chart showing monthly assessment volume for the trailing 12 months on the Admin Analytics Dashboard.
3. THE MEDRecords System SHALL render a pie or donut chart showing the distribution of assessments by Disease on the Admin Analytics Dashboard.
4. THE MEDRecords System SHALL render a line chart showing assessment trend over the selected date range on the Admin Analytics Dashboard.
5. THE MEDRecords System SHALL provide filter controls on the Admin Analytics Dashboard for: date range (from/to), Disease (multi-select), and Doctor (multi-select).
6. WHEN an Admin applies dashboard filters, THE MEDRecords System SHALL reload all charts and KPI values using the selected filter parameters without a full page reload.
7. THE MEDRecords System SHALL display a statistical summary table on the Admin Analytics Dashboard listing each active Disease, the total assessment count for that disease, the count this month, and the count of locked vs. submitted records.
8. THE MEDRecords System SHALL load all analytics data from Paginated API endpoints that accept filter parameters, not by loading raw records client-side.

---

### Requirement 12 — Excel Export

**User Story:** As a Doctor, I want to export my monthly assessment data to Excel, and as an Admin I want to export a consolidated dataset, so that data can be used in offline reporting workflows.

#### Acceptance Criteria

1. THE MEDRecords System SHALL allow a Doctor to export all Assessment Records for a selected month and year as an .xlsx file containing one row per Assessment Record.
2. THE MEDRecords System SHALL include the following columns in the Doctor's monthly Excel export: Patient ID, Patient Name, Date of Birth, Gender, Disease, Sub-Disease, Visit Date, Submission Date, Status, and all dynamic form field values as individual columns.
3. THE MEDRecords System SHALL allow the Admin to export a consolidated .xlsx file covering a configurable date range with filter options for Disease and Doctor.
4. THE MEDRecords System SHALL generate the .xlsx file client-side using the XLSX library to avoid loading large datasets into server memory.
5. WHEN an Excel export is generated, THE MEDRecords System SHALL record the export event in the Audit Log including the requesting user, export type, applied filters, timestamp, and row count exported.
6. THE MEDRecords System SHALL name exported files using a structured pattern: `MEDRecords_[ExportType]_[YYYY-MM-DD].xlsx`.

---

### Requirement 13 — PDF Export (Individual Patient Assessment)

**User Story:** As a Doctor, I want to export a single patient's assessment as a formatted PDF, so that I can share or archive a clinical record outside the portal.

#### Acceptance Criteria

1. THE MEDRecords System SHALL provide a "Download PDF" action on every Assessment Record detail view.
2. WHEN a Doctor triggers a PDF export, THE MEDRecords System SHALL generate a structured PDF document containing: Patient demographics, Visit date, Disease and Sub-Disease, all assessment form field labels and values, and the full Prescription Grid.
3. THE MEDRecords System SHALL include the Emcure logo and the MEDRecords portal name in the PDF header.
4. THE MEDRecords System SHALL generate the PDF client-side using `jspdf-autotable`, safely parsing null and date values to prevent rendering errors.
5. WHEN a PDF export is generated, THE MEDRecords System SHALL record the export event in the Audit Log including the requesting user, patient ID, assessment record ID, and timestamp.
6. THE MEDRecords System SHALL name the exported PDF file using the pattern: `MEDRecords_Patient_[PatientID]_Visit_[YYYY-MM-DD].pdf`.

---

### Requirement 14 — Unified Audit Log & Export Log

**User Story:** As a System Admin or Admin, I want to view and export a unified audit log covering all user actions across all roles, so that the system maintains a complete, tamper-evident activity trail.

#### Acceptance Criteria

1. THE MEDRecords System SHALL append an entry to the Audit Log for every event of the following types: user login (success/failure), user logout, Assessment Record created, Assessment Record updated, Assessment Record state change, Patient registered, Master data created/updated/deleted, Form Template saved, Excel export generated, and PDF export generated.
2. THE MEDRecords System SHALL store each Audit Log entry with the following fields: event type, actor username, actor role, affected entity type, affected entity ID, timestamp (UTC), IP address, and an optional description.
3. THE MEDRecords System SHALL present the Audit Log to System Admin and Admin roles as a paginated, filterable table supporting filters on event type, actor username, date range, and affected entity type.
4. THE MEDRecords System SHALL make the Audit Log read-only; no user role SHALL have the ability to edit or delete Audit Log entries through the portal interface.
5. WHEN an Admin or System Admin exports the Audit Log, THE MEDRecords System SHALL generate a .xlsx file covering the filtered result set and record the export action itself in the Audit Log.
6. THE MEDRecords System SHALL load Audit Log records from a Paginated API endpoint accepting `page`, `pageSize`, `eventType`, `actorUsername`, `fromDate`, and `toDate` parameters.
7. THE MEDRecords System SHALL apply Virtual Scrolling to the Audit Log table on the frontend when the visible dataset exceeds 50 rows.

---

### Requirement 15 — Consent Capture Per Patient

**User Story:** As a Doctor, I want to capture and record each patient's informed consent before conducting an assessment, so that the portal maintains a verifiable consent trail per patient per visit.

#### Acceptance Criteria

1. THE MEDRecords System SHALL display a Consent section as the first step of every new Assessment Form, presenting a plain-language consent statement to the Doctor and Patient.
2. THE MEDRecords System SHALL require the Doctor to check a consent acknowledgment checkbox confirming that the Patient has provided verbal or written consent before the assessment form fields become editable.
3. WHEN the consent checkbox is checked, THE MEDRecords System SHALL record a Consent Record linked to the Patient and the current Visit, storing the consenting Doctor's username, the consent timestamp (UTC), and the consent statement version displayed.
4. THE MEDRecords System SHALL prevent Assessment Record submission if no Consent Record is associated with the current Visit.
5. IF a Patient already has a Consent Record for a prior Visit, THEN THE MEDRecords System SHALL still require a fresh consent acknowledgment for each new Visit.
6. THE MEDRecords System SHALL display consent history for a Patient (list of visits with consent timestamps and Doctor names) to Admin and System Admin roles.
7. WHEN a Consent Record is created, THE MEDRecords System SHALL append an entry to the Audit Log recording the patient ID, visit ID, consenting Doctor, and timestamp.

---

### Requirement 16 — System Administration & Platform Configuration

**User Story:** As a System Admin, I want to manage platform-level configuration and user provisioning, so that the portal operates within governed parameters without requiring code changes.

#### Acceptance Criteria

1. THE MEDRecords System SHALL restrict System Admin routes and API endpoints using a dedicated role guard that permits access only to users with the System Admin role.
2. THE MEDRecords System SHALL allow the System Admin to configure the Lock Window duration (minimum 1 hour, maximum 168 hours) through a settings interface and persist the value in the application configuration store.
3. THE MEDRecords System SHALL allow the System Admin to create, activate, and deactivate user accounts for all roles (Doctor, Admin, Pharma Viewer, System Admin).
4. WHEN the System Admin deactivates a user account, THE MEDRecords System SHALL set `is_active = false`, immediately invalidate active JWT sessions for that user, and record the action in the Audit Log.
5. THE MEDRecords System SHALL allow the System Admin to view and export the full Audit Log without filter restrictions.
6. THE MEDRecords System SHALL expose all platform configuration changes in the Audit Log with the System Admin's username, the parameter changed, old value, new value, and timestamp.

---

### Requirement 17 — Performance & Scalability Standards

**User Story:** As any user, I want the portal to remain responsive under normal load, so that clinical workflows are not interrupted by performance issues.

#### Acceptance Criteria

1. THE MEDRecords System SHALL implement API-side pagination (`LIMIT`/`OFFSET`) on every list endpoint, with a default page size of 20 and a maximum page size of 100.
2. THE MEDRecords System SHALL apply Angular Virtual Scrolling (CDK) to all data tables that may render more than 50 rows simultaneously.
3. WHEN a paginated list API is called, THE MEDRecords System SHALL return the result set, the total record count, the current page, and the page size in the response body.
4. THE MEDRecords System SHALL validate every inbound API request payload through FastAPI Pydantic schema validation before executing any business logic or database operation.
5. THE MEDRecords System SHALL return a consistent JSON error envelope `{ "detail": [...] }` for all validation and system errors from the FastAPI backend.
6. THE MEDRecords System SHALL use CSS variables defined in the Emcure Design System (`styles.css`) for all colors, spacing, and typography in Angular components, with no hardcoded hex color values in component stylesheets.
