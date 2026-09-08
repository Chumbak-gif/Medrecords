# Design Document: Follow-up Calendar View

## Overview

This design describes the implementation of a Google Calendar-style follow-up calendar page for the doctor role. It covers the new Angular component, backend API endpoint, routing changes, and sidebar navigation additions.

## Architecture

### Component Structure

```
frontend/src/app/features/followup-calendar/
├── followup-calendar.component.ts       # Main page component (standalone)
├── calendar-header.component.ts         # Navigation controls + view mode selector
├── calendar-day-view.component.ts       # Day view grid
├── calendar-week-view.component.ts      # Week view grid
├── calendar-month-view.component.ts     # Month view grid
├── calendar-event.component.ts          # Individual event block/card
├── event-action-panel.component.ts      # Click-to-open detail/action dialog
└── calendar-date.utils.ts              # Pure date calculation utilities
```

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ FollowupCalendarComponent (page)                        │
│                                                         │
│  ┌──────────────┐   viewMode, currentDate signals       │
│  │ CalendarHeader│◄─────────────────────────────────┐   │
│  └──────┬───────┘                                   │   │
│         │ emits: viewModeChange, navigate, today     │   │
│         ▼                                           │   │
│  ┌──────────────────────┐                           │   │
│  │ Day/Week/Month View  │   dateRange computed      │   │
│  │ (conditional render) │◄──────────────────────────┤   │
│  └──────────┬───────────┘                           │   │
│             │ renders                               │   │
│             ▼                                       │   │
│  ┌──────────────────┐                              │   │
│  │ CalendarEvent(s)  │────click────►┌──────────┐   │   │
│  └──────────────────┘              │ActionPanel│   │   │
│                                    └──────────┘   │   │
└─────────────────────────────────────────────────────────┘
         │                                    │
         │ HTTP GET /api/v1/followups/calendar │ HTTP PATCH /api/v1/followups/{id}
         ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│ Backend: FastAPI                                         │
│ GET /api/v1/followups/calendar?start_date=&end_date=    │
│ Returns: FollowupResponse[] (no pagination)             │
└─────────────────────────────────────────────────────────┘
```

## Detailed Design

### 1. Backend: New Calendar Endpoint

**File:** `backend/app/routers/followups.py`

Add a new `GET /calendar` endpoint before `/{id}` to avoid route conflicts:

```python
@router.get("/calendar", response_model=list[FollowupResponse])
async def list_followups_calendar(
    start_date: date_type = Query(..., description="Range start (inclusive)"),
    end_date: date_type = Query(..., description="Range end (inclusive)"),
    current_user: User = Depends(role_required(["doctor"])),
    db: AsyncSession = Depends(get_db),
) -> list[FollowupResponse]:
    """Return all follow-ups for the authenticated doctor within a date range."""
    q = (
        select(Followup)
        .where(Followup.doctor_id == current_user.id)
        .where(Followup.scheduled_date >= start_date)
        .where(Followup.scheduled_date <= end_date)
        .order_by(Followup.scheduled_date.asc())
    )
    result = await db.execute(q)
    followups = result.scalars().all()
    return [await _enrich_followup(f, db) for f in followups]
```

**Validation:** `end_date` must be >= `start_date`. Maximum range of 42 days (6 weeks — enough for any monthly view with boundary days).

### 2. Frontend Service Extension

**File:** `frontend/src/app/core/services/followup.service.ts`

Add a new method:

```typescript
export interface FollowupCalendarParams {
  start_date: string;  // yyyy-MM-dd
  end_date: string;    // yyyy-MM-dd
}

getCalendar(params: FollowupCalendarParams): Observable<Followup[]> {
  const httpParams = new HttpParams()
    .set('start_date', params.start_date)
    .set('end_date', params.end_date);
  return this.http.get<Followup[]>(`${API_BASE}/calendar`, { params: httpParams });
}
```

### 3. Date Utility Functions

**File:** `frontend/src/app/features/followup-calendar/calendar-date.utils.ts`

Pure functions for calendar calculations:

```typescript
export type ViewMode = 'day' | 'week' | 'month';

