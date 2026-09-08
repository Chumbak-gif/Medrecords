import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Followup } from '../../core/services/followup.service';

@Component({
  selector: 'app-calendar-event',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="calendar-event"
      [ngClass]="'event-' + followup.status"
      (click)="onClicked($event)"
      role="button"
      tabindex="0"
      (keydown.enter)="onClicked($event)"
      [attr.aria-label]="(followup.patient_name || 'Patient') + ' - ' + (followup.disease_name || 'Follow-up')">
      <span class="event-patient">{{ followup.patient_name || 'Patient' }}</span>
      @if (followup.patient_uid) {
        <span class="event-uid">{{ followup.patient_uid }}</span>
      }
      @if (followup.disease_name) {
        <span class="event-disease">{{ followup.disease_name }}</span>
      }
    </div>
  `,
  styles: [`
    .calendar-event {
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      line-height: 1.3;
      display: flex;
      flex-direction: column;
      gap: 1px;
      transition: box-shadow 150ms ease, transform 100ms ease;
      border-left: 3px solid transparent;
    }

    .calendar-event:hover {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }

    .event-pending {
      background: #dbeafe;
      border-left-color: #3b82f6;
    }

    .event-completed {
      background: #dcfce7;
      border-left-color: #10b981;
    }

    .event-cancelled {
      background: #f3f4f6;
      border-left-color: #9ca3af;
      text-decoration: line-through;
      opacity: 0.7;
    }

    .event-patient {
      font-weight: 600;
      color: var(--color-neutral-800);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .event-uid {
      font-size: 10px;
      color: #64748b;
      background: rgba(0, 0, 0, 0.05);
      padding: 0 4px;
      border-radius: 2px;
      display: inline-block;
      width: fit-content;
    }

    .event-disease {
      font-size: 11px;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class CalendarEventComponent {
  @Input({ required: true }) followup!: Followup;
  @Output() clicked = new EventEmitter<Followup>();

  onClicked(event: Event): void {
    event.stopPropagation();
    this.clicked.emit(this.followup);
  }
}
