/**
 * Follow-up Calendar Page.
 * React replica of Angular FollowupCalendarComponent (+ header, day/week/month
 * views, calendar event, event action panel, and schedule dialog).
 * Only the tech stack changes (Angular -> React); UI/behaviour is preserved.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';
import {
  type Followup,
  type ViewMode,
  formatDateKey,
  getDaysOfWeek,
  getWeekStart,
  getDateRange,
  navigateDate,
  formatDateRangeLabel,
  groupFollowupsByDate,
  getMonthGridDates,
  extractHour,
  formatHour,
  toDateString,
} from '../calendarUtils';

const apiClient = createTypedApiClient();

// Hours from 8 AM to 7 PM (matches Angular day/week views)
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface PatientOption {
  id: number;
  name: string;
  patient_uid: string;
}

interface DiseaseOption {
  id: number;
  name: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════════

export function FollowupsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const [selectedFollowup, setSelectedFollowup] = useState<Followup | null>(null);
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);

  const showToast = useCallback((type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const dateRange = useMemo(() => getDateRange(viewMode, currentDate), [viewMode, currentDate]);
  const groupedFollowups = useMemo(() => groupFollowupsByDate(followups), [followups]);
  const dateRangeLabel = useMemo(() => formatDateRangeLabel(viewMode, currentDate), [viewMode, currentDate]);

  const fetchFollowups = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const res = await apiClient.get<Followup[]>('/followups/calendar', {
        params: {
          start_date: formatDateKey(start),
          end_date: formatDateKey(end),
        },
      });
      setFollowups(res.data);
    } catch {
      showToast('error', 'Failed to load calendar data');
    }
    setLoading(false);
  }, [showToast]);

  // Watch dateRange changes and fetch data (mirrors Angular effect on dateRange)
  useEffect(() => {
    if (dateRange?.start && dateRange?.end) {
      fetchFollowups(dateRange.start, dateRange.end);
    }
  }, [dateRange, fetchFollowups]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function onNavigate(direction: 1 | -1) {
    setCurrentDate((d) => navigateDate(d, viewMode, direction));
  }

  function onToday() {
    setCurrentDate(new Date());
  }

  function onEventClicked(followup: Followup) {
    setSelectedFollowup(followup);
    setShowActionPanel(true);
  }

  function onActionCompleted() {
    setShowActionPanel(false);
    fetchFollowups(dateRange.start, dateRange.end);
  }

  function onDateClicked(date: Date) {
    setScheduleDate(date);
    setShowScheduleDialog(true);
  }

  function onScheduleClick() {
    setScheduleDate(new Date());
    setShowScheduleDialog(true);
  }

  function onFollowupCreated() {
    setShowScheduleDialog(false);
    fetchFollowups(dateRange.start, dateRange.end);
  }

  return (
    <div style={{ padding: 20, height: '100%' }}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div style={styles.calendarCard}>
        <CalendarHeader
          viewMode={viewMode}
          dateRangeLabel={dateRangeLabel}
          onViewModeChange={setViewMode}
          onNavigate={onNavigate}
          onToday={onToday}
          onSchedule={onScheduleClick}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-neutral-400)', flex: 1 }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '1.75rem' }} />
            <p style={{ marginTop: 10, fontSize: 13 }}>Loading calendar…</p>
          </div>
        ) : viewMode === 'day' ? (
          <CalendarDayView
            currentDate={currentDate}
            groupedFollowups={groupedFollowups}
            onEventClicked={onEventClicked}
            onDateClicked={onDateClicked}
          />
        ) : viewMode === 'week' ? (
          <CalendarWeekView
            currentDate={currentDate}
            groupedFollowups={groupedFollowups}
            onEventClicked={onEventClicked}
            onDateClicked={onDateClicked}
          />
        ) : (
          <CalendarMonthView
            currentDate={currentDate}
            groupedFollowups={groupedFollowups}
            onEventClicked={onEventClicked}
            onDateClicked={onDateClicked}
          />
        )}
      </div>

      {/* Action Panel */}
      {showActionPanel && selectedFollowup && (
        <EventActionPanel
          followup={selectedFollowup}
          onClose={() => setShowActionPanel(false)}
          onActionCompleted={onActionCompleted}
          showToast={showToast}
        />
      )}

      {/* Schedule Dialog */}
      {showScheduleDialog && (
        <ScheduleDialog
          preselectedDate={scheduleDate}
          onClose={() => setShowScheduleDialog(false)}
          onCreated={onFollowupCreated}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Calendar Header
// ════════════════════════════════════════════════════════════════════════════

interface CalendarHeaderProps {
  viewMode: ViewMode;
  dateRangeLabel: string;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (direction: 1 | -1) => void;
  onToday: () => void;
  onSchedule: () => void;
}

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

function CalendarHeader({
  viewMode,
  dateRangeLabel,
  onViewModeChange,
  onNavigate,
  onToday,
  onSchedule,
}: CalendarHeaderProps) {
  return (
    <div style={styles.header}>
      {/* Left: Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-secondary btn-sm" onClick={onToday}>Today</button>

        <button className="btn-icon" onClick={() => onNavigate(-1)} aria-label="Previous">
          <i className="pi pi-chevron-left" />
        </button>

        <button className="btn-icon" onClick={() => onNavigate(1)} aria-label="Next">
          <i className="pi pi-chevron-right" />
        </button>

        <span style={styles.dateLabel}>{dateRangeLabel}</span>
      </div>

      {/* Right: Schedule button + View mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-primary btn-sm" onClick={onSchedule}>
          <i className="pi pi-plus" /> Schedule Follow-up
        </button>

        <div style={styles.viewToggle}>
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`view-toggle-btn${viewMode === opt.value ? ' active' : ''}`}
              style={{
                ...styles.viewToggleBtn,
                ...(viewMode === opt.value ? styles.viewToggleBtnActive : {}),
              }}
              onClick={() => onViewModeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Calendar Event
// ════════════════════════════════════════════════════════════════════════════

interface CalendarEventProps {
  followup: Followup;
  onClicked: (followup: Followup) => void;
}

const EVENT_BG: Record<Followup['status'], React.CSSProperties> = {
  pending: { background: '#dbeafe', borderLeftColor: '#3b82f6' },
  completed: { background: '#dcfce7', borderLeftColor: '#10b981' },
  cancelled: { background: '#f3f4f6', borderLeftColor: '#9ca3af', textDecoration: 'line-through', opacity: 0.7 },
};

function CalendarEvent({ followup, onClicked }: CalendarEventProps) {
  function handleClick(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    onClicked(followup);
  }

  return (
    <div
      className="calendar-event"
      style={{ ...styles.event, ...EVENT_BG[followup.status] }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(e); }}
      aria-label={`${followup.patient_name || 'Patient'} - ${followup.disease_name || 'Follow-up'}`}
    >
      <span style={styles.eventPatient}>{followup.patient_name || 'Patient'}</span>
      {followup.patient_uid && <span style={styles.eventUid}>{followup.patient_uid}</span>}
      {followup.disease_name && <span style={styles.eventDisease}>{followup.disease_name}</span>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Month View
// ════════════════════════════════════════════════════════════════════════════

interface ViewProps {
  currentDate: Date;
  groupedFollowups: Map<string, Followup[]>;
  onEventClicked: (followup: Followup) => void;
  onDateClicked: (date: Date) => void;
}

const MAX_VISIBLE = 3;

function CalendarMonthView({ currentDate, groupedFollowups, onEventClicked, onDateClicked }: ViewProps) {
  const dayHeaders = getDaysOfWeek();
  const gridDates = getMonthGridDates(currentDate.getFullYear(), currentDate.getMonth());

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();
  const isToday = (date: Date) => formatDateKey(date) === formatDateKey(new Date());

  const getFollowupsForDate = (date: Date) => groupedFollowups.get(formatDateKey(date)) ?? [];
  const getVisibleFollowups = (date: Date) => getFollowupsForDate(date).slice(0, MAX_VISIBLE);
  const getOverflowCount = (date: Date) => {
    const total = getFollowupsForDate(date).length;
    return total > MAX_VISIBLE ? total - MAX_VISIBLE : 0;
  };

  function onCellClick(event: React.MouseEvent, date: Date) {
    const target = event.target as HTMLElement;
    if (target.closest('.calendar-event') || target.closest('.more-indicator')) return;
    onDateClicked(date);
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Day Headers */}
      <div style={{ ...styles.monthGrid, borderBottom: '1px solid var(--color-neutral-200)' }}>
        {dayHeaders.map((day) => (
          <div key={day} style={styles.monthHeaderCell}>{day}</div>
        ))}
      </div>

      {/* Date Cells */}
      <div style={{ ...styles.monthGrid, gridAutoRows: 'minmax(100px, 1fr)' }}>
        {gridDates.map((date, index) => {
          const outside = !isCurrentMonth(date);
          const today = isToday(date);
          const overflow = getOverflowCount(date);
          return (
            <div
              key={index}
              style={{
                ...styles.monthCell,
                ...(outside ? styles.outsideMonth : {}),
                ...(today ? styles.todayCell : {}),
                ...((index + 1) % 7 === 0 ? { borderRight: 'none' } : {}),
              }}
              onClick={(e) => onCellClick(e, date)}
            >
              <span style={{ ...styles.cellDate, ...(today ? styles.todayBadge : {}) }}>
                {date.getDate()}
              </span>
              <div style={styles.cellEvents}>
                {getVisibleFollowups(date).map((fu) => (
                  <CalendarEvent key={fu.id} followup={fu} onClicked={onEventClicked} />
                ))}
                {overflow > 0 && (
                  <span className="more-indicator" style={styles.moreIndicator}>+{overflow} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Week View
// ════════════════════════════════════════════════════════════════════════════

function CalendarWeekView({ currentDate, groupedFollowups, onEventClicked, onDateClicked }: ViewProps) {
  const dayLabels = getDaysOfWeek();

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return dayLabels.map((name, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { name, date: d.getDate(), fullDate: d };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const isTodayIndex = (index: number) =>
    formatDateKey(weekDays[index].fullDate) === formatDateKey(new Date());

  const getFollowupsForDayAndHour = (index: number, hour: number): Followup[] => {
    const key = formatDateKey(weekDays[index].fullDate);
    const all = groupedFollowups.get(key) ?? [];
    return all.filter((fu) => extractHour(fu) === hour);
  };

  function onCellClick(event: React.MouseEvent, dayIndex: number) {
    const target = event.target as HTMLElement;
    if (target.closest('.calendar-event')) return;
    onDateClicked(weekDays[dayIndex].fullDate);
  }

  return (
    <div style={styles.weekView}>
      {/* Sticky Day Headers */}
      <div style={styles.weekHeader}>
        <div style={styles.timeGutterHeader} />
        <div style={styles.dayHeaders}>
          {weekDays.map((day, index) => {
            const today = isTodayIndex(index);
            return (
              <div
                key={index}
                style={{
                  ...styles.dayColumnHeader,
                  ...(index === weekDays.length - 1 ? { borderRight: 'none' } : {}),
                }}
              >
                <span style={{ ...styles.dayLabel, ...(today ? { color: '#3b82f6' } : {}) }}>{day.name}</span>
                <span style={{ ...styles.dayNum, ...(today ? styles.dayNumToday : {}) }}>{day.date}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Grid (scrollable) */}
      <div style={styles.weekBody}>
        <div>
          {HOURS.map((hour) => (
            <div key={hour} style={styles.timeRow}>
              <div style={styles.timeGutter}>
                <span style={styles.timeLabel}>{formatHour(hour)}</span>
              </div>
              <div style={styles.dayCells}>
                {weekDays.map((_, index) => {
                  const today = isTodayIndex(index);
                  return (
                    <div
                      key={index}
                      style={{
                        ...styles.timeCell,
                        ...(index === weekDays.length - 1 ? { borderRight: 'none' } : {}),
                        ...(today ? styles.todayColBg : {}),
                      }}
                      onClick={(e) => onCellClick(e, index)}
                    >
                      {getFollowupsForDayAndHour(index, hour).map((fu) => (
                        <CalendarEvent key={fu.id} followup={fu} onClicked={onEventClicked} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Day View
// ════════════════════════════════════════════════════════════════════════════

function CalendarDayView({ currentDate, groupedFollowups, onEventClicked, onDateClicked }: ViewProps) {
  const dayName = DAY_NAMES[currentDate.getDay()];
  const isToday = formatDateKey(currentDate) === formatDateKey(new Date());
  const dayFollowups = groupedFollowups.get(formatDateKey(currentDate)) ?? [];

  const getFollowupsForHour = (hour: number) =>
    dayFollowups.filter((fu) => extractHour(fu) === hour);

  function onSlotClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.calendar-event')) return;
    onDateClicked(currentDate);
  }

  return (
    <div style={styles.dayView}>
      {/* Day Header */}
      <div style={styles.dayHeader}>
        <span style={styles.dayHeaderName}>{dayName}</span>
        <span style={{ ...styles.dayNumber, ...(isToday ? styles.dayNumberToday : {}) }}>
          {currentDate.getDate()}
        </span>
      </div>

      {/* Time Grid */}
      <div style={{ flex: 1 }}>
        {HOURS.map((hour) => {
          const events = getFollowupsForHour(hour);
          return (
            <div key={hour} style={styles.dayTimeRow} onClick={onSlotClick}>
              <div style={styles.dayTimeGutter}>
                <span style={styles.dayTimeLabel}>{formatHour(hour)}</span>
              </div>
              <div style={{ ...styles.dayTimeContent, ...(events.length > 0 ? { background: '#fafbfc' } : {}) }}>
                {events.map((fu) => (
                  <CalendarEvent key={fu.id} followup={fu} onClicked={onEventClicked} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {dayFollowups.length === 0 && (
        <div style={styles.emptyHint}>
          <p>Click on a time slot to schedule a follow-up</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Event Action Panel (dialog)
// ════════════════════════════════════════════════════════════════════════════

interface EventActionPanelProps {
  followup: Followup;
  onClose: () => void;
  onActionCompleted: () => void;
  showToast: (type: string, message: string) => void;
}

const STATUS_BADGE: Record<Followup['status'], React.CSSProperties> = {
  pending: { background: '#dbeafe', color: '#1d4ed8' },
  completed: { background: '#dcfce7', color: '#15803d' },
  cancelled: { background: '#f3f4f6', color: 'var(--color-neutral-500)' },
};

function EventActionPanel({ followup, onClose, onActionCompleted, showToast }: EventActionPanelProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Min date = today (matches Angular minDate = new Date())
  const minDate = toDateString(new Date());

  async function updateFollowup(payload: Record<string, unknown>, successMsg: string, errorMsg: string) {
    setActionLoading(true);
    try {
      await apiClient.patch(`/followups/${followup.id}`, payload);
      showToast('success', successMsg);
      onActionCompleted();
      onClose();
    } catch {
      showToast('error', errorMsg);
    }
    setActionLoading(false);
  }

  function markComplete() {
    updateFollowup({ status: 'completed' }, 'Follow-up marked as completed', 'Failed to update follow-up');
  }

  function cancelFollowup() {
    updateFollowup({ status: 'cancelled' }, 'Follow-up cancelled', 'Failed to cancel follow-up');
  }

  function reschedule() {
    if (!rescheduleDate) return;
    updateFollowup({ scheduled_date: rescheduleDate }, 'Follow-up rescheduled', 'Failed to reschedule follow-up');
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Follow-up Details</h3>
          <button className="btn-icon" onClick={onClose}><i className="pi pi-times" /></button>
        </div>

        <div className="dialog-body">
          <div style={styles.panelContent}>
            {/* Patient Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={styles.patientName}>{followup.patient_name}</h3>
              <span style={styles.uidBadge}>{followup.patient_uid}</span>
            </div>

            {/* Details */}
            <div style={styles.detailGrid}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Disease</span>
                <span style={styles.detailValue}>{followup.disease_name || '—'}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Scheduled Date</span>
                <span style={styles.detailValue}>{followup.scheduled_date}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Notes</span>
                <span style={styles.detailValue}>{followup.notes || 'No notes'}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status</span>
                <span style={{ ...styles.statusBadge, ...STATUS_BADGE[followup.status] }}>
                  {followup.status}
                </span>
              </div>
            </div>

            {/* Actions (only for pending) */}
            {followup.status === 'pending' && (
              <div style={styles.actionSection}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary btn-sm" disabled={actionLoading} onClick={markComplete}>
                    <i className="pi pi-check" /> Mark Complete
                  </button>
                  <button className="btn-danger btn-sm" disabled={actionLoading} onClick={cancelFollowup}>
                    <i className="pi pi-times" /> Cancel
                  </button>
                </div>

                {/* Reschedule Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={styles.rescheduleLabel}>Reschedule to:</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="date"
                      className="form-control"
                      min={minDate}
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      placeholder="Select new date"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-secondary btn-sm"
                      disabled={!rescheduleDate || actionLoading}
                      onClick={reschedule}
                    >
                      <i className="pi pi-calendar" /> Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Schedule Dialog
// ════════════════════════════════════════════════════════════════════════════

interface ScheduleDialogProps {
  preselectedDate: Date | null;
  onClose: () => void;
  onCreated: () => void;
  showToast: (type: string, message: string) => void;
}

const TIME_SLOTS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '09:30 AM', value: '09:30' },
  { label: '10:00 AM', value: '10:00' },
  { label: '10:30 AM', value: '10:30' },
  { label: '11:00 AM', value: '11:00' },
  { label: '11:30 AM', value: '11:30' },
  { label: '12:00 PM', value: '12:00' },
  { label: '12:30 PM', value: '12:30' },
  { label: '01:00 PM', value: '13:00' },
  { label: '01:30 PM', value: '13:30' },
  { label: '02:00 PM', value: '14:00' },
  { label: '02:30 PM', value: '14:30' },
  { label: '03:00 PM', value: '15:00' },
  { label: '03:30 PM', value: '15:30' },
  { label: '04:00 PM', value: '16:00' },
  { label: '04:30 PM', value: '16:30' },
  { label: '05:00 PM', value: '17:00' },
  { label: '05:30 PM', value: '17:30' },
  { label: '06:00 PM', value: '18:00' },
];

function ScheduleDialog({ preselectedDate, onClose, onCreated, showToast }: ScheduleDialogProps) {
  // Min date = tomorrow (matches Angular: new Date() + 1 day)
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toDateString(d);
  }, []);

  const [formDate, setFormDate] = useState('');
  const [formTimeSlot, setFormTimeSlot] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<PatientOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<number | ''>('');
  const [diseaseOptions, setDiseaseOptions] = useState<DiseaseOption[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // On open: set preselected date + load diseases
  useEffect(() => {
    if (preselectedDate) {
      setFormDate(toDateString(preselectedDate));
    }
    (async () => {
      try {
        const res = await apiClient.get<{ items: DiseaseOption[]; total: number }>('/diseases/', {
          params: { page_size: 100, include_inactive: 'false' },
        });
        setDiseaseOptions(res.data.items.map((d) => ({ id: d.id, name: d.name })));
      } catch {
        setDiseaseOptions([]);
      }
    })();
  }, [preselectedDate]);

  function onPatientQueryChange(value: string) {
    setPatientQuery(value);
    setSelectedPatient(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const query = value.trim();
    if (!query || query.length < 2) {
      setPatientSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ items: Array<{ id: number; first_name: string; last_name: string; patient_uid: string }>; total: number }>(
          '/patients/',
          { params: { search: query, page: 1, page_size: 10 } },
        );
        setPatientSuggestions(
          res.data.items.map((p) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            patient_uid: p.patient_uid,
          })),
        );
        setShowSuggestions(true);
      } catch {
        setPatientSuggestions([]);
      }
    }, 300);
  }

  function selectPatient(patient: PatientOption) {
    setSelectedPatient(patient);
    setPatientQuery(patient.name);
    setShowSuggestions(false);
  }

  const isFormValid = () => !!formDate && !!selectedPatient;

  async function onSubmit() {
    if (!isFormValid() || !formDate || !selectedPatient) return;

    setSaving(true);

    // Build notes with time slot prefix if selected
    let notes = formNotes;
    if (formTimeSlot) {
      const slotLabel = TIME_SLOTS.find((s) => s.value === formTimeSlot)?.label ?? formTimeSlot;
      notes = `[${slotLabel}] ${notes}`.trim();
    }

    const payload: Record<string, unknown> = {
      patient_id: selectedPatient.id,
      scheduled_date: formDate,
      notes: notes || undefined,
    };

    try {
      await apiClient.post('/followups/', payload);
      showToast('success', `Follow-up scheduled for ${selectedPatient.name} on ${formDate}`);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Failed to schedule follow-up');
    }
    setSaving(false);
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Schedule Follow-up</h3>
          <button className="btn-icon" onClick={onClose}><i className="pi pi-times" /></button>
        </div>

        <div className="dialog-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
            {/* Date */}
            <div className="form-field-group">
              <label className="label">Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="date"
                className="form-control"
                min={minDate}
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Time Slot */}
            <div className="form-field-group">
              <label className="label">Time Slot</label>
              <div className="select-wrapper">
                <select
                  className="form-control"
                  value={formTimeSlot}
                  onChange={(e) => setFormTimeSlot(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select time slot</option>
                  {TIME_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <i className="pi pi-chevron-down select-arrow" />
              </div>
            </div>

            {/* Patient Search */}
            <div className="form-field-group" style={{ position: 'relative' }}>
              <label className="label">Patient <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Search patient by name or UID..."
                value={patientQuery}
                onChange={(e) => onPatientQueryChange(e.target.value)}
                onFocus={() => { if (patientSuggestions.length) setShowSuggestions(true); }}
                style={{ width: '100%' }}
                autoComplete="off"
              />
              {showSuggestions && patientSuggestions.length > 0 && (
                <div style={styles.suggestionPanel}>
                  {patientSuggestions.map((p) => (
                    <div
                      key={p.id}
                      style={styles.suggestionItem}
                      onClick={() => selectPatient(p)}
                    >
                      <span style={styles.patientOptionName}>{p.name}</span>
                      <span style={styles.patientOptionUid}>{p.patient_uid}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disease */}
            <div className="form-field-group">
              <label className="label">Disease</label>
              <div className="select-wrapper">
                <select
                  className="form-control"
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value ? Number(e.target.value) : '')}
                  style={{ width: '100%' }}
                >
                  <option value="">Select disease (optional)</option>
                  {diseaseOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <i className="pi pi-chevron-down select-arrow" />
              </div>
            </div>

            {/* Notes */}
            <div className="form-field-group">
              <label className="label">Notes</label>
              <textarea
                className="form-control"
                rows={3}
                maxLength={500}
                placeholder="Add notes for this follow-up..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <span style={styles.charCount}>{formNotes.length}/500</span>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!isFormValid() || saving} onClick={onSubmit}>
            <i className="pi pi-calendar-plus" /> {saving ? 'Scheduling...' : 'Schedule Follow-up'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Inline styles (ported from Angular component styles)
// ════════════════════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  // Page / card
  calendarCard: {
    background: 'var(--surface-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-neutral-200)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
    minHeight: 'calc(100vh - 120px)',
    display: 'flex',
    flexDirection: 'column',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    gap: 16,
    flexWrap: 'wrap',
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
    marginLeft: 8,
  },
  viewToggle: {
    display: 'flex',
    border: '1px solid var(--color-neutral-300)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  viewToggleBtn: {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    background: 'var(--surface-card)',
    color: 'var(--color-neutral-600)',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  viewToggleBtnActive: {
    background: '#3b82f6',
    color: '#fff',
    fontWeight: 600,
  },

  // Calendar event
  event: {
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1.3,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    transition: 'box-shadow 150ms ease, transform 100ms ease',
    borderLeft: '3px solid transparent',
  },
  eventPatient: {
    fontWeight: 600,
    color: 'var(--color-neutral-800)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  eventUid: {
    fontSize: 10,
    color: '#64748b',
    background: 'rgba(0, 0, 0, 0.05)',
    padding: '0 4px',
    borderRadius: 2,
    display: 'inline-block',
    width: 'fit-content',
  },
  eventDisease: {
    fontSize: 11,
    color: '#475569',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  // Month view
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    minWidth: 700,
  },
  monthHeaderCell: {
    padding: '8px 4px',
    textAlign: 'center',
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 500,
  },
  monthCell: {
    borderRight: '1px solid var(--color-neutral-200)',
    borderBottom: '1px solid var(--color-neutral-200)',
    padding: 4,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 120,
    cursor: 'pointer',
    position: 'relative',
  },
  outsideMonth: {
    opacity: 0.4,
    background: '#fafafa',
  },
  todayCell: {
    background: 'var(--color-primary-50)',
  },
  cellDate: {
    fontSize: 12,
    fontWeight: 500,
    color: '#475569',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    marginBottom: 2,
  },
  todayBadge: {
    background: '#3b82f6',
    color: '#fff',
    fontWeight: 600,
  },
  cellEvents: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  moreIndicator: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '2px 4px',
  },

  // Week view
  weekView: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1,
  },
  weekHeader: {
    display: 'flex',
    borderBottom: '1px solid var(--color-neutral-200)',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    background: 'var(--surface-card)',
    zIndex: 2,
  },
  timeGutterHeader: {
    width: 60,
    flexShrink: 0,
    borderRight: '1px solid var(--color-neutral-200)',
  },
  dayHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    flex: 1,
    minWidth: 0,
  },
  dayColumnHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 4px',
    borderRight: '1px solid var(--color-neutral-200)',
  },
  dayLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 500,
  },
  dayNum: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--color-neutral-800)',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    marginTop: 2,
  },
  dayNumToday: {
    background: '#3b82f6',
    color: '#fff',
  },
  weekBody: {
    overflowY: 'auto',
    flex: 1,
  },
  timeRow: {
    display: 'flex',
    minHeight: 48,
    borderBottom: '1px solid var(--color-neutral-200)',
  },
  timeGutter: {
    width: 60,
    flexShrink: 0,
    borderRight: '1px solid var(--color-neutral-200)',
    position: 'relative',
  },
  timeLabel: {
    position: 'absolute',
    top: -8,
    right: 8,
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 500,
  },
  dayCells: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    flex: 1,
    minWidth: 0,
  },
  timeCell: {
    borderRight: '1px solid var(--color-neutral-200)',
    padding: '2px 3px',
    minHeight: 48,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    transition: 'background 150ms',
  },
  todayColBg: {
    background: 'var(--color-primary-50)',
  },

  // Day view
  dayView: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flex: 1,
  },
  dayHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-neutral-200)',
    position: 'sticky',
    top: 0,
    background: 'var(--surface-card)',
    zIndex: 2,
  },
  dayHeaderName: {
    fontSize: 14,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  dayNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--color-neutral-800)',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
  },
  dayNumberToday: {
    background: '#3b82f6',
    color: '#fff',
  },
  dayTimeRow: {
    display: 'flex',
    minHeight: 56,
    borderBottom: '1px solid var(--color-neutral-200)',
    cursor: 'pointer',
    transition: 'background 150ms',
  },
  dayTimeGutter: {
    width: 72,
    flexShrink: 0,
    borderRight: '1px solid var(--color-neutral-200)',
    position: 'relative',
  },
  dayTimeLabel: {
    position: 'absolute',
    top: -8,
    right: 10,
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 500,
  },
  dayTimeContent: {
    flex: 1,
    padding: '4px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  emptyHint: {
    textAlign: 'center',
    padding: 16,
    color: '#94a3b8',
    fontSize: 13,
  },

  // Action panel
  panelContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-neutral-800)',
    margin: 0,
  },
  uidBadge: {
    fontSize: 11,
    background: '#e2e8f0',
    color: '#475569',
    padding: '2px 8px',
    borderRadius: 10,
    fontWeight: 500,
  },
  detailGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    background: '#f8fafc',
    borderRadius: 8,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 500,
  },
  detailValue: {
    fontSize: 13,
    color: 'var(--color-neutral-800)',
    fontWeight: 500,
  },
  statusBadge: {
    fontSize: 11,
    padding: '2px 10px',
    borderRadius: 10,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  actionSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    paddingTop: 8,
    borderTop: '1px solid #e5e7eb',
  },
  rescheduleLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: '#475569',
  },

  // Schedule dialog
  charCount: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'right',
  },
  suggestionPanel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'var(--surface-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    zIndex: 10000,
    maxHeight: 220,
    overflowY: 'auto',
    marginTop: 4,
  },
  suggestionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  patientOptionName: {
    fontWeight: 500,
    color: 'var(--color-neutral-800)',
  },
  patientOptionUid: {
    fontSize: 11,
    background: '#e2e8f0',
    color: '#475569',
    padding: '1px 6px',
    borderRadius: 8,
  },
};

export default FollowupsPage;
