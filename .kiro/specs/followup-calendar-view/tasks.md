# Tasks: Follow-up Calendar View

## Task 1: Backend — Add Calendar Endpoint

- [ ] 1.1 Add `GET /calendar` endpoint to `backend/app/routers/followups.py` that accepts `start_date` and `end_date` query parameters (both required, type `date`), returns `list[FollowupResponse]` scoped to authenticated doctor, ordered by `scheduled_date` ascending
- [ ] 1.2 Add validation: `end_date` must be >= `start_date`, and the range must not exceed 42 days; return 422 if violated
- [ ] 1.3 Ensure the `/calendar` route is registered before `/{id}` to avoid route conflicts

## Task 2: Frontend Service — Add Calendar Method

- [ ] 2.1 Add `FollowupCalendarParams` interface with `start_date: string` and `end_date: string` to `frontend/src/app/core/services/followup.service.ts`
- [ ] 2.2 Add `getCalendar(params: FollowupCalendarParams): Observable<Followup[]>` method that calls `GET /api/v1/followups/calendar` with the date params

## Task 3: Date Utility Functions

- [ ] 3.1 Create `frontend/src/app/features/followup-calendar/calendar-date.utils.ts` with `ViewMode` type and `DateRange` interface
- [ ] 3.2 Implement `getWeekStart(date: Date): Date` — returns the Monday of the week containing the given date
- [ ] 3.3 Implement `getWeekEnd(date: Date): Date` — returns the Sunday of the week containing the given date
- [ ] 3.4 Implement `getDateRange(viewMode: ViewMode, referenceDate: Date): DateRange` — computes start/end dates for the visible window based on view mode
- [ ] 3.5 Implement `navigateDate(referenceDate: Date, viewMode: ViewMode, direction: 1 | -1): Date` — advances or retreats by one view unit
- [ ] 3.6 Implement `formatDateRangeLabel(viewMode: ViewMode, referenceDate: Date): string` — returns the formatted date range label for the header
- [ ] 3.7 Implement `groupFollowupsByDate(followups: Followup[]): Map<string, Followup[]>` — groups followups by their `scheduled_date` string key
- [ ] 3.8 Implement `getMonthGridDates(year: number, month: number): Date[]` — returns a flat array of 42 dates (6 weeks) for the month grid including leading/trailing days

## Task 4: Calendar Event Component

- [ ] 4.1 Create `frontend/src/app/features/followup-calendar/calendar-event.component.ts` as a standalone component
- [ ] 4.2 Accept `followup` input and render patient name, patient UID, and disease name
- [ ] 4.3 Apply status-based CSS classes: `.event-pending` (blue), `.event-completed` (green), `.event-cancelled` (grey + strikethrough)
- [ ] 4.4 Emit a `(clicked)` output event when the event card is clicked

## Task 5: Calendar Header Component

- [ ] 5.1 Create `frontend/src/app/features/followup-calendar/calendar-header.component.ts` as a standalone component
- [ ] 5.2 Accept `viewMode`, `dateRangeLabel` inputs; emit `(viewModeChange)`, `(navigate)`, `(today)` outputs
- [ ] 5.3 Render "Today" button, back/forward arrow buttons, date range label text, and view mode segmented control using PrimeNG SelectButton

## Task 6: Day View Component

- [ ] 6.1 Create `frontend/src/app/features/followup-calendar/calendar-day-view.component.ts` as a standalone component
- [ ] 6.2 Accept `currentDate` and `groupedFollowups` (Map) inputs; render a list of follow-up events for the single day
- [ ] 6.3 Emit `(eventClicked)` output when a calendar event is clicked

## Task 7: Week View Component

- [ ] 7.1 Create `frontend/src/app/features/followup-calendar/calendar-week-view.component.ts` as a standalone component
- [ ] 7.2 Accept `currentDate` and `groupedFollowups` (Map) inputs; render a 7-column grid (Mon–Sun) with day headers and event blocks in each column
- [ ] 7.3 Emit `(eventClicked)` output when a calendar event is clicked

## Task 8: Month View Component

- [ ] 8.1 Create `frontend/src/app/features/followup-calendar/calendar-month-view.component.ts` as a standalone component
- [ ] 8.2 Accept `currentDate` and `groupedFollowups` (Map) inputs; render a 7×6 date grid using `getMonthGridDates`
- [ ] 8.3 Display up to 3 events per cell; show "+N more" indicator when events exceed 3
- [ ] 8.4 Visually distinguish days outside the current month with reduced opacity
- [ ] 8.5 Emit `(eventClicked)` output when a calendar event is clicked

## Task 9: Event Action Panel Component

- [ ] 9.1 Create `frontend/src/app/features/followup-calendar/event-action-panel.component.ts` as a standalone component using PrimeNG Dialog
- [ ] 9.2 Accept `followup` and `visible` inputs; emit `(visibleChange)`, `(actionCompleted)` outputs
- [ ] 9.3 Display full follow-up details: patient name, patient UID, disease name, scheduled date, notes, status badge
- [ ] 9.4 Render "Mark Complete" and "Cancel" buttons when status is "pending"; hide action buttons for completed/cancelled
- [ ] 9.5 Render "Reschedule" button with PrimeNG Calendar date picker for pending follow-ups
- [ ] 9.6 Call `followupService.update()` for mark complete, cancel, and reschedule actions; emit `(actionCompleted)` on success
- [ ] 9.7 Display PrimeNG toast error notification if the update API call fails

## Task 10: Main Calendar Page Component

- [ ] 10.1 Create `frontend/src/app/features/followup-calendar/followup-calendar.component.ts` as a standalone component
- [ ] 10.2 Define signals: `viewMode`, `currentDate`, `followups`, `loading`, `selectedFollowup`, `showActionPanel`
- [ ] 10.3 Define computed signals: `dateRange`, `groupedFollowups`, `dateRangeLabel`
- [ ] 10.4 Implement data fetching with `effect()` that watches `dateRange` and calls `followupService.getCalendar()`
- [ ] 10.5 Render `CalendarHeaderComponent`, conditionally render Day/Week/Month view based on `viewMode`, and include `EventActionPanelComponent`
- [ ] 10.6 Handle header events: viewModeChange updates `viewMode`, navigate calls `navigateDate`, today resets `currentDate` to today
- [ ] 10.7 Handle event click: set `selectedFollowup` and open action panel
- [ ] 10.8 Handle action completed: close panel and re-fetch calendar data
- [ ] 10.9 Show a skeleton/loading state while data is being fetched

## Task 11: Routing and Sidebar Integration

- [ ] 11.1 Add `{ path: 'followups', loadComponent: ... }` to the `doctor` children array in `frontend/src/app/app.routes.ts`
- [ ] 11.2 Add `{ label: 'Follow-ups', route: '/doctor/followups', icon: 'pi-calendar' }` to `DOCTOR_NAV` array in `frontend/src/app/shared/components/sidebar/sidebar.component.ts`, positioned after "Patients"
