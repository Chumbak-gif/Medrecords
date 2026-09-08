import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  AfterViewInit, ElementRef, ViewChild,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, forkJoin, takeUntil, finalize, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';

import { MultiSelectModule } from 'primeng/multiselect';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';

// Shared
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { environment } from '../../../environments/environment';

const API = `${environment.apiBaseUrl}/api/v1`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminKpis {
  total_assessments: number;
  this_month_assessments: number;
  active_patients: number;
  active_doctors: number;
  active_diseases: number;
}

interface MonthlyVolumeItem { month: string; count: number; }
interface DiseaseDistributionItem { disease_name: string; count: number; }
interface TrendItem { date: string; count: number; }
interface DiseaseSummaryRow {
  disease_name: string;
  total_count: number;
  this_month_count: number;
  submitted_count: number;
  locked_count: number;
}
interface DoctorOption { id: number; full_name: string; username: string; }
interface DiseaseOption { id: number; name: string; }
interface SubDiseaseOption { id: number; name: string; disease_id: number; }
interface PagedResponse<T> { items: T[]; total: number; }

// ─── Component Decorator ─────────────────────────────────────────────────────

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    ToastModule,
    TooltipModule,
    SkeletonModule,
    MultiSelectModule,
    CalendarModule,
    DropdownModule,
    KpiCardComponent,
  ],
  template: `
<p-toast position="top-right" />

<div class="analytics-page">

  <!-- ── Page Header ── -->
  <div class="page-header">
    <div>
      <h2 class="page-title">Analytics Dashboard</h2>
      <p class="page-subtitle">Overview of assessment data, disease trends, and doctor activity.</p>
    </div>
    <div class="header-actions">
      <button class="btn-secondary" (click)="resetFilters()" pTooltip="Clear all filters" tooltipPosition="top">
        <i class="pi pi-filter-slash"></i> Reset Filters
      </button>
      <button class="btn-primary" (click)="applyFilters()" [disabled]="loading()">
        <i class="pi pi-refresh" [class.spin]="loading()"></i>
        {{ loading() ? 'Loading…' : 'Apply Filters' }}
      </button>
    </div>
  </div>

  <!-- ── KPI Cards ── -->
  <div class="kpi-grid">
    @if (kpiLoading()) {
      @for (i of [1,2,3,4,5]; track i) {
        <div class="kpi-card">
          <p-skeleton shape="circle" size="56px" />
          <div style="flex:1">
            <p-skeleton height="1.5rem" width="60%" styleClass="mb-2" />
            <p-skeleton height="0.75rem" width="40%" />
          </div>
        </div>
      }
    } @else {
      <app-kpi-card title="Total Assessments"     [value]="kpis()?.total_assessments ?? 0"      icon="pi-chart-bar"     color="#06b6d4" />
      <app-kpi-card title="This Month"            [value]="kpis()?.this_month_assessments ?? 0"  icon="pi-calendar-plus" color="#3b82f6" />
      <app-kpi-card title="Active Patients"       [value]="kpis()?.active_patients ?? 0"         icon="pi-users"         color="#10b981" />
      <app-kpi-card title="Active Doctors"        [value]="kpis()?.active_doctors ?? 0"          icon="pi-user-plus"     color="#f59e0b" />
      <app-kpi-card title="Active Diseases"       [value]="kpis()?.active_diseases ?? 0"         icon="pi-heart"         color="#8b5cf6" />
    }
  </div>

  <!-- ── Filter Panel ── -->
  <div class="card filter-panel">
    <div class="filter-panel-header">
      <h3 class="filter-title"><i class="pi pi-filter" style="margin-right:6px;color:var(--color-primary)"></i>Filters</h3>
    </div>

    <!-- Date Preset Buttons -->
    <div class="date-presets">
      <button class="preset-btn" [class.active]="activeDatePreset==='today'" (click)="setDatePreset('today')">Today</button>
      <button class="preset-btn" [class.active]="activeDatePreset==='week'" (click)="setDatePreset('week')">This Week</button>
      <button class="preset-btn" [class.active]="activeDatePreset==='month'" (click)="setDatePreset('month')">This Month</button>
      <button class="preset-btn" [class.active]="activeDatePreset==='quarter'" (click)="setDatePreset('quarter')">This Quarter</button>
      <button class="preset-btn" [class.active]="activeDatePreset==='year'" (click)="setDatePreset('year')">This Year</button>
      <button class="preset-btn" [class.active]="activeDatePreset==='custom'" (click)="setDatePreset('custom')">Custom</button>
    </div>

    <div class="filter-grid">
      <!-- Row 1: Date Range, Disease, Sub-Disease -->
      <div class="filter-field">
        <label class="label">Date Range</label>
        <p-calendar [inline]="false"
          [(ngModel)]="dateRange"
          selectionMode="range"
          [readonlyInput]="true"
          dateFormat="dd/mm/yy"
          placeholder="Select date range"
          showButtonBar="true"
          [style]="{ width: '100%' }"
          appendTo="body"
          (ngModelChange)="onDateRangeChange()"
        />
      </div>
      <div class="filter-field">
        <label class="label">Diseases</label>
        <p-multiSelect
          [options]="diseaseOptions()"
          [(ngModel)]="selectedDiseases"
          optionLabel="name"
          optionValue="id"
          placeholder="All diseases"
          [showClear]="false"
          [style]="{ width: '100%' }"
          appendTo="body"
          [maxSelectedLabels]="3"
          selectedItemsLabel="{0} diseases selected"
          (ngModelChange)="onDiseaseChange()"
        />
      </div>
      <div class="filter-field">
        <label class="label">Sub-Disease</label>
        <p-multiSelect
          [options]="subDiseaseOptions()"
          [(ngModel)]="selectedSubDiseases"
          optionLabel="name"
          optionValue="id"
          placeholder="All sub-diseases"
          [showClear]="false"
          [style]="{ width: '100%' }"
          appendTo="body"
          [maxSelectedLabels]="3"
          selectedItemsLabel="{0} selected"
          [disabled]="selectedDiseases.length === 0"
        />
      </div>

      <!-- Row 2: Doctors, Age Group, Gender -->
      <div class="filter-field">
        <label class="label">Doctors</label>
        <p-multiSelect
          [options]="doctorOptions()"
          [(ngModel)]="selectedDoctors"
          optionLabel="full_name"
          optionValue="id"
          placeholder="All doctors"
          [showClear]="false"
          [style]="{ width: '100%' }"
          appendTo="body"
          [maxSelectedLabels]="3"
          selectedItemsLabel="{0} doctors selected"
        />
      </div>
      <div class="filter-field">
        <label class="label">Age Group</label>
        <p-dropdown
          [options]="ageGroupOptions"
          [(ngModel)]="selectedAgeGroup"
          optionLabel="label"
          optionValue="value"
          placeholder="All age groups"
          [showClear]="false"
          [style]="{ width: '100%' }"
          appendTo="body"
        />
      </div>
      <div class="filter-field">
        <label class="label">Gender</label>
        <p-dropdown
          [options]="genderOptions"
          [(ngModel)]="selectedGender"
          optionLabel="label"
          optionValue="value"
          placeholder="All genders"
          [showClear]="false"
          [style]="{ width: '100%' }"
          appendTo="body"
        />
      </div>
    </div>
  </div>

  <!-- ── View Toggle ── -->
  <div class="view-toggle-row">
    <div class="view-toggle-btns">
      <button class="toggle-btn" [class.active]="activeView === 'graphical'" (click)="activeView = 'graphical'">
        📊 Graphical
      </button>
      <button class="toggle-btn" [class.active]="activeView === 'numerical'" (click)="activeView = 'numerical'">
        📋 Numerical
      </button>
    </div>
  </div>

  <!-- ─────────────────────────────────────────────────────────────────────── -->
  <!-- ── GRAPHICAL VIEW ── -->
  <!-- ─────────────────────────────────────────────────────────────────────── -->
  @if (activeView === 'graphical') {
    <div class="charts-grid">

      <!-- Bar Chart: Monthly Volume -->
      <div class="card chart-card">
        <div class="chart-header">
          <h3 class="chart-title">Monthly Assessment Volume</h3>
          <span class="chart-subtitle">Trailing 12 months</span>
        </div>
        @if (chartsLoading()) {
          <p-skeleton height="260px" />
        } @else if (monthlyVolume().length === 0) {
          <div class="chart-empty"><i class="pi pi-chart-bar"></i><span>No data available</span></div>
        } @else {
          <div class="canvas-wrap">
            <canvas #barCanvas></canvas>
          </div>
        }
      </div>

      <!-- Donut Chart: By Disease -->
      <div class="card chart-card">
        <div class="chart-header">
          <h3 class="chart-title">Distribution by Disease</h3>
          <span class="chart-subtitle">All time (filtered)</span>
        </div>
        @if (chartsLoading()) {
          <p-skeleton height="260px" />
        } @else if (byDisease().length === 0) {
          <div class="chart-empty"><i class="pi pi-chart-pie"></i><span>No data available</span></div>
        } @else {
          <div class="canvas-wrap donut-wrap">
            <canvas #donutCanvas></canvas>
            <div class="donut-legend">
              @for (item of byDisease().slice(0, 8); track item.disease_name; let i = $index) {
                <div class="legend-item">
                  <span class="legend-dot" [style.background]="donutColors[i % donutColors.length]"></span>
                  <span class="legend-label" [title]="item.disease_name">{{ item.disease_name }}</span>
                  <span class="legend-val">{{ item.count }}</span>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Line Chart: Trend -->
      <div class="card chart-card chart-card--full">
        <div class="chart-header">
          <h3 class="chart-title">Daily Trend</h3>
          <span class="chart-subtitle">{{ trendSubtitle() }}</span>
        </div>
        @if (chartsLoading()) {
          <p-skeleton height="200px" />
        } @else if (trend().length === 0) {
          <div class="chart-empty"><i class="pi pi-chart-line"></i><span>No data available</span></div>
        } @else {
          <div class="canvas-wrap canvas-wrap--wide">
            <canvas #lineCanvas></canvas>
          </div>
        }
      </div>

    </div>
  }

  <!-- ─────────────────────────────────────────────────────────────────────── -->
  <!-- ── NUMERICAL VIEW ── -->
  <!-- ─────────────────────────────────────────────────────────────────────── -->
  @if (activeView === 'numerical') {
    <div class="card">
      <div class="table-header">
        <div>
          <h3 class="table-title">Statistical Summary by Disease</h3>
          <p class="table-subtitle">
            Sample size N = <strong>{{ summaryTotals().total }}</strong> records within the selected filters
          </p>
        </div>
        <button class="btn-ghost btn-sm" (click)="applyFilters()" [disabled]="loading()">
          <i class="pi pi-refresh" [class.spin]="loading()"></i> Refresh
        </button>
      </div>

      <p-table
        [value]="diseaseSummary()"
        [loading]="summaryLoading()"
        dataKey="disease_name"
        styleClass="p-datatable-sm"
        [rowHover]="true"
        [sortMode]="'single'"
      >
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="disease_name" style="min-width:180px">Disease <p-sortIcon field="disease_name" /></th>
            <th pSortableColumn="total_count"     style="width:130px;text-align:right">Total <p-sortIcon field="total_count" /></th>
            <th pSortableColumn="this_month_count" style="width:140px;text-align:right">This Month <p-sortIcon field="this_month_count" /></th>
            <th pSortableColumn="submitted_count" style="width:130px;text-align:right">Submitted <p-sortIcon field="submitted_count" /></th>
            <th pSortableColumn="locked_count"    style="width:110px;text-align:right">Locked <p-sortIcon field="locked_count" /></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-row>
          <tr>
            <td><span class="disease-name">{{ row.disease_name }}</span></td>
            <td style="text-align:right"><strong>{{ row.total_count }}</strong></td>
            <td style="text-align:right">{{ row.this_month_count }}</td>
            <td style="text-align:right">
              <span class="badge badge-green">{{ row.submitted_count }}</span>
            </td>
            <td style="text-align:right">
              <span class="badge badge-gray">{{ row.locked_count }}</span>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="footer">
          @if (diseaseSummary().length > 0) {
            <tr class="summary-footer">
              <td><strong>Total</strong></td>
              <td style="text-align:right"><strong>{{ summaryTotals().total }}</strong></td>
              <td style="text-align:right"><strong>{{ summaryTotals().thisMonth }}</strong></td>
              <td style="text-align:right"><strong>{{ summaryTotals().submitted }}</strong></td>
              <td style="text-align:right"><strong>{{ summaryTotals().locked }}</strong></td>
            </tr>
          }
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" class="empty-state">
              <i class="pi pi-inbox" style="font-size:2rem;display:block;margin-bottom:8px"></i>
              No data matches the current filters.
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  }

</div>
  `,
  styles: [`
    .analytics-page { display: flex; flex-direction: column; gap: 24px; }

    /* Header */
    .page-title { margin: 0; font-size: 1.35rem; font-weight: 700; color: var(--color-neutral-900); }
    .page-subtitle { margin: 4px 0 0; color: var(--color-neutral-600); font-size: 13px; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

    /* KPI Grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
    @media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px)  { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px)  { .kpi-grid { grid-template-columns: 1fr; } }

    /* Filter Panel */
    .filter-panel-header { margin-bottom: 14px; }
    .filter-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--color-neutral-900); }
    .filter-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
    @media (max-width: 900px) { .filter-grid { grid-template-columns: 1fr; } }
    .filter-field { display: flex; flex-direction: column; gap: 6px; }

    /* Date Presets */
    .date-presets { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .preset-btn {
      padding: 5px 14px; border-radius: 20px; border: 1px solid var(--color-neutral-300);
      background: var(--surface-card); font-size: 12px; font-weight: 600; color: var(--color-neutral-600);
      cursor: pointer; transition: all 0.15s;
    }
    .preset-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .preset-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-neutral-0, #fff); }

    /* View Toggle */
    .view-toggle-row { display: flex; align-items: center; gap: 12px; }

    /* Charts Grid */
    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
    .chart-card { min-height: 320px; }
    .chart-card--full { grid-column: 1 / -1; }
    .chart-header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .chart-title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-neutral-900); }
    .chart-subtitle { font-size: 12px; color: var(--color-neutral-500); }
    .chart-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; height: 240px; color: var(--color-neutral-400); font-size: 14px;
    }
    .chart-empty i { font-size: 2.5rem; }

    /* Canvas */
    .canvas-wrap { position: relative; height: 260px; width: 100%; }
    .canvas-wrap--wide { height: 200px; }
    .canvas-wrap canvas { width: 100% !important; height: 100% !important; }
    .donut-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: center; }
    .donut-wrap canvas { height: 200px !important; }

    /* Legend */
    .donut-legend { display: flex; flex-direction: column; gap: 5px; overflow: hidden; }
    .legend-item { display: flex; align-items: center; gap: 7px; min-width: 0; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-label { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-neutral-700); }
    .legend-val { font-size: 12px; font-weight: 700; color: var(--color-neutral-900); }

    /* Table */
    .table-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .table-title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-neutral-900); }
    .table-subtitle { margin: 2px 0 0; font-size: 12px; color: var(--color-neutral-500); }
    .disease-name { font-weight: 600; color: var(--color-neutral-900); }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-gray  { background: #f3f4f6; color: var(--color-neutral-700); }
    .empty-state { text-align: center; padding: 48px 20px; color: var(--color-neutral-400); font-size: 14px; }

    /* Spin */
    .spin { animation: spin 0.8s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* PrimeNG overrides */
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 10px 12px; vertical-align: middle; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 12px; font-size: 12px; font-weight: 700; background: var(--color-neutral-50); color: var(--color-neutral-600); }
    :host ::ng-deep .p-datatable tfoot tr td { padding: 10px 12px; background: var(--color-neutral-50); }

    /* View Toggle Buttons */
    .view-toggle-btns { display: flex; gap: 0; border: 1px solid var(--color-neutral-300); border-radius: 6px; overflow: hidden; }
    .toggle-btn { padding: 8px 18px; font-size: 13px; font-weight: 500; border: none; background: var(--surface-card); color: var(--color-neutral-600); cursor: pointer; transition: all 150ms; }
    .toggle-btn.active { background: var(--color-primary); color: var(--color-neutral-0, #fff); font-weight: 600; }
    .toggle-btn:not(.active):hover { background: var(--color-neutral-100); }
  `]
})
export class AdminAnalyticsComponent implements OnInit, OnDestroy, AfterViewInit {
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroy$ = new Subject<void>();

