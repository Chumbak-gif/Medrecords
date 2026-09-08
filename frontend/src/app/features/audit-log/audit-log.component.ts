import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

// Core services
import { ExportService } from '../../core/services/export.service';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

export interface AuditLog {
  id: number;
  event_type: string;
  actor_username: string;
  actor_role: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface AuditFilters {
  event_type: string | null;
  actor_username: string;
  from_date: Date | null;
  to_date: Date | null;
}

const EVENT_TYPE_OPTIONS = [
  { label: 'All Events', value: null },
  { label: 'Login',      value: 'login' },
  { label: 'Logout',     value: 'logout' },
  { label: 'Create',     value: 'create' },
  { label: 'Update',     value: 'update' },
  { label: 'Delete',     value: 'delete' },
  { label: 'Export',     value: 'export' },
];

/** Map event_type â†’ PrimeNG severity for the tag badge */
function eventSeverity(eventType: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
  switch (eventType?.toLowerCase()) {
    case 'login':   return 'success';
    case 'logout':  return 'secondary';
    case 'create':  return 'info';
    case 'update':  return 'warning';
    case 'delete':  return 'danger';
    case 'export':  return 'info';
    default:        return 'secondary';
  }
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    PaginatorModule,
    ToastModule,
    TooltipModule,
    TagModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">Audit Log</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Read-only system activity log â€” all user actions are recorded here
        </p>
      </div>
      <button
        class="btn-primary"
        (click)="exportExcel()"
        [disabled]="exporting()"
        pTooltip="Export current filter results to Excel"
        tooltipPosition="left"
      >
        <i class="pi" [ngClass]="exporting() ? 'pi-spin pi-spinner' : 'pi-file-excel'"></i>
        {{ exporting() ? 'Exportingâ€¦' : 'Export Excel' }}
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="card" style="margin-bottom:16px;padding:16px">
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">

        <!-- Event Type -->
        <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
          <label style="font-size:12px;font-weight:600;color:var(--color-neutral-600)">Event Type</label>
          <p-dropdown
            [options]="eventTypeOptions"
            [(ngModel)]="filters.event_type"
            optionLabel="label"
            optionValue="value"
            placeholder="All Events"
            (onChange)="onFilterChange()"
            styleClass="w-full"
          />
        </div>

        <!-- Actor Username -->
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;max-width:320px">
          <label style="font-size:12px;font-weight:600;color:var(--color-neutral-600)">Actor Username</label>
          <span style="position:relative">
            <i class="pi pi-user" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-neutral-500);z-index:1"></i>
            <input
              pInputText
              type="text"
              placeholder="Search by usernameâ€¦"
              [(ngModel)]="filters.actor_username"
              (ngModelChange)="onActorUsernameChange($event)"
              style="padding-left:36px;width:100%"
            />
          </span>
        </div>

        <!-- From Date -->
        <div style="display:flex;flex-direction:column;gap:4px;min-width:160px">
          <label style="font-size:12px;font-weight:600;color:var(--color-neutral-600)">From Date</label>
          <p-calendar [inline]="false"
            [(ngModel)]="filters.from_date"
            (onSelect)="onFilterChange()"
            (onClearClick)="onFilterChange()"
            [showButtonBar]="true"
            dateFormat="dd/mm/yy"
            [maxDate]="filters.to_date ?? today"
            placeholder="dd/mm/yyyy"
            appendTo="body"
            styleClass="w-full"
          />
        </div>

        <!-- To Date -->
        <div style="display:flex;flex-direction:column;gap:4px;min-width:160px">
          <label style="font-size:12px;font-weight:600;color:var(--color-neutral-600)">To Date</label>
          <p-calendar [inline]="false"
            [(ngModel)]="filters.to_date"
            (onSelect)="onFilterChange()"
            (onClearClick)="onFilterChange()"
            [showButtonBar]="true"
            dateFormat="dd/mm/yy"
            [minDate]="filters.from_date ?? undefined"
            [maxDate]="today"
            placeholder="dd/mm/yyyy"
            appendTo="body"
            styleClass="w-full"
          />
        </div>

        <!-- Clear filters button -->
        <div style="display:flex;align-items:flex-end">
          <button
            class="btn-secondary"
            (click)="clearFilters()"
            pTooltip="Clear all filters"
            tooltipPosition="top"
          >
            <i class="pi pi-filter-slash"></i> Clear
          </button>
        </div>

        <!-- Record count -->
        <div style="display:flex;align-items:flex-end;margin-left:auto">
          <span style="font-size:13px;color:var(--color-neutral-500)">
            {{ totalRecords }} record(s)
          </span>
        </div>

      </div>
    </div>

