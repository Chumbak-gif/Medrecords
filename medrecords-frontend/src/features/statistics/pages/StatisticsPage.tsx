/**
 * Statistics Page - Patient Statistics (numeric analysis).
 * Matches Angular StatisticsComponent.
 */

import { useState, useEffect, useCallback } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NumericStatRow {
  title: string;
  mean: number;
  median: number;
  range_min: number;
  range_max: number;
}

interface PatientStatistics {
  numeric_stats: NumericStatRow[];
}

interface DiseaseOption {
  id: number;
  name: string;
}

const apiClient = createTypedApiClient();

export function StatisticsPage() {
  const [statistics, setStatistics] = useState<PatientStatistics | null>(null);
  const [diseaseOptions, setDiseaseOptions] = useState<DiseaseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<number | ''>('');

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

  function onDiseaseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedDiseaseId(val ? Number(val) : '');
    loadStatistics(val ? Number(val) : undefined, undefined);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Patient Statistics</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Numeric analysis of assessment form data across patients.
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
