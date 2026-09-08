import {
  Component, OnInit, OnDestroy, inject, signal,
  AfterViewInit, ElementRef, ViewChild, ViewChildren, QueryList,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';

const API = `${environment.apiBaseUrl}/api/v1`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface NumericStatRow {
  title: string;
  mean: number;
  median: number;
  range_min: number;
  range_max: number;
}

interface CategoryCount {
  label: string;
  count: number;
}

interface CategoricalStatRow {
  field: string;
  categories: CategoryCount[];
}

interface PatientStatistics {
  numeric_stats: NumericStatRow[];
  categorical_stats: CategoricalStatRow[];
}

interface DiseaseOption {
  id: number;
  name: string;
}

interface PagedResponse<T> {
  items: T[];
  total: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-statistics',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    DropdownModule,
    SkeletonModule,
    ToastModule,
  ],
  template: `
<p-toast position="top-right" />

<div class="statistics-page">

  <!-- ── Page Header ── -->
  <div class="page-header">
    <div>
      <h2 class="page-title">Patient Statistics</h2>
      <p class="page-subtitle">Numeric and categorical analysis of assessment form data across patients.</p>
    </div>
  </div>

  <!-- ── Disease Filter ── -->
  <div class="card filter-card">
    <div class="filter-row">
      <label class="label">Filter by Disease</label>
      <p-dropdown
        [options]="diseaseOptions()"
        [(ngModel)]="selectedDiseaseId"
        optionLabel="name"
        optionValue="id"
        placeholder="All diseases"
        [showClear]="true"
        [style]="{ width: '300px' }"
        appendTo="body"
        (ngModelChange)="onDiseaseChange()"
      />
    </div>
  </div>

  <!-- ── Numeric Statistics Table ── -->
  <div class="card">
    <div class="section-header">
      <h3 class="section-title"><i class="pi pi-calculator" style="margin-right:8px;color:#06b6d4"></i>Numeric Statistics</h3>
      <span class="section-subtitle">Mean, Median, and Range for numeric fields</span>
    </div>

    @if (loading()) {
      <p-skeleton height="200px" />
    } @else if (statistics()?.numeric_stats?.length === 0) {
      <div class="empty-state">
        <i class="pi pi-inbox"></i>
        <span>No numeric data available for the current filter.</span>
      </div>
    } @else {
      <p-table
        [value]="statistics()?.numeric_stats ?? []"
        styleClass="p-datatable-sm p-datatable-striped"
        [rowHover]="true"
      >
        <ng-template pTemplate="header">
          <tr>
            <th style="min-width:200px">Title</th>
            <th style="width:120px;text-align:right">Mean</th>
            <th style="width:120px;text-align:right">Median</th>
            <th style="width:180px;text-align:right">Range</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td><span class="field-name">{{ row.title }}</span></td>
            <td style="text-align:right">{{ row.mean }}</td>
            <td style="text-align:right">{{ row.median }}</td>
            <td style="text-align:right"><span class="range-badge">{{ row.range_min }} – {{ row.range_max }}</span></td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="4" class="empty-state">No numeric data available.</td>
          </tr>
        </ng-template>
      </p-table>
    }
  </div>

</div>
  `,
  styles: [`
    .statistics-page { display: flex; flex-direction: column; gap: 24px; }

    /* Header */
    .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .page-title { margin: 0; font-size: 1.35rem; font-weight: 700; color: var(--color-neutral-900); }
    .page-subtitle { margin: 4px 0 0; color: var(--color-neutral-600); font-size: 13px; }

    /* Filter */
    .filter-card { padding: 16px 20px; }
    .filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .label { font-size: 13px; font-weight: 600; color: var(--color-neutral-700); }

    /* Sections */
    .section-header { margin-bottom: 16px; }
    .section-title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-neutral-900); }
    .section-subtitle { font-size: 12px; color: var(--color-neutral-500); }

    /* Table */
    .field-name { font-weight: 600; color: var(--color-neutral-900); }
    .range-badge {
      display: inline-block; padding: 2px 10px; border-radius: 4px;
      background: #ecfeff; color: #0e7490; font-size: 12px; font-weight: 600;
    }

    /* Categorical */
    .categorical-section { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--color-neutral-100); }
    .categorical-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .categorical-heading { margin: 0 0 12px; font-size: 0.9rem; font-weight: 700; color: var(--color-neutral-800); text-transform: capitalize; }
    .bubble-chart-wrap { position: relative; height: 120px; width: 100%; }
    .bubble-canvas { width: 100% !important; height: 100% !important; }

    /* Empty state */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 48px 20px; color: var(--color-neutral-400); font-size: 14px;
    }
    .empty-state i { font-size: 2rem; }

    /* PrimeNG overrides */
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; vertical-align: middle; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; background: var(--color-neutral-50); color: var(--color-neutral-600); }
    :host ::ng-deep .p-datatable-striped .p-datatable-tbody > tr:nth-child(even) { background: var(--color-neutral-50); }
  `]
})
export class StatisticsComponent implements OnInit, OnDestroy, AfterViewInit {
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroy$ = new Subject<void>();

