import { Followup } from '../../core/services/followup.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ViewMode = 'day' | 'week' | 'month';

export interface DateRange {
  start: Date;
  end: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format a Date as yyyy-MM-dd string */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] */
export function getDaysOfWeek(): string[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/** Get the Monday of the week containing the given date */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // if Sunday, go back 6; else go back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get the Sunday of the week containing the given date */
export function getWeekEnd(date: Date): Date {
  const monday = getWeekStart(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/** Compute the visible date range for a given view mode and reference date */
export function getDateRange(viewMode: ViewMode, referenceDate: Date): DateRange {
  switch (viewMode) {
    case 'day': {
      const start = new Date(referenceDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(referenceDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'week': {
      return { start: getWeekStart(referenceDate), end: getWeekEnd(referenceDate) };
    }
    case 'month': {
      const year = referenceDate.getFullYear();
      const month = referenceDate.getMonth();
      // First day of month
      const firstOfMonth = new Date(year, month, 1);
      // Monday of the week containing the 1st
      const start = getWeekStart(firstOfMonth);
      // 6 weeks later (42 days) - end on Sunday
      const end = new Date(start);
      end.setDate(start.getDate() + 41);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }
}

/** Navigate forward/backward by one view unit */
export function navigateDate(referenceDate: Date, viewMode: ViewMode, direction: 1 | -1): Date {
  const d = new Date(referenceDate);
  switch (viewMode) {
    case 'day':
      d.setDate(d.getDate() + direction);
      break;
    case 'week':
      d.setDate(d.getDate() + 7 * direction);
      break;
    case 'month':
      d.setMonth(d.getMonth() + direction);
      break;
  }
  return d;
}

/** Format date range label based on view mode */
export function formatDateRangeLabel(viewMode: ViewMode, referenceDate: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortMonths = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  switch (viewMode) {
    case 'day': {
      const day = referenceDate.getDate();
      const month = months[referenceDate.getMonth()];
      const year = referenceDate.getFullYear();
      return `${day} ${month} ${year}`;
    }
    case 'week': {
      const start = getWeekStart(referenceDate);
      const end = getWeekEnd(referenceDate);
      const startDay = start.getDate();
      const endDay = end.getDate();
      const startMonth = shortMonths[start.getMonth()];
      const endMonth = shortMonths[end.getMonth()];
      const year = end.getFullYear();
      if (start.getMonth() === end.getMonth()) {
        return `${startDay} – ${endDay} ${startMonth} ${year}`;
      }
      return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`;
    }
    case 'month': {
      const month = months[referenceDate.getMonth()];
      const year = referenceDate.getFullYear();
      return `${month} ${year}`;
    }
  }
}

/** Group followups by their scheduled_date string key (yyyy-MM-dd) */
export function groupFollowupsByDate(followups: Followup[]): Map<string, Followup[]> {
  const map = new Map<string, Followup[]>();
  for (const fu of followups) {
    const key = fu.scheduled_date; // Already yyyy-MM-dd from backend
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(fu);
  }
  return map;
}

/** Generate array of 42 dates (6 weeks) for the month grid */
export function getMonthGridDates(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const start = getWeekStart(firstOfMonth);
  const dates: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}
