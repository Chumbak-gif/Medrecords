# Requirements Document

## Introduction

This feature adds a dedicated "Follow-ups" page to the doctor sidebar navigation, displaying follow-up appointments in a Google Calendar-style interface. Doctors can view scheduled follow-ups across Daily, Weekly, and Monthly calendar views, with color-coded status indicators. The calendar supports navigation controls, date range fetching, and allows doctors to click on follow-up events to take actions such as marking complete, cancelling, or rescheduling.

## Glossary

- **Calendar_View**: The main page component that renders follow-up appointments in a calendar grid layout with Daily, Weekly, and Monthly view modes
- **Follow_Up_Event**: A visual block/card rendered on the calendar representing a single follow-up appointment, displaying patient name, patient UID, and disease name
- **View_Mode**: One of three display modes for the calendar — Daily (time grid for a single day), Weekly (time grid for 7 days), or Monthly (date grid for the full month)
- **Navigation_Controls**: UI elements allowing the doctor to move forward/backward in time, jump to today, and see the current date range label
- **Date_Range**: The start and end dates defining the visible window of the calendar based on the current View_Mode and navigation position
- **Status_Color**: A visual color coding applied to Follow_Up_Events based on their status — blue for pending, green for completed, grey for cancelled
- **Action_Panel**: A dialog or popover displayed when a doctor clicks on a Follow_Up_Event, showing full details and action buttons
- **Calendar_API**: A backend endpoint that returns follow-ups filtered by date range for the authenticated doctor without pagination
- **Sidebar_Navigation**: The left-side navigation panel of the doctor shell that contains links to major sections of the application

## Requirements

### Requirement 1: Sidebar Navigation Entry

**User Story:** As a doctor, I want a "Follow-ups" link in my sidebar navigation, so that I can quickly access the calendar view of my scheduled follow-ups.

#### Acceptance Criteria

1. THE Sidebar_Navigation SHALL display a "Follow-ups" link with a calendar icon for users with the doctor role
2. WHEN the doctor clicks the "Follow-ups" link, THE Sidebar_Navigation SHALL navigate to the `/doctor/followups` route
3. WHILE the doctor is on the Follow-ups page, THE Sidebar_Navigation SHALL highlight the "Follow-ups" link as active

### Requirement 2: Calendar View Modes

**User Story:** As a doctor, I want to switch between Daily, Weekly, and Monthly views of my follow-ups, so that I can see my schedule at different levels of detail.

#### Acceptance Criteria

1. THE Calendar_View SHALL display a segmented control with three options: Day, Week, and Month
2. WHEN the doctor selects the Day view, THE Calendar_View SHALL render a single-day time grid showing follow-up events positioned by their scheduled date
3. WHEN the doctor selects the Week view, THE Calendar_View SHALL render a 7-day time grid starting from Monday, with follow-up events shown in their respective day columns
4. WHEN the doctor selects the Month view, THE Calendar_View SHALL render a date grid showing all days of the current month with follow-up events listed within each day cell
5. THE Calendar_View SHALL default to the Weekly View_Mode when first loaded

### Requirement 3: Navigation Controls

**User Story:** As a doctor, I want to navigate forward and backward through dates and jump to today, so that I can view follow-ups for any time period.

#### Acceptance Criteria

1. THE Navigation_Controls SHALL display a "Today" button that navigates the calendar to the current date
2. THE Navigation_Controls SHALL display forward and backward arrow buttons to advance or retreat the calendar by one unit of the current View_Mode
3. WHEN the doctor clicks the forward arrow in Day view, THE Calendar_View SHALL advance by one day
4. WHEN the doctor clicks the forward arrow in Week view, THE Calendar_View SHALL advance by one week
5. WHEN the doctor clicks the forward arrow in Month view, THE Calendar_View SHALL advance by one month
6. THE Navigation_Controls SHALL display a date range label showing the currently visible time period
7. WHEN the View_Mode is Day, THE Navigation_Controls SHALL display the date in the format "DD MMMM YYYY"
8. WHEN the View_Mode is Week, THE Navigation_Controls SHALL display the date range as "DD MMM – DD MMM YYYY"
9. WHEN the View_Mode is Month, THE Navigation_Controls SHALL display the month and year as "MMMM YYYY"

