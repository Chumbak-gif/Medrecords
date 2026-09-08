import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Followup } from '../../core/services/followup.service';
import { CalendarEventComponent } from './calendar-event.component';
import { formatDateKey } from './calendar-date.utils';

@Component({
  selector: 'app-calendar-day-view',
  standalone: true,
  imports: [CommonModule, CalendarEventComponent],
  template: `
    <div class="day-view">
      <!-- Day Header -->
      <div class="day-header">
        <span class="day-name">{{ dayName }}</span>
        <span class="day-number" [class.today]="isToday">{{ currentDate.getDate() }}</span>
      </div>

      <!-- Time Grid -->
      <div class="time-grid">
        @for (hour of hours; track hour) {
          <div class="time-row" (click)="onSlotClick($event, hour)">
            <div class="time-gutter">
              <span class="time-label">{{ formatHour(hour) }}</span>
            </div>
            <div class="time-content" [class.has-events]="getFollowupsForHour(hour).length > 0">
              @for (followup of getFollowupsForHour(hour); track followup.id) {
                <app-calendar-event
                  [followup]="followup"
                  (clicked)="eventClicked.emit($event)">
                </app-calendar-event>
              }
            </div>
          </div>
        }
      </div>

      @if (dayFollowups.length === 0) {
        <div class="empty-hint">
          <p>Click on a time slot to schedule a follow-up</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .day-view {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      flex: 1;
    }

    .day-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-neutral-200);
      position: sticky;
      top: 0;
      background: var(--surface-card);
      z-index: 2;
    }

    .day-name {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 500;
    }

    .day-number {
      font-size: 24px;
      font-weight: 700;
      color: var(--color-neutral-800);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .day-number.today {
      background: #3b82f6;
      color: var(--color-neutral-0, #fff);
    }

    .time-grid {
      flex: 1;
    }

    .time-row {
      display: flex;
      min-height: 56px;
      border-bottom: 1px solid var(--color-neutral-200);
      cursor: pointer;
      transition: background 150ms;
    }

    .time-row:hover {
      background: #f8fafc;
    }

    .time-gutter {
      width: 72px;
      flex-shrink: 0;
      border-right: 1px solid var(--color-neutral-200);
      position: relative;
    }

    .time-label {
      position: absolute;
      top: -8px;
      right: 10px;
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
    }

    .time-content {
      flex: 1;
      padding: 4px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .time-content.has-events {
      background: #fafbfc;
    }

    .empty-hint {
      text-align: center;
      padding: 16px;
      color: #94a3b8;
      font-size: 13px;
    }
  `]
})
export class CalendarDayViewComponent {
  @Input({ required: true }) currentDate!: Date;
  @Input({ required: true }) groupedFollowups!: Map<string, Followup[]>;
  @Output() eventClicked = new EventEmitter<Followup>();
  @Output() dateClicked = new EventEmitter<Date>();

  private readonly dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Hours from 8 AM to 7 PM
  hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  get dayName(): string {
    return this.dayNames[this.currentDate.getDay()];
  }

  get isToday(): boolean {
    const today = new Date();
    return formatDateKey(this.currentDate) === formatDateKey(today);
  }

  get dayFollowups(): Followup[] {
    const key = formatDateKey(this.currentDate);
    return this.groupedFollowups.get(key) ?? [];
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  getFollowupsForHour(hour: number): Followup[] {
    return this.dayFollowups.filter(fu => {
      const h = this.extractHour(fu);
      return h === hour;
    });
  }

  private extractHour(fu: Followup): number {
    if (fu.notes) {
      const match = fu.notes.match(/^\[(\d{1,2}):(\d{2})\s*(AM|PM)?\]/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const period = match[3]?.toUpperCase();
        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h;
      }
      const match24 = fu.notes.match(/^\[(\d{2}):(\d{2})\]/);
      if (match24) {
        return parseInt(match24[1], 10);
      }
    }
    return 9;
  }

  onSlotClick(event: MouseEvent, hour: number): void {
    const target = event.target as HTMLElement;
    if (target.closest('.calendar-event')) return;
    this.dateClicked.emit(this.currentDate);
  }
}