export interface DateRange {
  start: Date;  // inclusive
  end: Date;    // inclusive
}

/** Get the Monday of the week containing the given date */
export function getWeekStart(date: Date): Date;

/** Get the Sunday of the week containing the given date */
export function getWeekEnd(date: Date): Date;

/** Compute the visible date range for a given view mode and reference date */
export function getDateRange(viewMode: ViewMode, referenceDate: Date): DateRange;

/** Navigate forward/backward by one view unit */
export function navigateDate(referenceDate: Date, viewMode: ViewMode, direction: 1 | -1): Date;

/** Format date range label based on view mode */
export function formatDateRangeLabel(viewMode: ViewMode, referenceDate: Date): string;

/** Group followups by date string (yyyy-MM-dd) for efficient rendering */
export function groupFollowupsByDate(followups: Followup[]): Map<string, Followup[]>;

/** Generate array of dates for month grid (includes leading/trailing days from adjacent months) */
export function getMonthGridDates(year: number, month: number): Date[];
```

### 4. Main Calendar Component

**File:** `frontend/src/app/features/followup-calendar/followup-calendar.component.ts`

Standalone component using Angular signals:

```typescript
@Component({
  selector: 'app-followup-calendar',
  standalone: true,
  imports: [
    CommonModule,
    CalendarHeaderComponent,
    CalendarDayViewComponent,
    CalendarWeekViewComponent,
    CalendarMonthViewComponent,
    EventActionPanelComponent,
    ToastModule,
    SkeletonModule,
  ],
  ...
})
export class FollowupCalendarComponent implements OnInit, OnDestroy {
  // Signals
  viewMode = signal<ViewMode>('week');
  currentDate = signal<Date>(new Date());
  followups = signal<Followup[]>([]);
  loading = signal(false);
  selectedFollowup = signal<Followup | null>(null);
  showActionPanel = signal(false);

  // Computed
  dateRange = computed(() => getDateRange(this.viewMode(), this.currentDate()));
  groupedFollowups = computed(() => groupFollowupsByDate(this.followups()));
  dateRangeLabel = computed(() => formatDateRangeLabel(this.viewMode(), this.currentDate()));
}
```

**Data fetching:** Uses an `effect()` that watches `dateRange` and triggers `followupService.getCalendar()` whenever the visible range changes.

### 5. Calendar Header Component

Renders:
- "Today" button
- Back/Forward arrow buttons
- Date range label (from computed signal)
- View mode segmented control (Day | Week | Month)

Uses PrimeNG `ButtonModule` and `SelectButtonModule` for the view toggle.

### 6. View Components

**Day View:** Single column with time slots (or simplified list for the day). Shows all events for the single date.

**Week View:** 7-column grid with day headers (Mon–Sun). Events are rendered as colored blocks within each day column.

**Month View:** 6×7 grid (rows × days). Each cell shows the date number and up to 3 events. Overflow triggers "+N more" indicator.

### 7. Calendar Event Component

Small card/block rendered inside the calendar grid:

```html
<div class="calendar-event" [class]="statusClass">
  <span class="event-patient">{{ followup.patient_name }}</span>
  <span class="event-uid">{{ followup.patient_uid }}</span>
  <span class="event-disease">{{ followup.disease_name }}</span>
</div>
```

Status classes:
- `.event-pending` → `background: #dbeafe; border-left: 3px solid #3b82f6;`
- `.event-completed` → `background: #dcfce7; border-left: 3px solid #10b981;`
- `.event-cancelled` → `background: #f3f4f6; border-left: 3px solid #9ca3af; text-decoration: line-through;`

### 8. Event Action Panel

Uses PrimeNG `DialogModule` as a modal/dialog. Shows:
- Patient name, UID, disease name, scheduled date, notes, status badge
- Action buttons conditionally rendered based on status:
  - Pending: "Mark Complete", "Cancel", "Reschedule"
  - Completed/Cancelled: read-only display only

Reschedule uses PrimeNG `CalendarModule` (date picker) inline within the dialog.

