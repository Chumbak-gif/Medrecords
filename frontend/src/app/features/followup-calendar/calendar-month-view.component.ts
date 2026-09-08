import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Followup } from '../../core/services/followup.service';
import { CalendarEventComponent } from './calendar-event.component';
import { getMonthGridDates, formatDateKey, getDaysOfWeek } from './calendar-date.utils';

@Component({
  selector: 'app-calendar-month-view',
  standalone: true,
  imports: [CommonModule, CalendarEventComponent],
  template: `
    <div class="month-view">
      <!-- Day Headers -->
      <div class="month-grid header-row">
        @for (day of dayHeaders; track day) {
          <div class="month-header-cell">{{ day }}</div>
        }
      </div>

      <!-- Date Cells -->
      <div class="month-grid date-cells">
        @for (date of gridDates; track $index) {
          <div class="month-cell"
               [class.outside-month]="!isCurrentMonth(date)"
               [class.today-cell]="isToday(date)"
               (click)="onCellClick($event, date)">
            <span class="cell-date" [class.today-badge]="isToday(date)">
              {{ date.getDate() }}
            </span>
            <div class="cell-events">
              @for (followup of getVisibleFollowups(date); track followup.id) {
                <app-calendar-event
                  [followup]="followup"
                  (clicked)="eventClicked.emit($event)">
                </app-calendar-event>
              }
              @if (getOverflowCount(date) > 0) {
                <span class="more-indicator">+{{ getOverflowCount(date) }} more</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .month-view {
      overflow-x: auto;
    }

    .month-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      min-width: 700px;
    }

    .header-row {
      border-bottom: 1px solid var(--color-neutral-200);
    }

    .month-header-cell {
      padding: 8px 4px;
      text-align: center;
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 500;
    }

    .date-cells {
      grid-auto-rows: minmax(100px, 1fr);
    }

    .month-cell {
      border-right: 1px solid var(--color-neutral-200);
      border-bottom: 1px solid var(--color-neutral-200);
      padding: 4px;
      display: flex;
      flex-direction: column;
      min-height: 120px;
      cursor: pointer;
      overflow: visible;
      position: relative;
    }

    .month-cell:nth-child(7n) {
      border-right: none;
    }

    .outside-month {
      opacity: 0.4;
      background: #fafafa;
    }

    .today-cell {
      background: var(--color-primary-50);
    }

    .cell-date {
      font-size: 12px;
      font-weight: 500;
      color: #475569;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      margin-bottom: 2px;
    }

    .today-badge {
      background: #3b82f6;
      color: var(--color-neutral-0, #fff);
      font-weight: 600;
    }

    .cell-events {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      overflow: visible;
    }

    .more-indicator {
      font-size: 11px;
      color: #3b82f6;
      font-weight: 500;
      cursor: pointer;
      padding: 2px 4px;
    }

    .more-indicator:hover {
      text-decoration: underline;
    }
  `]
})
export class CalendarMonthViewComponent {
  @Input({ required: true }) currentDate!: Date;
  @Input({ required: true }) groupedFollowups!: Map<string, Followup[]>;
  @Output() eventClicked = new EventEmitter<Followup>();
  @Output() dateClicked = new EventEmitter<Date>();

  private readonly MAX_VISIBLE = 3;

  dayHeaders = getDaysOfWeek();

  get gridDates(): Date[] {
    return getMonthGridDates(this.currentDate.getFullYear(), this.currentDate.getMonth());
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentDate.getMonth();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
  }

  getFollowupsForDate(date: Date): Followup[] {
    const key = formatDateKey(date);
    return this.groupedFollowups.get(key) ?? [];
  }

  getVisibleFollowups(date: Date): Followup[] {
    return this.getFollowupsForDate(date).slice(0, this.MAX_VISIBLE);
  }

  getOverflowCount(date: Date): number {
    const total = this.getFollowupsForDate(date).length;
    return total > this.MAX_VISIBLE ? total - this.MAX_VISIBLE : 0;
  }

  onCellClick(event: MouseEvent, date: Date): void {
    const target = event.target as HTMLElement;
    if (target.closest('.calendar-event') || target.closest('.more-indicator')) return;
    this.dateClicked.emit(date);
  }
}
