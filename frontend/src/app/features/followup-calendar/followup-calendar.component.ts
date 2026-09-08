import {
  Component, OnInit, OnDestroy, inject, signal, computed, effect, Injector
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

import { FollowupService, Followup } from '../../core/services/followup.service';
import { CalendarHeaderComponent } from './calendar-header.component';
import { CalendarDayViewComponent } from './calendar-day-view.component';
import { CalendarWeekViewComponent } from './calendar-week-view.component';
import { CalendarMonthViewComponent } from './calendar-month-view.component';
import { EventActionPanelComponent } from './event-action-panel.component';
import { ScheduleDialogComponent } from './schedule-dialog.component';
import {
  ViewMode, getDateRange, navigateDate, formatDateRangeLabel,
  groupFollowupsByDate, formatDateKey
} from './calendar-date.utils';

@Component({
  selector: 'app-followup-calendar',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    ToastModule,
    SkeletonModule,
    CalendarHeaderComponent,
    CalendarDayViewComponent,
    CalendarWeekViewComponent,
    CalendarMonthViewComponent,
    EventActionPanelComponent,
    ScheduleDialogComponent,
  ],
  template: `
<p-toast position="top-right" />

<div class="calendar-page">
  <div class="calendar-card">
    <!-- Header -->
    <app-calendar-header
      [viewMode]="viewMode()"
      [dateRangeLabel]="dateRangeLabel()"
      (viewModeChange)="onViewModeChange($event)"
      (navigate)="onNavigate($event)"
      (today)="onToday()"
      (schedule)="onScheduleClick()">
    </app-calendar-header>

    <!-- Loading Skeleton -->
    @if (loading()) {
      <div class="skeleton-container">
        <div class="skeleton-grid">
          @for (i of [1,2,3,4,5,6,7]; track i) {
            <div class="skeleton-col">
              <p-skeleton height="24px" width="100%" styleClass="mb-2" />
              <p-skeleton height="40px" width="100%" styleClass="mb-1" />
              <p-skeleton height="40px" width="100%" styleClass="mb-1" />
              <p-skeleton height="40px" width="80%" />
            </div>
          }
        </div>
      </div>
    } @else {
      <!-- View Content -->
      @switch (viewMode()) {
        @case ('day') {
          <app-calendar-day-view
            [currentDate]="currentDate()"
            [groupedFollowups]="groupedFollowups()"
            (eventClicked)="onEventClicked($event)"
            (dateClicked)="onDateClicked($event)">
          </app-calendar-day-view>
        }
        @case ('week') {
          <app-calendar-week-view
            [currentDate]="currentDate()"
            [groupedFollowups]="groupedFollowups()"
            (eventClicked)="onEventClicked($event)"
            (dateClicked)="onDateClicked($event)">
          </app-calendar-week-view>
        }
        @case ('month') {
          <app-calendar-month-view
            [currentDate]="currentDate()"
            [groupedFollowups]="groupedFollowups()"
            (eventClicked)="onEventClicked($event)"
            (dateClicked)="onDateClicked($event)">
          </app-calendar-month-view>
        }
      }
    }
  </div>

  <!-- Action Panel -->
  <app-event-action-panel
    [followup]="selectedFollowup()"
    [visible]="showActionPanel()"
    (visibleChange)="showActionPanel.set($event)"
    (actionCompleted)="onActionCompleted()">
  </app-event-action-panel>

  <!-- Schedule Dialog (click on date) -->
  <app-schedule-dialog
    [visible]="showScheduleDialog()"
    [preselectedDate]="scheduleDate()"
    (visibleChange)="showScheduleDialog.set($event)"
    (created)="onFollowupCreated()">
  </app-schedule-dialog>
</div>
  `,
  styles: [`
    .calendar-page {
      padding: 20px;
      height: 100%;
    }

    .calendar-card {
      background: var(--surface-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-neutral-200);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      min-height: calc(100vh - 120px);
      display: flex;
      flex-direction: column;
    }

    .skeleton-container {
      padding: 16px;
      flex: 1;
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
    }

    .skeleton-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `]
})
export class FollowupCalendarComponent implements OnInit, OnDestroy {
  private followupService = inject(FollowupService);
  private messageService = inject(MessageService);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();

  // ─── Signals ─────────────────────────────────────────────────────────────
  viewMode = signal<ViewMode>('week');
  currentDate = signal<Date>(new Date());
  followups = signal<Followup[]>([]);
  loading = signal(false);
  selectedFollowup = signal<Followup | null>(null);
  showActionPanel = signal(false);
  showScheduleDialog = signal(false);
  scheduleDate = signal<Date | null>(null);

  // ─── Computed ────────────────────────────────────────────────────────────
  dateRange = computed(() => getDateRange(this.viewMode(), this.currentDate()));
  groupedFollowups = computed(() => groupFollowupsByDate(this.followups()));
  dateRangeLabel = computed(() => formatDateRangeLabel(this.viewMode(), this.currentDate()));

  ngOnInit(): void {
    // Watch dateRange changes and fetch data
    effect(() => {
      const range = this.dateRange();
      if (range?.start && range?.end) {
        this.fetchFollowups(range.start, range.end);
      }
    }, { injector: this.injector, allowSignalWrites: true });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Event Handlers ──────────────────────────────────────────────────────

  onViewModeChange(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  onNavigate(direction: 1 | -1): void {
    const newDate = navigateDate(this.currentDate(), this.viewMode(), direction);
    this.currentDate.set(newDate);
  }

  onToday(): void {
    this.currentDate.set(new Date());
  }

  onEventClicked(followup: Followup): void {
    this.selectedFollowup.set(followup);
    this.showActionPanel.set(true);
  }

  onActionCompleted(): void {
    this.showActionPanel.set(false);
    // Re-fetch data to reflect changes
    const range = this.dateRange();
    this.fetchFollowups(range.start, range.end);
  }

  onDateClicked(date: Date): void {
    this.scheduleDate.set(date);
    this.showScheduleDialog.set(true);
  }

  onScheduleClick(): void {
    this.scheduleDate.set(new Date());
    this.showScheduleDialog.set(true);
  }

  onFollowupCreated(): void {
    this.showScheduleDialog.set(false);
    // Re-fetch data to reflect new follow-up
    const range = this.dateRange();
    this.fetchFollowups(range.start, range.end);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private fetchFollowups(start: Date, end: Date): void {
    this.loading.set(true);
    const params = {
      start_date: formatDateKey(start),
      end_date: formatDateKey(end),
    };

    this.followupService.getCalendar(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.followups.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load calendar data'
          });
        }
      });
  }
}