  // ── Canvas refs ───────────────────────────────────────────────────────────
  @ViewChild('barCanvas')   barCanvasRef!:   ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas') donutCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lineCanvas')  lineCanvasRef!:  ElementRef<HTMLCanvasElement>;

  // ── State signals ─────────────────────────────────────────────────────────
  kpis           = signal<AdminKpis | null>(null);
  monthlyVolume  = signal<MonthlyVolumeItem[]>([]);
  byDisease      = signal<DiseaseDistributionItem[]>([]);
  trend          = signal<TrendItem[]>([]);
  diseaseSummary = signal<DiseaseSummaryRow[]>([]);
  doctorOptions  = signal<DoctorOption[]>([]);
  diseaseOptions = signal<DiseaseOption[]>([]);
  subDiseaseOptions = signal<SubDiseaseOption[]>([]);

  kpiLoading     = signal(true);
  chartsLoading  = signal(true);
  summaryLoading = signal(false);
  loading        = computed(() => this.chartsLoading() || this.summaryLoading());

  // ── Filters ───────────────────────────────────────────────────────────────
  dateRange:           Date[] | null = null;
  selectedDiseases:    number[] = [];
  selectedSubDiseases: number[] = [];
  selectedDoctors:     number[] = [];
  selectedAgeGroup:    string | null = null;
  selectedGender:      string | null = null;
  activeDatePreset:    string = '';

  // Static filter options
  ageGroupOptions = [
    { label: 'Under 18',  value: '0-17'   },
    { label: '18 – 35',   value: '18-35'  },
    { label: '36 – 50',   value: '36-50'  },
    { label: '51 – 65',   value: '51-65'  },
    { label: 'Over 65',   value: '66+'    },
  ];

  genderOptions = [
    { label: 'Male',   value: 'male'   },
    { label: 'Female', value: 'female' },
    { label: 'Other',  value: 'other'  },
  ];

  // ── View toggle ───────────────────────────────────────────────────────────
  private _activeView = 'graphical';
  get activeView(): string { return this._activeView; }
  set activeView(v: string) {
    this._activeView = v;
    if (v === 'graphical') {
      this.cdr.detectChanges();
      setTimeout(() => this.renderAllCharts(), 0);
    }
  }
  viewOptions = [
    { label: '📊 Graphical', value: 'graphical' },
    { label: '📋 Numerical', value: 'numerical' },
  ];

  // ── Chart colours ─────────────────────────────────────────────────────────
  readonly donutColors = [
    '#06b6d4','#3b82f6','#10b981','#f59e0b','#8b5cf6',
    '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16',
  ];

  // ── Computed ──────────────────────────────────────────────────────────────
  trendSubtitle = signal('Last 30 days');

  private updateTrendSubtitle(): void {
    if (this.dateRange && this.dateRange[0] && this.dateRange[1]) {
      const f = (d: Date) => d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      this.trendSubtitle.set(`${f(this.dateRange[0])} – ${f(this.dateRange[1])}`);
    } else {
      this.trendSubtitle.set('Last 30 days');
    }
  }

  summaryTotals = computed(() => {
    const rows = this.diseaseSummary();
    return {
      total:     rows.reduce((s, r) => s + r.total_count, 0),
      thisMonth: rows.reduce((s, r) => s + r.this_month_count, 0),
      submitted: rows.reduce((s, r) => s + r.submitted_count, 0),
      locked:    rows.reduce((s, r) => s + r.locked_count, 0),
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadKpis();
    this.loadChartData();
    this.loadSummary();
  }

  ngAfterViewInit(): void {
    // Charts rendered via signal effects after data loads
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Filter helpers
  // ─────────────────────────────────────────────────────────────────────────

  applyFilters(): void {
    this.updateTrendSubtitle();
    this.loadKpis();
    this.loadChartData();
    this.loadSummary();
  }

  resetFilters(): void {
    this.dateRange = null;
    this.selectedDiseases = [];
    this.selectedSubDiseases = [];
    this.selectedDoctors = [];
    this.selectedAgeGroup = null;
    this.selectedGender = null;
    this.activeDatePreset = '';
    this.subDiseaseOptions.set([]);
    this.applyFilters();
  }

  onDateRangeChange(): void {
    // If user manually changes the calendar, clear the active preset
    this.activeDatePreset = 'custom';
  }

  onDiseaseChange(): void {
    // Clear sub-disease when disease selection changes
    this.selectedSubDiseases = [];
    this.subDiseaseOptions.set([]);

    if (this.selectedDiseases.length === 1) {
      // Load sub-diseases for the single selected disease
      this.http.get<SubDiseaseOption[]>(
        `${API}/diseases/${this.selectedDiseases[0]}/sub-diseases`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => this.subDiseaseOptions.set(items ?? []),
        error: () => { /* non-critical */ }
      });
    } else if (this.selectedDiseases.length > 1) {
      // For multiple diseases, load all sub-diseases from each
      const requests = this.selectedDiseases.map(id =>
        this.http.get<SubDiseaseOption[]>(`${API}/diseases/${id}/sub-diseases`)
      );
      forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe({
        next: (results) => {
          const all = results.flatMap(r => r ?? []);
          this.subDiseaseOptions.set(all);
        },
        error: () => { /* non-critical */ }
      });
    }
  }

  setDatePreset(preset: string): void {
    this.activeDatePreset = preset;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        this.dateRange = [today, today];
        break;
      case 'week': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
        this.dateRange = [monday, today];
        break;
      }
      case 'month':
        this.dateRange = [new Date(today.getFullYear(), today.getMonth(), 1), today];
        break;
      case 'quarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        this.dateRange = [new Date(today.getFullYear(), quarter * 3, 1), today];
        break;
      }
      case 'year':
        this.dateRange = [new Date(today.getFullYear(), 0, 1), today];
        break;
      case 'custom':
        // Just show the calendar - don't auto-set dates
        this.dateRange = null;
        break;
    }
    this.applyFilters();
  }

  private buildDateParams(): Record<string, string> {
    const params: Record<string, string> = {};
    if (this.dateRange && this.dateRange[0]) {
      params['from_date'] = this.formatDate(this.dateRange[0]);
    }
    if (this.dateRange && this.dateRange[1]) {
      params['to_date'] = this.formatDate(this.dateRange[1]);
    }
    return params;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private buildQueryString(params: Record<string, string>): string {
    const q = new URLSearchParams(params);
    if (this.selectedDiseases.length === 1) {
      q.set('disease_id', String(this.selectedDiseases[0]));
    } else if (this.selectedDiseases.length > 1) {
      this.selectedDiseases.forEach(id => q.append('disease_ids', String(id)));
    }
    if (this.selectedDoctors.length > 0) {
      this.selectedDoctors.forEach(id => q.append('doctor_ids', String(id)));
    }
    return q.toString() ? `?${q.toString()}` : '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  private loadFilterOptions(): void {
    this.http.get<PagedResponse<DoctorOption>>(`${API}/users/?role=doctor&page_size=100`)
      .pipe(takeUntil(this.destroy$), catchError(() => of({ items: [], total: 0 })))
      .subscribe({
        next: (res) => this.doctorOptions.set(res.items ?? []),
      });

    this.http.get<PagedResponse<DiseaseOption>>(`${API}/diseases/?page_size=100`)
      .pipe(takeUntil(this.destroy$), catchError(() => of({ items: [], total: 0 })))
      .subscribe({
        next: (res) => this.diseaseOptions.set(res.items ?? []),
      });
  }

  private loadKpis(): void {
    this.kpiLoading.set(true);
    const dp = this.buildDateParams();
    const qs = this.buildQueryString(dp);
    this.http.get<AdminKpis>(`${API}/analytics/kpis${qs}`)
      .pipe(takeUntil(this.destroy$), finalize(() => this.kpiLoading.set(false)))
      .subscribe({
        next: (data) => this.kpis.set(data),
        error: () => this.showError('KPI Load Failed', 'Could not load KPI cards.'),
      });
  }

  private loadChartData(): void {
    this.chartsLoading.set(true);
    const dp = this.buildDateParams();
    const qs = this.buildQueryString(dp);

    forkJoin({
      monthly: this.http.get<MonthlyVolumeItem[]>(`${API}/analytics/monthly-volume${qs}`),
      disease: this.http.get<DiseaseDistributionItem[]>(`${API}/analytics/by-disease${qs}`),
      trend:   this.http.get<TrendItem[]>(`${API}/analytics/trend${qs}`),
    })
    .pipe(takeUntil(this.destroy$), finalize(() => this.chartsLoading.set(false)))
    .subscribe({
      next: ({ monthly, disease, trend }) => {
        this.monthlyVolume.set(monthly);
        this.byDisease.set(disease);
        this.trend.set(trend);
        this.cdr.detectChanges();
        // Render after view updates — give Angular time to create canvas elements
        setTimeout(() => this.renderAllCharts(), 150);
      },
      error: () => this.showError('Chart Data Error', 'Could not load chart data.'),
    });
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    const dp = this.buildDateParams();
    const qs = this.buildQueryString(dp);
    this.http.get<DiseaseSummaryRow[]>(`${API}/analytics/disease-summary${qs}`)
      .pipe(takeUntil(this.destroy$), finalize(() => this.summaryLoading.set(false)))
      .subscribe({
        next: (data) => this.diseaseSummary.set(data),
        error: () => this.showError('Summary Error', 'Could not load disease summary.'),
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Chart Rendering (native Canvas 2D)
  // ─────────────────────────────────────────────────────────────────────────

  private renderRetryCount = 0;

  private renderAllCharts(): void {
    if (this._activeView !== 'graphical') return;
    
    // Wait for canvas elements to be available (they're inside @if blocks)
    const hasData = this.monthlyVolume().length > 0 || this.byDisease().length > 0 || this.trend().length > 0;
    const hasCanvas = !!this.barCanvasRef?.nativeElement || !!this.donutCanvasRef?.nativeElement || !!this.lineCanvasRef?.nativeElement;
    
    if (hasData && !hasCanvas && this.renderRetryCount < 10) {
      this.renderRetryCount++;
      setTimeout(() => this.renderAllCharts(), 100);
      return;
    }
    this.renderRetryCount = 0;
    
    this.zone.runOutsideAngular(() => {
      try { this.renderBarChart();   } catch (_) { /* canvas not ready */ }
      try { this.renderDonutChart(); } catch (_) { /* canvas not ready */ }
      try { this.renderLineChart();  } catch (_) { /* canvas not ready */ }
    });
  }

  private renderBarChart(): void {
    const canvas = this.barCanvasRef?.nativeElement;
    if (!canvas) return;
    const data = this.monthlyVolume();
    if (!data.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth  || 400;
    const H = canvas.offsetHeight || 260;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 16, bottom: 48, left: 44 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top  - pad.bottom;
    const maxVal = Math.max(...data.map(d => d.count), 1);

    const barW    = Math.max(chartW / data.length * 0.6, 4);
    const barGap  = chartW / data.length;

    // Y-axis gridlines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth   = 1;
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const y = pad.top + chartH - (i / ySteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      const val = Math.round((i / ySteps) * maxVal);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px Poppins, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), pad.left - 6, y + 4);
    }

    // Bars
    data.forEach((item, i) => {
      const barH = (item.count / maxVal) * chartH;
      const x    = pad.left + i * barGap + (barGap - barW) / 2;
      const y    = pad.top + chartH - barH;
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
      ctx.fill();

      // X label
      const [yr, mo] = item.month.split('-');
      const label = new Date(Number(yr), Number(mo) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short' });
      ctx.fillStyle    = '#6b7280';
      ctx.font         = '10px Poppins, sans-serif';
      ctx.textAlign    = 'center';
      ctx.fillText(label, x + barW / 2, pad.top + chartH + 16);
      ctx.fillStyle    = '#374151';
      ctx.font         = '9px Poppins, sans-serif';
      ctx.fillText(yr, x + barW / 2, pad.top + chartH + 30);
    });
  }

  private renderDonutChart(): void {
    const canvas = this.donutCanvasRef?.nativeElement;
    if (!canvas) return;
    const data = this.byDisease().slice(0, 8);
    if (!data.length) return;

    const dpr  = window.devicePixelRatio || 1;
    const size = Math.min(canvas.offsetWidth || 200, canvas.offsetHeight || 200);
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const total  = data.reduce((s, d) => s + d.count, 0);
    const cx     = size / 2;
    const cy     = size / 2;
    const outer  = size * 0.42;
    const inner  = outer * 0.55;
    let   start  = -Math.PI / 2;

    data.forEach((item, i) => {
      const slice = (item.count / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outer, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = this.donutColors[i % this.donutColors.length];
      ctx.fill();
      start += slice;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Centre label
    ctx.fillStyle  = '#111827';
    ctx.font       = `bold ${Math.round(size * 0.12)}px Poppins, sans-serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - size * 0.06);
    ctx.font       = `${Math.round(size * 0.08)}px Poppins, sans-serif`;
    ctx.fillStyle  = '#6b7280';
    ctx.fillText('Total', cx, cy + size * 0.08);
  }

  private renderLineChart(): void {
    const canvas = this.lineCanvasRef?.nativeElement;
    if (!canvas) return;
    const data = this.trend();
    if (!data.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || 800;
    const H   = canvas.offsetHeight || 200;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad    = { top: 20, right: 20, bottom: 36, left: 44 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top  - pad.bottom;
    const maxVal = Math.max(...data.map(d => d.count), 1);
    const stepX  = data.length > 1 ? chartW / (data.length - 1) : chartW;

    // Gridlines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth   = 1;
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const y = pad.top + chartH - (i / ySteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle    = '#9ca3af';
      ctx.font         = '10px Poppins, sans-serif';
      ctx.textAlign    = 'right';
      ctx.fillText(String(Math.round((i / ySteps) * maxVal)), pad.left - 6, y + 4);
    }

    // Area fill
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, 'rgba(6,182,212,0.2)');
    gradient.addColorStop(1, 'rgba(6,182,212,0)');

    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + chartH);
    data.forEach((item, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (item.count / maxVal) * chartH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + (data.length - 1) * stepX, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    data.forEach((item, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (item.count / maxVal) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots + X labels (show every Nth to avoid crowding)
    const labelEvery = Math.ceil(data.length / 12);
    data.forEach((item, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (item.count / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();

      if (i % labelEvery === 0) {
        const d = new Date(item.date);
        const lbl = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        ctx.fillStyle    = '#6b7280';
        ctx.font         = '10px Poppins, sans-serif';
        ctx.textAlign    = 'center';
        ctx.fillText(lbl, x, pad.top + chartH + 18);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private showError(summary: string, detail: string): void {
    this.messageService.add({ severity: 'error', summary, detail });
  }
}