    <!-- Table Card -->
    <div class="card">
      <p-table
        [value]="logs()"
        [loading]="loading()"
        dataKey="id"
        styleClass="p-datatable-sm"
        [rowHover]="true"
        [scrollable]="true"
        scrollHeight="600px"
        [virtualScroll]="true"
        [virtualScrollItemSize]="46"
      >
        <ng-template pTemplate="header">
          <tr>
            <th style="width:70px">ID</th>
            <th style="min-width:110px">Event Type</th>
            <th style="min-width:140px">Actor</th>
            <th style="min-width:100px">Role</th>
            <th style="min-width:120px">Entity Type</th>
            <th style="min-width:260px">Description</th>
            <th style="min-width:120px">IP Address</th>
            <th style="min-width:160px">Date / Time</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-log>
          <tr>
            <td>
              <span style="font-family:monospace;font-size:12px;color:var(--color-neutral-500)">#{{ log.id }}</span>
            </td>
            <td>
              <p-tag
                [value]="log.event_type | uppercase"
                [severity]="getEventSeverity(log.event_type)"
                styleClass="text-xs"
              />
            </td>
            <td>
              <span style="font-weight:600;font-family:monospace;font-size:13px">{{ log.actor_username }}</span>
            </td>
            <td>
              <span
                style="font-size:12px;padding:2px 8px;border-radius:4px;background:var(--color-neutral-100);color:var(--color-neutral-700)"
              >
                {{ log.actor_role }}
              </span>
            </td>
            <td>
              @if (log.entity_type) {
                <span style="color:var(--color-neutral-700)">
                  {{ log.entity_type }}
                  @if (log.entity_id != null) {
                    <span style="color:var(--color-neutral-400);font-size:12px"> #{{ log.entity_id }}</span>
                  }
                </span>
              } @else {
                <span style="color:var(--color-neutral-300)">â€”</span>
              }
            </td>
            <td>
              <span
                style="color:var(--color-neutral-600);font-size:13px"
                [title]="log.description ?? ''"
              >
                {{ log.description || 'â€”' }}
              </span>
            </td>
            <td>
              <span style="font-family:monospace;font-size:12px;color:var(--color-neutral-600)">
                {{ log.ip_address || 'â€”' }}
              </span>
            </td>
            <td>
              <span style="font-size:13px;color:var(--color-neutral-700)">
                {{ formatDateTime(log.created_at) }}
              </span>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="8" style="text-align:center;padding:48px;color:var(--color-neutral-400)">
              <i class="pi pi-list" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.4"></i>
              No audit log entries found for the selected filters.
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="loadingbody">
          @for (row of skeletonRows; track $index) {
            <tr>
              @for (col of [1,2,3,4,5,6,7,8]; track $index) {
                <td><div style="height:14px;border-radius:4px;background:var(--color-neutral-100);animation:pulse 1.5s infinite"></div></td>
              }
            </tr>
          }
        </ng-template>
      </p-table>

      <!-- Paginator -->
      <p-paginator
        [rows]="pageSize"
        [totalRecords]="totalRecords"
        [first]="(currentPage - 1) * pageSize"
        (onPageChange)="onPageChange($event)"
        [rowsPerPageOptions]="[20, 50, 100]"
        styleClass="mt-3"
      />
    </div>
  `,
  styles: [`
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; vertical-align: middle; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; background: var(--color-neutral-50, #f9fafb); }
    :host ::ng-deep .p-datatable-scrollable .p-datatable-thead > tr > th { background: var(--color-neutral-50, #f9fafb); }
    :host ::ng-deep .p-dropdown { width: 100%; }
    :host ::ng-deep .p-calendar { width: 100%; }
    :host ::ng-deep .p-calendar .p-inputtext { width: 100%; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `],
})
export class AuditLogComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private exportService = inject(ExportService);
  private messageService = inject(MessageService);

  private destroy$ = new Subject<void>();
  private actorSearchSubject = new Subject<string>();

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  logs = signal<AuditLog[]>([]);
  loading = signal(false);
  exporting = signal(false);

  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  today = new Date();

  // Skeleton rows for loading state
  skeletonRows = Array(10).fill(null);

  // â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  filters: AuditFilters = {
    event_type: null,
    actor_username: '',
    from_date: null,
    to_date: null,
  };

  eventTypeOptions = EVENT_TYPE_OPTIONS;

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getEventSeverity = eventSeverity;

  formatDateTime(dateStr: string): string {
    if (!dateStr) return 'â€”';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch {
      return dateStr;
    }
  }

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ngOnInit(): void {
    // Debounce actor username text input
    this.actorSearchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadLogs();
    });

    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // â”€â”€ Filter handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  onFilterChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  onActorUsernameChange(value: string): void {
    this.actorSearchSubject.next(value);
  }

  clearFilters(): void {
    this.filters = {
      event_type: null,
      actor_username: '',
      from_date: null,
      to_date: null,
    };
    this.currentPage = 1;
    this.loadLogs();
  }

  // â”€â”€ Pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  onPageChange(event: { page?: number; rows?: number }): void {
    this.currentPage = (event.page ?? 0) + 1;
    this.pageSize = event.rows ?? this.pageSize;
    this.loadLogs();
  }

  // â”€â”€ Data loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  loadLogs(): void {
    this.loading.set(true);

    let params = new HttpParams()
      .set('page', this.currentPage)
      .set('page_size', this.pageSize);

    if (this.filters.event_type) {
      params = params.set('event_type', this.filters.event_type);
    }
    if (this.filters.actor_username.trim()) {
      params = params.set('actor_username', this.filters.actor_username.trim());
    }
    if (this.filters.from_date) {
      params = params.set('from_date', this.toISODate(this.filters.from_date));
    }
    if (this.filters.to_date) {
      params = params.set('to_date', this.toISODate(this.filters.to_date));
    }

    this.http
      .get<PaginatedResponse<AuditLog>>(`${API}/api/v1/audit/`, { params })
      .subscribe({
        next: (res) => {
          this.logs.set(res.items);
          this.totalRecords = res.total;
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load audit log entries',
          });
          this.loading.set(false);
        },
      });
  }

  // â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await this.exportService.exportAuditLog({
        event_type: this.filters.event_type ?? undefined,
        start_date: this.filters.from_date ? this.toISODate(this.filters.from_date) : undefined,
        end_date: this.filters.to_date ? this.toISODate(this.filters.to_date) : undefined,
      });
      this.messageService.add({
        severity: 'success',
        summary: 'Exported',
        detail: 'Audit log exported successfully',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      this.messageService.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: message,
      });
    } finally {
      this.exporting.set(false);
    }
  }

  // â”€â”€ Private helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