### 9. Routing

**File:** `frontend/src/app/app.routes.ts`

Add to the `doctor` children array:

```typescript
{
  path: 'followups',
  loadComponent: () => import('./features/followup-calendar/followup-calendar.component')
    .then(m => m.FollowupCalendarComponent)
}
```

### 10. Sidebar Navigation

**File:** `frontend/src/app/shared/components/sidebar/sidebar.component.ts`

Add to `DOCTOR_NAV` array:

```typescript
{ label: 'Follow-ups', route: '/doctor/followups', icon: 'pi-calendar' }
```

Position: After "Patients" and before "New Assessment" for logical grouping.

## Correctness Properties

### Property 1: Week Start is Always Monday

For any date, `getWeekStart(date)` returns a Monday (day index 1), and the returned date is within 0–6 days before the input date.

**Relates to:** Requirement 2, Criterion 3

### Property 2: Date Range Containment

For any view mode and reference date, the computed `DateRange.start <= referenceDate <= DateRange.end`.

**Relates to:** Requirement 2, Criteria 2–4

### Property 3: Navigation Round-Trip

For any date and view mode, `navigateDate(navigateDate(date, mode, 1), mode, -1)` returns the original date (for day and week views). For month view, navigating forward then backward returns to the same month.

**Relates to:** Requirement 3, Criterion 2

### Property 4: Follow-ups Grouped Correctly

For any list of follow-ups, `groupFollowupsByDate(followups)` produces a map where every followup appears exactly once, keyed by its `scheduled_date`.

**Relates to:** Requirement 4, Criterion 1

### Property 5: Calendar API Returns Only In-Range Results

For any `start_date` and `end_date` and set of follow-ups in the database, the `/calendar` endpoint returns only follow-ups where `start_date <= scheduled_date <= end_date`.

**Relates to:** Requirement 6, Criterion 2

### Property 6: Overflow Indicator Count

For any number of events N on a day in month view, if N > MAX_VISIBLE (3), the "+N more" indicator shows exactly `N - MAX_VISIBLE`.

**Relates to:** Requirement 4, Criterion 6

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Calendar rendering | Custom components | No heavy calendar library needed; PrimeNG does not include a full Google Calendar-style view. Tailwind + grid layout is sufficient. |
| State management | Angular signals | Consistent with existing codebase (doctor-dashboard uses signals) |
| View toggle | PrimeNG SelectButton | Built-in segmented control component already available |
| Action dialog | PrimeNG Dialog | Already used across the app (export dialog, etc.) |
| Date picker (reschedule) | PrimeNG Calendar | Standard date input component in the PrimeNG suite |
| Date calculations | Custom pure functions | Minimal date math needed; avoids adding date-fns/moment dependency |
| Styling | TailwindCSS + component styles | Consistent with existing codebase patterns |

## File Changes Summary

| File | Change Type |
|------|-------------|
| `backend/app/routers/followups.py` | Add `GET /calendar` endpoint |
| `frontend/src/app/core/services/followup.service.ts` | Add `getCalendar()` method |
| `frontend/src/app/features/followup-calendar/followup-calendar.component.ts` | New file — main page |
| `frontend/src/app/features/followup-calendar/calendar-header.component.ts` | New file — header with nav controls |
| `frontend/src/app/features/followup-calendar/calendar-day-view.component.ts` | New file — day view |
| `frontend/src/app/features/followup-calendar/calendar-week-view.component.ts` | New file — week view |
| `frontend/src/app/features/followup-calendar/calendar-month-view.component.ts` | New file — month view |
| `frontend/src/app/features/followup-calendar/calendar-event.component.ts` | New file — event card |
| `frontend/src/app/features/followup-calendar/event-action-panel.component.ts` | New file — action dialog |
| `frontend/src/app/features/followup-calendar/calendar-date.utils.ts` | New file — date utility functions |
| `frontend/src/app/app.routes.ts` | Add `/doctor/followups` route |
| `frontend/src/app/shared/components/sidebar/sidebar.component.ts` | Add Follow-ups nav item |
