import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ViewMode } from './calendar-date.utils';

@Component({
  selector: 'app-calendar-header',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SelectButtonModule],
  template: `
    <div class="calendar-header">
      <!-- Left: Navigation -->
      <div class="header-left">
        <button pButton
          label="Today"
          class="p-button-outlined p-button-sm"
          (click)="today.emit()">
        </button>

        <button pButton
          icon="pi pi-chevron-left"
          class="p-button-text p-button-rounded p-button-sm"
          (click)="navigate.emit(-1)"
          aria-label="Previous">
        </button>

        <button pButton
          icon="pi pi-chevron-right"
          class="p-button-text p-button-rounded p-button-sm"
          (click)="navigate.emit(1)"
          aria-label="Next">
        </button>

        <span class="date-label">{{ dateRangeLabel }}</span>
      </div>

      <!-- Right: Schedule button + View mode toggle -->
      <div class="header-right">
        <button pButton
          label="Schedule Follow-up"
          icon="pi pi-plus"
          class="p-button-sm schedule-btn"
          (click)="schedule.emit()">
        </button>

        <p-selectButton
          [options]="viewOptions"
          [ngModel]="viewMode"
          (ngModelChange)="viewModeChange.emit($event)"
          optionLabel="label"
          optionValue="value"
          [style]="{ fontSize: '13px' }">
        </p-selectButton>
      </div>
    </div>
  `,
  styles: [`
    .calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      gap: 16px;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .schedule-btn {
      background: #3b82f6 !important;
      border-color: #3b82f6 !important;
    }

    .schedule-btn:hover {
      background: #2563eb !important;
      border-color: #2563eb !important;
    }

    .date-label {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-neutral-900);
      margin-left: 8px;
    }

    :host ::ng-deep .p-selectbutton .p-button {
      padding: 6px 14px;
      font-size: 13px;
    }
  `]
})
export class CalendarHeaderComponent {
  @Input({ required: true }) viewMode!: ViewMode;
  @Input({ required: true }) dateRangeLabel!: string;

  @Output() viewModeChange = new EventEmitter<ViewMode>();
  @Output() navigate = new EventEmitter<1 | -1>();
  @Output() today = new EventEmitter<void>();
  @Output() schedule = new EventEmitter<void>();

  viewOptions = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
  ];
}
