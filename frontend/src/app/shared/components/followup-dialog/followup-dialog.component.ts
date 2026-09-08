import {
  Component, Input, Output, EventEmitter, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

// Services & Models
import { FollowupService, Followup } from '../../../core/services/followup.service';

@Component({
  selector: 'app-followup-dialog',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    CalendarModule,
    InputTextareaModule,
    ButtonModule,
    ToastModule,
  ],
  template: `
    <p-toast />

    <p-dialog
      header="Schedule Follow-up"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '480px' }"
      [closable]="true"
      [draggable]="false"
      (onHide)="close()"
    >
      <div class="form-field-group">
        <label class="label">
          Follow-up Date <span style="color:var(--color-error)">*</span>
        </label>
        <p-calendar
          [inline]="false"
          [(ngModel)]="scheduledDate"
          [showIcon]="true"
          dateFormat="dd/mm/yy"
          placeholder="Select date"
          [minDate]="minDate"
          [maxDate]="maxDate"
          styleClass="w-full"
          [style]="{ width: '100%' }"
          (onSelect)="clearDateError()"
        />
        @if (dateError) {
          <span style="color:var(--color-error);font-size:12px">{{ dateError }}</span>
        }
      </div>

      <div class="form-field-group" style="margin-top:16px">
        <label class="label">Notes</label>
        <textarea
          pInputTextarea
          [(ngModel)]="notes"
          placeholder="Optional notes (max 500 characters)"
          rows="4"
          [maxlength]="500"
          style="width:100%"
        ></textarea>
        <span style="font-size:11px;color:var(--color-neutral-500);text-align:right">
          {{ notes.length }}/500
        </span>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
        <button type="button" class="btn-secondary" (click)="close()">Cancel</button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="saving()"
          (click)="submit()"
        >
          @if (saving()) { Saving... } @else { Schedule }
        </button>
      </div>
    </p-dialog>
  `,
  styles: [`
    .form-field-group { display: flex; flex-direction: column; gap: 6px; }
    :host ::ng-deep .p-calendar { width: 100%; }
    :host ::ng-deep .p-calendar .p-inputtext { width: 100%; }
  `]
})
export class FollowupDialogComponent {
  private followupService = inject(FollowupService);
  private messageService = inject(MessageService);

  @Input() visible = false;
  @Input() patientId!: number;
  @Input() assessmentId?: number;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() created = new EventEmitter<Followup>();

  scheduledDate: Date | null = null;
  notes = '';
  saving = signal(false);
  dateError: string | null = null;

  // Min date: tomorrow
  minDate = this.getTomorrow();
  // Max date: today + 365 days
  maxDate = this.getMaxDate();

  submit(): void {
    // Validate date
    if (!this.scheduledDate) {
      this.dateError = 'Follow-up date is required';
      return;
    }

    if (this.scheduledDate < this.minDate || this.scheduledDate > this.maxDate) {
      this.dateError = 'Date must be between tomorrow and 365 days from today';
      return;
    }

    this.dateError = null;
    this.saving.set(true);

    const payload = {
      patient_id: this.patientId,
      scheduled_date: this.formatDate(this.scheduledDate),
      ...(this.assessmentId != null && { assessment_id: this.assessmentId }),
      ...(this.notes.trim() && { notes: this.notes.trim() }),
    };

    this.followupService.create(payload).subscribe({
      next: (followup) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Follow-up scheduled successfully',
          life: 5000,
        });
        this.created.emit(followup);
        this.closeDialog();
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not save follow-up. Please try again.',
          life: 5000,
        });
        // Keep dialog open with data preserved
      },
    });
  }

  close(): void {
    this.resetForm();
    this.visibleChange.emit(false);
  }

  clearDateError(): void {
    this.dateError = null;
  }

  private closeDialog(): void {
    this.resetForm();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  private resetForm(): void {
    this.scheduledDate = null;
    this.notes = '';
    this.dateError = null;
    this.saving.set(false);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTomorrow(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d;
  }

  private getMaxDate(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 365);
    return d;
  }
}