  // ── State ─────────────────────────────────────────────────────────────────
  statistics = signal<PatientStatistics | null>(null);
  diseaseOptions = signal<DiseaseOption[]>([]);
  loading = signal(false);

  selectedDiseaseId: number | null = null;

  // ── Chart colours (same donut palette) ────────────────────────────────────
  readonly bubbleColors = [
    '#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadDiseaseOptions();
    this.loadStatistics();
  }

  ngAfterViewInit(): void {
    // Charts rendered after data arrives
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Filter
  // ─────────────────────────────────────────────────────────────────────────

  onDiseaseChange(): void {
    this.loadStatistics();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  private loadDiseaseOptions(): void {
    this.http.get<PagedResponse<DiseaseOption>>(`${API}/diseases/?page_size=100`)
      .pipe(takeUntil(this.destroy$), catchError(() => of({ items: [], total: 0 })))
      .subscribe({
        next: (res) => this.diseaseOptions.set(res.items ?? []),
      });
  }

  private loadStatistics(): void {
    this.loading.set(true);
    let url = `${API}/analytics/patient-statistics`;
    if (this.selectedDiseaseId != null) {
      url += `?disease_id=${this.selectedDiseaseId}`;
    }
    this.http.get<PatientStatistics>(url)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.statistics.set(data);
          this.cdr.detectChanges();
          setTimeout(() => this.renderBubbleCharts(), 150);
        },
        error: () => this.messageService.add({
          severity: 'error',
          summary: 'Load Failed',
          detail: 'Could not load patient statistics.',
        }),
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bubble Chart Rendering (native Canvas 2D)
  // ─────────────────────────────────────────────────────────────────────────

  private renderBubbleCharts(): void {
    const stats = this.statistics();
    if (!stats || !stats.categorical_stats.length) return;

    this.zone.runOutsideAngular(() => {
      stats.categorical_stats.forEach((cat, idx) => {
        const canvas = document.querySelector(
          `canvas[data-field-index="${idx}"]`
        ) as HTMLCanvasElement | null;
        if (canvas) {
          this.renderSingleBubbleChart(canvas, cat.categories);
        }
      });
    });
  }

  private renderSingleBubbleChart(canvas: HTMLCanvasElement, categories: CategoryCount[]): void {
    if (!categories.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 600;
    const H = canvas.offsetHeight || 120;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const maxCount = Math.max(...categories.map(c => c.count), 1);
    const minRadius = 18;
    const maxRadius = Math.min(H * 0.38, 48);

    // Calculate bubble positions - evenly distributed horizontally
    const padding = maxRadius + 10;
    const availableW = W - padding * 2;
    const step = categories.length > 1 ? availableW / (categories.length - 1) : 0;

    categories.forEach((cat, i) => {
      const ratio = cat.count / maxCount;
      const radius = minRadius + ratio * (maxRadius - minRadius);
      const x = categories.length === 1 ? W / 2 : padding + i * step;
      const y = H / 2 - 6;
      const color = this.bubbleColors[i % this.bubbleColors.length];

      // Draw bubble
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color + '33'; // 20% opacity fill
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw count inside bubble
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(11, Math.round(radius * 0.45))}px Poppins, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cat.count), x, y);

      // Draw label below bubble
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = cat.label.length > 14 ? cat.label.substring(0, 12) + '…' : cat.label;
      ctx.fillText(label, x, y + radius + 6);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  formatFieldName(field: string): string {
    return field
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
