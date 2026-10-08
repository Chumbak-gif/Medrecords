/**
 * Statistics Page - Patient Statistics with numeric and categorical analysis.
 * Matches Angular StatisticsComponent.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

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

const BUBBLE_COLORS = [
  '#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

const apiClient = createTypedApiClient();

export function StatisticsPage() {
  const [statistics, setStatistics] = useState<PatientStatistics | null>(null);
  const [diseaseOptions, setDiseaseOptions] = useState<DiseaseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<number | ''>('');
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const loadDiseaseOptions = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await apiClient.get<{ items: DiseaseOption[]; total: number }>(
        '/diseases/?page_size=100',
        { signal },
      );
      setDiseaseOptions(res.data.items ?? []);
    } catch { /* non-critical (including abort) */ }
  }, []);

  const loadStatistics = useCallback(async (diseaseId?: number, signal?: AbortSignal) => {
    setLoading(true);
    try {
      let url = '/analytics/patient-statistics';
      if (diseaseId) {
        url += `?disease_id=${diseaseId}`;
      }
      const res = await apiClient.get<PatientStatistics>(url, { signal });
      setStatistics(res.data);
    } catch {
      /* handled (including abort — avoid flipping loading off on a cancelled request) */
      if (signal?.aborted) return;
    }
    setLoading(false);
  }, []);

  // Initial load — aborts in-flight requests on unmount so a fast
  // mount/unmount/remount cycle (e.g. React StrictMode in dev, or rapid
  // tab-switching) never races a stale response into state.
  useEffect(() => {
    const controller = new AbortController();
    loadDiseaseOptions(controller.signal);
    loadStatistics(undefined, controller.signal);
    return () => controller.abort();
  }, [loadDiseaseOptions, loadStatistics]);

  // Render bubble charts when statistics change
  useEffect(() => {
    if (!statistics?.categorical_stats?.length) return;
    const timer = setTimeout(() => {
      statistics.categorical_stats.forEach((cat, idx) => {
        const canvas = canvasRefs.current.get(idx);
        if (canvas) {
          renderBubbleChart(canvas, cat.categories);
        }
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [statistics]);

  function onDiseaseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedDiseaseId(val ? Number(val) : '');
    loadStatistics(val ? Number(val) : undefined, undefined);
  }

  function renderBubbleChart(canvas: HTMLCanvasElement, categories: CategoryCount[]) {
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
    const padding = maxRadius + 10;
    const availableW = W - padding * 2;
    const step = categories.length > 1 ? availableW / (categories.length - 1) : 0;

    categories.forEach((cat, i) => {
      const ratio = cat.count / maxCount;
      const radius = minRadius + ratio * (maxRadius - minRadius);
      const x = categories.length === 1 ? W / 2 : padding + i * step;
      const y = H / 2 - 6;
      const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color + '33';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(11, Math.round(radius * 0.45))}px Poppins, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cat.count), x, y);

      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = cat.label.length > 14 ? cat.label.substring(0, 12) + '…' : cat.label;
      ctx.fillText(label, x, y + radius + 6);
    });
  }

  function formatFieldName(field: string): string {
    return field
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Patient Statistics</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Numeric and categorical analysis of assessment form data across patients.
          </p>
        </div>
      </div>

      {/* Disease Filter */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Filter by Disease</label>
          <select
            className="form-control"
            style={{ width: 300 }}
            value={selectedDiseaseId}
            onChange={onDiseaseChange}
          >
            <option value="">All diseases</option>
            {diseaseOptions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Numeric Statistics Table */}
      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-900)' }}>
            <i className="pi pi-calculator" style={{ marginRight: 8, color: '#06b6d4' }} />
            Numeric Statistics
          </h3>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Mean, Median, and Range for numeric fields</span>
        </div>

        {loading ? (
          <div style={{ height: 200, background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-md)' }} />
        ) : !statistics?.numeric_stats?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', color: 'var(--color-neutral-400)', fontSize: 14, gap: 8 }}>
            <i className="pi pi-inbox" style={{ fontSize: '2rem' }} />
            <span>No numeric data available for the current filter.</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Title</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>Mean</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>Median</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 180 }}>Range</th>
              </tr>
            </thead>
            <tbody>
              {statistics.numeric_stats.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-neutral-100)', background: idx % 2 === 1 ? 'var(--color-neutral-50)' : undefined }}>
                  <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--color-neutral-900)' }}>{row.title}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.mean}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.median}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 4, background: '#ecfeff', color: '#0e7490', fontSize: 12, fontWeight: 600 }}>
                      {row.range_min} – {row.range_max}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Categorical Statistics */}
      {!loading && statistics?.categorical_stats?.length ? (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-900)' }}>
              <i className="pi pi-chart-bar" style={{ marginRight: 8, color: '#8b5cf6' }} />
              Categorical Statistics
            </h3>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Distribution of categorical fields</span>
          </div>
          {statistics.categorical_stats.map((cat, idx) => (
            <div key={idx} style={{ marginBottom: 28, paddingBottom: 20, borderBottom: idx < statistics.categorical_stats.length - 1 ? '1px solid var(--color-neutral-100)' : 'none' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-neutral-800)', textTransform: 'capitalize' }}>
                {formatFieldName(cat.field)}
              </h4>
              <div style={{ position: 'relative', height: 120, width: '100%' }}>
                <canvas
                  ref={(el) => { if (el) canvasRefs.current.set(idx, el); }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--color-neutral-50)',
  color: 'var(--color-neutral-600)',
  textAlign: 'left',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};

export default StatisticsPage;
