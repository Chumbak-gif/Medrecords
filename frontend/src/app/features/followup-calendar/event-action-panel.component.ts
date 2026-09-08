import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Followup, FollowupService } from '../../core/services/followup.service';

@Component({
  selector: 'app-event-action-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, CalendarModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-dialog
      [header]="'Follow-up Details'"
      [visible]="visible"
      (visibleChange)="visibleChange.emit($event)"
      [modal]="true"
      [style]="{ width: '480px' }"
      [dismissableMask]="true"
      [draggable]="false">

      @if (followup) {
        <div class="panel-content">
          <!-- Patient Info -->
          <div class="info-section">
            <h3 class="patient-name">{{ followup.patient_name }}</h3>
            <span class="uid-badge">{{ followup.patient_uid }}</span>
          </div>

          <!-- Details -->
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Disease</span>
              <span class="detail-value">{{ followup.disease_name || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Scheduled Date</span>
              <span class="detail-value">{{ followup.scheduled_date }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Notes</span>
              <span class="detail-value">{{ followup.notes || 'No notes' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status</span>
              <span class="status-badge" [ngClass]="'status-' + followup.status">
                {{ followup.status }}
              </span>
            </div>
          </div>

          <!-- Actions (only for pending) -->
          @if (followup.status === 'pending') {
            <div class="action-section">
              <div class="action-buttons">
                <button pButton
                  label="Mark Complete"
                  icon="pi pi-check"
                  class="p-button-success p-button-sm"
                  [loading]="actionLoading()"
                  (click)="markComplete()">
                </button>
                <button pButton
                  label="Cancel"
                  icon="pi pi-times"
                  class="p-button-outlined p-button-danger p-button-sm"
                  [loading]="actionLoading()"
                  (click)="cancelFollowup()">
                </button>
              </div>

              <!-- Reschedule Section -->
              <div class="reschedule-section">
                <label class="reschedule-label">Reschedule to:</label>
                <div class="reschedule-controls">
                  <p-calendar
                    [(ngModel)]="rescheduleDate"
                    [minDate]="minDate"
                    dateFormat="yy-mm-dd"
                    placeholder="Select new date"
                    [showIcon]="true"
                    [style]="{ width: '100%' }">
                  </p-calendar>
                  <button pButton
                    label="Confirm"
                    icon="pi pi-calendar"
                    class="p-button-outlined p-button-sm"
                    [disabled]="!rescheduleDate"
                    [loading]="actionLoading()"
                    (click)="reschedule()">
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    .panel-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .info-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .patient-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--color-neutral-800);
      margin: 0;
    }

    .uid-badge {
      font-size: 11px;
      background: #e2e8f0;
      color: #475569;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }

    .detail-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .detail-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .detail-value {
      font-size: 13px;
      color: var(--color-neutral-800);
      font-weight: 500;
    }

    .status-badge {
      font-size: 11px;
      padding: 2px 10px;
      border-radius: 10px;
      font-weight: 600;
      text-transform: capitalize;
    }

    .status-pending {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .status-completed {
      background: #dcfce7;
      color: #15803d;
    }

    .status-cancelled {
      background: #f3f4f6;
      color: var(--color-neutral-500);
    }

    .action-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .reschedule-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .reschedule-label {
      font-size: 13px;
      font-weight: 500;
      color: #475569;
    }

    .reschedule-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .reschedule-controls p-calendar {
      flex: 1;
    }
  `]
})
export class EventActionPanelComponent {
  @Input() followup: Followup | null = null;
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() actionCompleted = new EventEmitter<void>();

  private followupService = inject(FollowupService);
  private messageService = inject(MessageService);

  actionLoading = signal(false);
  rescheduleDate: Date | null = null;
  minDate = new Date();

  markComplete(): void {
    if (!this.followup) return;
    this.actionLoading.set(true);
    this.followupService.update(this.followup.id, { status: 'completed' }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Done', detail: 'Follow-up marked as completed' });
        this.actionCompleted.emit();
        this.visibleChange.emit(false);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update follow-up' });
      }
    });
  }

  cancelFollowup(): void {
    if (!this.followup) return;
    this.actionLoading.set(true);
    this.followupService.update(this.followup.id, { status: 'cancelled' }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Done', detail: 'Follow-up cancelled' });
        this.actionCompleted.emit();
        this.visibleChange.emit(false);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to cancel follow-up' });
      }
    });
  }

  reschedule(): void {
    if (!this.followup || !this.rescheduleDate) return;
    this.actionLoading.set(true);
    const year = this.rescheduleDate.getFullYear();
    const month = String(this.rescheduleDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.rescheduleDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    this.followupService.update(this.followup.id, { scheduled_date: dateStr }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.rescheduleDate = null;
        this.messageService.add({ severity: 'success', summary: 'Done', detail: 'Follow-up rescheduled' });
        this.actionCompleted.emit();
        this.visibleChange.emit(false);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to reschedule follow-up' });
      }
    });
  }
}
