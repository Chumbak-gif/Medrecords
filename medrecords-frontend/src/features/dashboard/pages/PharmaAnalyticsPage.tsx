/**
 * Pharma Analytics page matching the Angular PharmaAnalyticsComponent.
 * De-identified, aggregated view: 4 KPI cards (no Active Doctors), a disclaimer
 * banner, disease + date-range filters, view toggle (graphical/numerical),
 * charts rendered with Canvas 2D, and a sortable disease-summary table.
 *
 * Charting/filter/data patterns mirror the admin DashboardPage.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PharmaKpis {
  total_assessments: number;
  this_month_assessments: number;
  active_patients: number;
  active_diseases: number;
}
// The /analytics/kpis endpoint returns the admin shape; pharma ignores active_doctors.
interface AdminKpisResponse {
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
interface DiseaseOption { id: number; name: string; }

const DONUT_COLORS = [
  '#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

const apiClient = createTypedApiClient();

export function PharmaAnalyticsPage() {
  // ── State ──
  const [kpis, setKpis] = useState<PharmaKpis | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [monthlyVolume, setMonthlyVolume] = useState<MonthlyVolumeItem[]>([]);
  const [byDisease, setByDisease] = useState<DiseaseDistributionItem[]>([]);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [diseaseSummary, setDiseaseSummary] = useState<DiseaseSummaryRow[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeView, setActiveView] = useState<'graphical' | 'numerical'>('graphical');
  const [activeDatePreset, setActiveDatePreset] = useState('');

  // Filter options
  const [diseaseOptions, setDiseaseOptions] = useState<DiseaseOption[]>([]);

  // Filter values (no doctor filter for pharma)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [selectedDiseases, setSelectedDiseases] = useState<number[]>([]);
  const [trendSubtitle, setTrendSubtitle] = useState('Last 30 days');

  // Sort state for numerical table
  const [sortField, setSortField] = useState<string>('disease_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Canvas refs
  const barCanvasRef = useRef<HTMLCanvasElement>(null);
  const donutCanvasRef = useRef<HTMLCanvasElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Helpers ──
  const formatDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const buildQueryString = useCallback((): string => {
    const params = new URLSearchParams();
    if (dateRange && dateRange[0]) params.set('from_date', dateRange[0]);
    if (dateRange && dateRange[1]) params.set('to_date', dateRange[1]);
    if (selectedDiseases.length === 1) {
      params.set('disease_id', String(selectedDiseases[0]));
    } else if (selectedDiseases.length > 1) {
      selectedDiseases.forEach(id => params.append('disease_ids', String(id)));
    }
    return params.toString() ? `?${params.toString()}` : '';
  }, [dateRange, selectedDiseases]);

  const computeTrendSubtitle = useCallback((): string => {
    if (dateRange && dateRange[0] && dateRange[1]) {
      const f = (s: string) =>
        new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return `${f(dateRange[0])} – ${f(dateRange[1])}`;
    }
    return 'Last 30 days';
  }, [dateRange]);

  // ── Data Loading ──
  const loadDiseaseOptions = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: DiseaseOption[]; total: number }>('/diseases/?page_size=100');
      setDiseaseOptions(res.data.items ?? []);
    } catch { /* non-critical */ }
  }, []);

  const loadKpis = useCallback(async (qs: string) => {
    setKpiLoading(true);
    try {
      const res = await apiClient.get<AdminKpisResponse>(`/analytics/kpis${qs}`);
      // active_doctors intentionally omitted for pharma view
      setKpis({
        total_assessments: res.data.total_assessments,
        this_month_assessments: res.data.this_month_assessments,
        active_patients: res.data.active_patients,
        active_diseases: res.data.active_diseases,
      });
    } catch { /* handled */ }
    setKpiLoading(false);
  }, []);

  const loadChartData = useCallback(async (qs: string) => {
    setChartsLoading(true);
    try {
      const [monthly, disease, trendData] = await Promise.all([
        apiClient.get<MonthlyVolumeItem[]>(`/analytics/monthly-volume${qs}`),
        apiClient.get<DiseaseDistributionItem[]>(`/analytics/by-disease${qs}`),
        apiClient.get<TrendItem[]>(`/analytics/trend${qs}`),
      ]);
      setMonthlyVolume(monthly.data);
      setByDisease(disease.data);
      setTrend(trendData.data);
    } catch { /* handled */ }
    setChartsLoading(false);
  }, []);

  const loadSummary = useCallback(async (qs: string) => {
    setSummaryLoading(true);
    try {
      const res = await apiClient.get<DiseaseSummaryRow[]>(`/analytics/disease-summary${qs}`);
      setDiseaseSummary(res.data);
    } catch { /* handled */ }
    setSummaryLoading(false);
  }, []);

  const applyFilters = useCallback(() => {
    const qs = buildQueryString();
    setTrendSubtitle(computeTrendSubtitle());
    loadKpis(qs);
    loadChartData(qs);
    loadSummary(qs);
  }, [buildQueryString, computeTrendSubtitle, loadKpis, loadChartData, loadSummary]);

  const resetFilters = () => {
    setDateRange(null);
    setSelectedDiseases([]);
    setActiveDatePreset('');
    setTrendSubtitle('Last 30 days');
    const qs = '';
    loadKpis(qs);
    loadChartData(qs);
    loadSummary(qs);
  };

  const setDatePreset = (preset: string) => {
    setActiveDatePreset(preset);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from: Date | null = null;
    const to = today;

    switch (preset) {
      case 'today': from = today; break;
      case 'week': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
        from = monday;
        break;
      }
      case 'month': from = new Date(today.getFullYear(), today.getMonth(), 1); break;
      case 'quarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        from = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      }
      case 'year': from = new Date(today.getFullYear(), 0, 1); break;
      case 'custom': setDateRange(null); return;
    }
    if (from) {
      setDateRange([formatDate(from), formatDate(to)]);
    }
  };

  // Auto-apply when a date preset sets a concrete range (matches admin behavior)
  useEffect(() => {
    if (activeDatePreset && activeDatePreset !== 'custom' && dateRange) {
      applyFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // Initial load
  useEffect(() => {
    loadDiseaseOptions();
    const qs = '';
    loadKpis(qs);
    loadChartData(qs);
    loadSummary(qs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Chart Rendering ──
  const renderBarChart = useCallback(() => {
    const canvas = barCanvasRef.current;
    if (!canvas || monthlyVolume.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 400;
    const H = canvas.offsetHeight || 260;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 16, bottom: 48, left: 44 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const maxVal = Math.max(...monthlyVolume.map(d => d.count), 1);
    const barW = Math.max(chartW / monthlyVolume.length * 0.6, 4);
    const barGap = chartW / monthlyVolume.length;

    // Y-axis gridlines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px Poppins, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round((i / 4) * maxVal)), pad.left - 6, y + 4);
    }

    // Bars
    monthlyVolume.forEach((item, i) => {
      const barH = (item.count / maxVal) * chartH;
      const x = pad.left + i * barGap + (barGap - barW) / 2;
      const y = pad.top + chartH - barH;
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
      ctx.fill();
      const [yr, mo] = item.month.split('-');
      const label = new Date(Number(yr), Number(mo) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short' });
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barW / 2, pad.top + chartH + 16);
      ctx.fillStyle = '#374151';
      ctx.font = '9px Poppins, sans-serif';
      ctx.fillText(yr, x + barW / 2, pad.top + chartH + 30);
    });
  }, [monthlyVolume]);

  const renderDonutChart = useCallback(() => {
    const canvas = donutCanvasRef.current;
    if (!canvas || byDisease.length === 0) return;
    const data = byDisease.slice(0, 8);
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.offsetWidth || 200, canvas.offsetHeight || 200);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const total = data.reduce((s, d) => s + d.count, 0);
    const cx = size / 2;
    const cy = size / 2;
    const outer = size * 0.42;
    const inner = outer * 0.55;
    let start = -Math.PI / 2;

    data.forEach((item, i) => {
      const slice = (item.count / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outer, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = DONUT_COLORS[i % DONUT_COLORS.length];
      ctx.fill();
      start += slice;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface-card').trim() || '#ffffff';
    ctx.fill();

    // Centre label
    ctx.fillStyle = '#111827';
    ctx.font = `bold ${Math.round(size * 0.12)}px Poppins, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - size * 0.06);
    ctx.font = `${Math.round(size * 0.08)}px Poppins, sans-serif`;
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Total', cx, cy + size * 0.08);
  }, [byDisease]);

  const renderLineChart = useCallback(() => {
    const canvas = lineCanvasRef.current;
    if (!canvas || trend.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 800;
    const H = canvas.offsetHeight || 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 20, bottom: 36, left: 44 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const maxVal = Math.max(...trend.map(d => d.count), 1);
    const stepX = trend.length > 1 ? chartW / (trend.length - 1) : chartW;

    // Gridlines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px Poppins, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round((i / 4) * maxVal)), pad.left - 6, y + 4);
    }

    // Area fill
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, 'rgba(6,182,212,0.2)');
    gradient.addColorStop(1, 'rgba(6,182,212,0)');
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + chartH);
    trend.forEach((item, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (item.count / maxVal) * chartH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + (trend.length - 1) * stepX, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    trend.forEach((item, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (item.count / maxVal) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots + X labels
    const labelEvery = Math.ceil(trend.length / 12);
    trend.forEach((item, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (item.count / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();
      if (i % labelEvery === 0) {
        const d = new Date(item.date);
        const lbl = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, x, pad.top + chartH + 18);
      }
    });
  }, [trend]);

  // Render charts when data changes or view switches to graphical
  useEffect(() => {
    if (activeView === 'graphical' && !chartsLoading) {
      const timer = setTimeout(() => {
        renderBarChart();
        renderDonutChart();
        renderLineChart();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeView, chartsLoading, renderBarChart, renderDonutChart, renderLineChart]);

  // ── Computed values ──
  const loading = chartsLoading || summaryLoading;
  const summaryTotals = diseaseSummary.reduce(
    (acc, r) => ({
      total: acc.total + r.total_count,
      thisMonth: acc.thisMonth + r.this_month_count,
      submitted: acc.submitted + r.submitted_count,
      locked: acc.locked + r.locked_count,
    }),
    { total: 0, thisMonth: 0, submitted: 0, locked: 0 }
  );

  // Sorted summary for table
  const sortedSummary = [...diseaseSummary].sort((a, b) => {
    const key = sortField as keyof DiseaseSummaryRow;
    const aVal = a[key];
    const bVal = b[key];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <i className={`pi ${sortField === field ? (sortDir === 'asc' ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down') : 'pi-sort-alt'}`}
       style={{ fontSize: '10px', marginLeft: '4px', opacity: sortField === field ? 1 : 0.4 }} />
  );

  return (
    <div className="analytics-page">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Pharma Analytics</h2>
          <p className="page-subtitle">Aggregated assessment data and disease trends.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={resetFilters} title="Clear all filters">
            <i className="pi pi-filter-slash" /> Reset Filters
          </button>
          <button className="btn-primary" onClick={applyFilters} disabled={loading}>
            <i className={`pi pi-refresh ${loading ? 'spin' : ''}`} />
            {loading ? 'Loading…' : 'Apply Filters'}
          </button>
        </div>
      </div>

      {/* ── Disclaimer Banner ── */}
      <div className="disclaimer-banner">
        <i className="pi pi-shield" style={{ fontSize: '1.1rem', flexShrink: 0 }} />
        <span>This view shows de-identified, aggregated data only. No patient or doctor identifying information is displayed.</span>
      </div>

      {/* ── KPI Cards (4 cards — no Active Doctors) ── */}
      <div className="kpi-grid pharma-kpi-grid">
        {kpiLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi-card">
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--color-neutral-100)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '1.5rem', width: '60%', background: 'var(--color-neutral-100)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: '0.75rem', width: '40%', background: 'var(--color-neutral-100)', borderRadius: 4 }} />
              </div>
            </div>
          ))
        ) : (
          <>
            <KpiCard title="Total Assessments" value={kpis?.total_assessments ?? 0} icon="pi-chart-bar" color="#06b6d4" />
            <KpiCard title="This Month" value={kpis?.this_month_assessments ?? 0} icon="pi-calendar-plus" color="#3b82f6" />
            <KpiCard title="Active Patients" value={kpis?.active_patients ?? 0} icon="pi-users" color="#10b981" />
            <KpiCard title="Active Diseases" value={kpis?.active_diseases ?? 0} icon="pi-heart" color="#8b5cf6" />
          </>
        )}
      </div>

      {/* ── Filter Panel (disease + date range only; NO doctor filter) ── */}
      <div className="card filter-panel">
        <div className="filter-panel-header">
          <h3 className="filter-title">
            <i className="pi pi-filter" style={{ marginRight: 6, color: 'var(--color-primary)' }} />
            Filters
          </h3>
        </div>
        <div className="date-presets">
          {['today', 'week', 'month', 'quarter', 'year', 'custom'].map(p => (
            <button key={p} className={`preset-btn ${activeDatePreset === p ? 'active' : ''}`}
              onClick={() => setDatePreset(p)}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month'
                : p === 'quarter' ? 'This Quarter' : p === 'year' ? 'This Year' : 'Custom'}
            </button>
          ))}
        </div>
        <div className="filter-grid pharma-filter-grid">
          <div className="filter-field">
            <label className="label">Date Range</label>
            <div className="select-wrapper">
              <input type="text" className="form-control" readOnly
                value={dateRange ? `${dateRange[0]} – ${dateRange[1]}` : ''}
                placeholder="Select date range" />
            </div>
          </div>
          <div className="filter-field">
            <label className="label">Diseases</label>
            <div className="select-wrapper">
              <select className="form-control"
                value={selectedDiseases.length === 1 ? String(selectedDiseases[0]) : ''}
                onChange={(e) => setSelectedDiseases(e.target.value ? [Number(e.target.value)] : [])}>
                <option value="">All diseases</option>
                {diseaseOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <i className="pi pi-chevron-down select-arrow" />
            </div>
          </div>
        </div>
      </div>

      {/* ── View Toggle ── */}
      <div className="view-toggle-row">
        <div className="view-toggle-btns">
          <button className={`toggle-btn ${activeView === 'graphical' ? 'active' : ''}`}
            onClick={() => setActiveView('graphical')}>
            📊 Graphical
          </button>
          <button className={`toggle-btn ${activeView === 'numerical' ? 'active' : ''}`}
            onClick={() => setActiveView('numerical')}>
            📋 Numerical
          </button>
        </div>
      </div>

      {/* ── GRAPHICAL VIEW ── */}
      {activeView === 'graphical' && (
        <div className="charts-grid">
          {/* Bar Chart: Monthly Volume */}
          <div className="card chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Monthly Assessment Volume</h3>
              <span className="chart-subtitle">Trailing 12 months</span>
            </div>
            {chartsLoading ? (
              <div style={{ height: 260, background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-md)' }} />
            ) : monthlyVolume.length === 0 ? (
              <div className="chart-empty"><i className="pi pi-chart-bar" /><span>No data available</span></div>
            ) : (
              <div className="canvas-wrap"><canvas ref={barCanvasRef} /></div>
            )}
          </div>

          {/* Donut Chart: By Disease */}
          <div className="card chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Distribution by Disease</h3>
              <span className="chart-subtitle">All time (filtered)</span>
            </div>
            {chartsLoading ? (
              <div style={{ height: 260, background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-md)' }} />
            ) : byDisease.length === 0 ? (
              <div className="chart-empty"><i className="pi pi-chart-pie" /><span>No data available</span></div>
            ) : (
              <div className="canvas-wrap donut-wrap">
                <canvas ref={donutCanvasRef} />
                <div className="donut-legend">
                  {byDisease.slice(0, 8).map((item, i) => (
                    <div key={item.disease_name} className="legend-item">
                      <span className="legend-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="legend-label" title={item.disease_name}>{item.disease_name}</span>
                      <span className="legend-val">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Line Chart: Trend */}
          <div className="card chart-card chart-card--full">
            <div className="chart-header">
              <h3 className="chart-title">Daily Trend</h3>
              <span className="chart-subtitle">{trendSubtitle}</span>
            </div>
            {chartsLoading ? (
              <div style={{ height: 200, background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-md)' }} />
            ) : trend.length === 0 ? (
              <div className="chart-empty"><i className="pi pi-chart-line" /><span>No data available</span></div>
            ) : (
              <div className="canvas-wrap canvas-wrap--wide"><canvas ref={lineCanvasRef} /></div>
            )}
          </div>
        </div>
      )}

      {/* ── NUMERICAL VIEW ── */}
      {activeView === 'numerical' && (
        <div className="card">
          <div className="table-header">
            <div>
              <h3 className="table-title">Statistical Summary by Disease</h3>
              <p className="table-subtitle">Counts per disease within the selected filters</p>
            </div>
            <button className="btn-ghost btn-sm" onClick={applyFilters} disabled={loading}>
              <i className={`pi pi-refresh ${loading ? 'spin' : ''}`} /> Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('disease_name')} style={{ ...thStyle, minWidth: 180 }}>
                    Disease <SortIcon field="disease_name" />
                  </th>
                  <th onClick={() => handleSort('total_count')} style={{ ...thStyle, textAlign: 'right', width: 130 }}>
                    Total <SortIcon field="total_count" />
                  </th>
                  <th onClick={() => handleSort('this_month_count')} style={{ ...thStyle, textAlign: 'right', width: 140 }}>
                    This Month <SortIcon field="this_month_count" />
                  </th>
                  <th onClick={() => handleSort('submitted_count')} style={{ ...thStyle, textAlign: 'right', width: 130 }}>
                    Submitted <SortIcon field="submitted_count" />
                  </th>
                  <th onClick={() => handleSort('locked_count')} style={{ ...thStyle, textAlign: 'right', width: 110 }}>
                    Locked <SortIcon field="locked_count" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSummary.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">
                    <i className="pi pi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    No data matches the current filters.
                  </td></tr>
                ) : sortedSummary.map(row => (
                  <tr key={row.disease_name} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{row.disease_name}</span></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{row.total_count}</strong></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{row.this_month_count}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span className="badge-green">{row.submitted_count}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span className="badge-gray">{row.locked_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {sortedSummary.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--color-neutral-50)' }}>
                    <td style={tdStyle}><strong>Total</strong></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{summaryTotals.total}</strong></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{summaryTotals.thisMonth}</strong></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{summaryTotals.submitted}</strong></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><strong>{summaryTotals.locked}</strong></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Pharma-specific style overrides (disclaimer banner, 4 KPI cols, 2 filter cols) */}
      <style>{`
        .disclaimer-banner {
          display: flex; align-items: center; gap: 10px;
          background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
          padding: 12px 16px; color: #92400e; font-size: 13px; font-weight: 500;
        }
        .pharma-kpi-grid { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 1100px) { .pharma-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px)  { .pharma-kpi-grid { grid-template-columns: 1fr; } }
        .pharma-filter-grid { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 700px) { .pharma-filter-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

// ── Helper styles ──
const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 700,
  background: 'var(--color-neutral-50)',
  color: 'var(--color-neutral-600)',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
  color: 'var(--color-neutral-900)',
};

// ── KPI Card Component ──
function KpiCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: `${color}18`, color }}>
        <i className={`pi ${icon}`} aria-hidden="true" />
      </div>
      <div className="kpi-content">
        <span className="kpi-value">{value}</span>
        <span className="kpi-label">{title}</span>
      </div>
      <style>{`
        .kpi-icon {
          width: 56px; height: 56px; border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: var(--text-xl);
        }
        .kpi-content { display: flex; flex-direction: column; }
        .kpi-value { font-size: var(--text-xl); font-weight: var(--font-bold); color: var(--color-neutral-900); }
        .kpi-label { font-size: var(--text-sm); color: var(--color-neutral-600); }
      `}</style>
    </div>
  );
}

export default PharmaAnalyticsPage;
