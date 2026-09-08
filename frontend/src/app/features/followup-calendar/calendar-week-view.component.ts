import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Followup } from '../../core/services/followup.service';
import { CalendarEventComponent } from './calendar-event.component';
import { getWeekStart, formatDateKey, getDaysOfWeek } from './calendar-date.utils';

@Component({
  selector: 'app-calendar-week-view',
  standalone: true,
  imports: [CommonModule, CalendarEventComponent],
  template: `
    <div class="week-view">
      <!-- Sticky Day Headers -->
      <div class="week-header">
        <div class="time-gutter-header"></div>
        <div class="day-headers">
          @for (day of weekDays; track $index) {
            <div class="day-column-header" [class.today-col]="isTodayIndex($index)">
              <span class="day-label">{{ day.name }}</span>
              <span class="day-num" [class.today]="isTodayIndex($index)">{{ day.date }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Time Grid (scrollable) -->
      <div class="week-body">
        <div class="time-grid">
          @for (hour of hours; track hour) {
            <div class="time-row">
              <!-- Time Gutter Label -->
              <div class="time-gutter">
                <span class="time-label">{{ formatHour(hour) }}</span>
              </div>
              <!-- Day Cells for this hour -->
              <div class="day-cells">
                @for (day of weekDays; track $index) {
                  <div class="time-cell"
                       [class.today-col-bg]="isTodayIndex($index)"
                       (click)="onCellClick($event, $index, hour)">
                    @for (followup of getFollowupsForDayAndHour($index, hour); track followup.id) {
                      <app-calendar-event
                        [followup]="followup"
                        (clicked)="eventClicked.emit($event)">
                      </app-calendar-event>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .week-view {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 1;
    }

    .week-header {
      display: flex;
      border-bottom: 1px solid var(--color-neutral-200);
      flex-shrink: 0;
      position: sticky;
      top: 0;
      background: var(--surface-card);
      z-index: 2;
    }

    .time-gutter-header {
      width: 60px;
      flex-shrink: 0;
      border-right: 1px solid var(--color-neutral-200);
    }

    .day-headers {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      flex: 1;
      min-width: 0;
    }

    .day-column-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 4px;
      border-right: 1px solid var(--color-neutral-200);
    }

    .day-column-header:last-child {
      border-right: none;
    }

    .day-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 500;
    }

    .day-num {
      font-size: 20px;
      font-weight: 600;
      color: var(--color-neutral-800);
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      margin-top: 2px;
    }

    .day-num.today {
      background: #3b82f6;
      color: var(--color-neutral-0, #fff);
    }

    .today-col .day-label {
      color: #3b82f6;
    }

    .week-body {
      overflow-y: auto;
      flex: 1;
    }

    .time-grid {
      position: relative;
    }

    .time-row {
      display: flex;
      min-height: 48px;
      border-bottom: 1px solid var(--color-neutral-200);
    }

    .time-gutter {
      width: 60px;
      flex-shrink: 0;
      border-right: 1px solid var(--color-neutral-200);
      position: relative;
    }

    .time-label {
      position: absolute;
      top: -8px;
      right: 8px;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 500;
    }

    .day-cells {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      flex: 1;
      min-width: 0;
    }

    .time-cell {
      border-right: 1px solid var(--color-neutral-200);
      padding: 2px 3px;
      min-height: 48px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: background 150ms;
    }

    .time-cell:last-child {
      border-right: none;
    }

    .time-cell:hover {
      background: var(--color-neutral-100);
    }

    .today-col-bg {
      background: var(--color-primary-50);
    }

    .today-col-bg:hover {
      background: var(--color-primary-100);
    }
  `]
})
export class CalendarWeekViewComponent {
  @Input({ required: true }) currentDate!: Date;
  @Input({ required: true }) groupedFollowups!: Map<string, Followup[]>;
  @Output() eventClicked = new EventEmitter<Followup>();
  @Output() dateClicked = new EventEmitter<Date>();

  private dayLabels = getDaysOfWeek();

  // Hours from 8 AM to 7 PM
  hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  get weekDays(): { name: string; date: number; fullDate: Date }[] {
    const start = getWeekStart(this.currentDate);
    return this.dayLabels.map((name, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { name, date: d.getDate(), fullDate: d };
    });
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  isTodayIndex(index: number): boolean {
    const today = new Date();
    const day = this.weekDays[index];
    return formatDateKey(day.fullDate) === formatDateKey(today);
  }

  getFollowupsForDayAndHour(index: number, hour: number): Followup[] {
    const day = this.weekDays[index];
    const key = formatDateKey(day.fullDate);
    const all = this.groupedFollowups.get(key) ?? [];

    // Place events in the hour based on their notes (e.g. "[10:00 AM] ...")
    // If no time info, place in 9 AM slot by default
    return all.filter(fu => {
      const slotHour = this.extractHour(fu);
      return slotHour === hour;
    });
  }

  private extractHour(fu: Followup): number {
    // Try to extract time from notes format: [HH:MM AM/PM] or [HH:MM]
    if (fu.notes) {
      const match = fu.notes.match(/^\[(\d{1,2}):(\d{2})\s*(AM|PM)?\]/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const period = match[3]?.toUpperCase();
        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h;
      }
      // Try 24h format [HH:MM]
      const match24 = fu.notes.match(/^\[(\d{2}):(\d{2})\]/);
      if (match24) {
        return parseInt(match24[1], 10);
      }
    }
    // Default: place at 9 AM
    return 9;
  }

  onCellClick(event: MouseEvent, dayIndex: number, hour: number): void {
    const target = event.target as HTMLElement;
    if (target.closest('.calendar-event')) return;
    this.dateClicked.emit(this.weekDays[dayIndex].fullDate);
  }
}