### Requirement 4: Follow-Up Event Display

**User Story:** As a doctor, I want to see follow-up appointments as colored blocks on the calendar, so that I can quickly identify patient visits and their status.

#### Acceptance Criteria

1. THE Calendar_View SHALL render each follow-up as a Follow_Up_Event block within the appropriate date cell or time slot
2. THE Follow_Up_Event SHALL display the patient name, patient UID, and disease name
3. WHILE the follow-up status is "pending", THE Follow_Up_Event SHALL use a blue Status_Color
4. WHILE the follow-up status is "completed", THE Follow_Up_Event SHALL use a green Status_Color
5. WHILE the follow-up status is "cancelled", THE Follow_Up_Event SHALL use a grey Status_Color and display the text with a strikethrough style
6. WHEN multiple follow-ups exist on the same day in Month view and the cell cannot display all events, THE Calendar_View SHALL show a "+N more" indicator with the count of hidden events

### Requirement 5: Event Action Panel

**User Story:** As a doctor, I want to click on a follow-up event to see details and take actions, so that I can manage follow-up statuses directly from the calendar.

#### Acceptance Criteria

1. WHEN the doctor clicks on a Follow_Up_Event, THE Action_Panel SHALL open displaying the full follow-up details including patient name, patient UID, disease name, scheduled date, notes, and current status
2. WHILE the follow-up status is "pending", THE Action_Panel SHALL display "Mark Complete" and "Cancel" action buttons
3. WHILE the follow-up status is "completed" or "cancelled", THE Action_Panel SHALL display the status as read-only without action buttons
4. WHEN the doctor clicks "Mark Complete", THE Action_Panel SHALL update the follow-up status to "completed" via the existing PATCH endpoint and refresh the calendar
5. WHEN the doctor clicks "Cancel", THE Action_Panel SHALL update the follow-up status to "cancelled" via the existing PATCH endpoint and refresh the calendar
6. WHILE the follow-up status is "pending", THE Action_Panel SHALL display a "Reschedule" button that allows the doctor to select a new date
7. WHEN the doctor confirms a reschedule, THE Action_Panel SHALL update the follow-up scheduled_date via the existing PATCH endpoint and refresh the calendar
8. IF the status update or reschedule fails, THEN THE Action_Panel SHALL display an error notification with the failure reason

### Requirement 6: Date Range Data Fetching

**User Story:** As a doctor, I want the calendar to efficiently load only the follow-ups visible in the current date range, so that performance remains fast regardless of total follow-up count.

#### Acceptance Criteria

1. WHEN the Calendar_View loads or the Date_Range changes, THE Calendar_View SHALL request follow-ups from the Calendar_API using the visible start and end dates
2. THE Calendar_API SHALL accept `start_date` and `end_date` query parameters and return all follow-ups for the authenticated doctor within that range without pagination
3. THE Calendar_API SHALL return follow-ups with denormalized patient_name, patient_uid, and disease_name fields
4. THE Calendar_API SHALL scope results to the authenticated doctor only
5. WHILE the Calendar_View is fetching data, THE Calendar_View SHALL display a loading indicator

### Requirement 7: Calendar Page Routing

**User Story:** As a doctor, I want the follow-ups calendar to be a distinct page in the application, so that I can bookmark and navigate to it directly.

#### Acceptance Criteria

1. THE Calendar_View SHALL be accessible at the route `/doctor/followups`
2. THE Calendar_View SHALL be protected by the doctor authentication guard
3. THE Calendar_View SHALL be implemented as a lazy-loaded standalone Angular component
