/**
 * System Config Page - Platform-wide settings with inline editing.
 * Matches Angular SystemConfigComponent.
 */

import { useState, useEffect, useCallback } from 'react';
import { createTypedApiClient } from '@/shared/services/api/apiClient';

interface AppConfig {
  id: number;
  config_key: string;
  config_value: string;
}

/** Human-readable labels and notes for known config keys */
const CONFIG_META: Record<string, { label: string; note?: string }> = {
  lock_window_hours: {
    label: 'Lock Window Hours',
    note: 'Hours after submission before assessment locks',
  },
};

const apiClient = createTypedApiClient();

export function SystemConfigPage() {
  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const showToast = (type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<AppConfig[]>('/config/');
      setConfigs(res.data);
    } catch {
      showToast('error', 'Failed to load configuration');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  function startEdit(cfg: AppConfig) {
    setEditingKey(cfg.config_key);
    setEditingValue(cfg.config_value);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditingValue('');
  }

  async function saveConfig(cfg: AppConfig) {
    if (editingValue.trim() === '') {
      showToast('error', 'Value cannot be empty');
      return;
    }
    if (editingValue.trim() === cfg.config_value) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.patch<AppConfig>(`/config/${cfg.config_key}`, { value: editingValue.trim() });
      setConfigs(prev => prev.map(c => c.config_key === res.data.config_key ? res.data : c));
      showToast('success', `"${cfg.config_key}" updated to "${res.data.config_value}"`);
      cancelEdit();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast('error', detail ?? 'Save failed');
    }
    setSaving(false);
  }

  function getConfigLabel(key: string): string {
    return CONFIG_META[key]?.label ?? '';
  }

  function getConfigNote(key: string): string | undefined {
    return CONFIG_META[key]?.note;
  }

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>System Configuration</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-600)', fontSize: 13 }}>
            Platform-wide settings — click a value to edit inline
          </p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '1.5rem' }} />
            <p style={{ marginTop: 8, fontSize: 13 }}>Loading configuration…</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, minWidth: 220 }}>Configuration Key</th>
                <th style={{ ...thStyle, minWidth: 280 }}>Value</th>
                <th style={{ ...thStyle, width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--color-neutral-400)' }}>
                    <i className="pi pi-cog" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }} />
                    No configuration keys found.
                  </td>
                </tr>
              ) : (
                configs.map(cfg => (
                  <tr key={cfg.config_key} style={{ borderBottom: '1px solid var(--color-neutral-100)' }}>
                    <td style={tdStyle}>
                      <div>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>
                          {cfg.config_key}
                        </span>
                        {getConfigLabel(cfg.config_key) && (
                          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                            {getConfigLabel(cfg.config_key)}
                          </div>
                        )}
                        {getConfigNote(cfg.config_key) && (
                          <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2, fontStyle: 'italic' }}>
                            {getConfigNote(cfg.config_key)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {editingKey === cfg.config_key ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="text"
                            className="form-control"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveConfig(cfg);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            style={{ maxWidth: 240, width: '100%' }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>
                          {cfg.config_value}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {editingKey === cfg.config_key ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-icon btn-icon-success" title="Save" disabled={saving} onClick={() => saveConfig(cfg)}>
                            <i className="pi pi-check" />
                          </button>
                          <button className="btn-icon" title="Cancel" onClick={cancelEdit}>
                            <i className="pi pi-times" />
                          </button>
                        </div>
                      ) : (
                        <button className="btn-icon" title="Edit value" onClick={() => startEdit(cfg)}>
                          <i className="pi pi-pencil" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'left',
  color: 'var(--color-neutral-600)',
  borderBottom: '1px solid var(--color-neutral-200)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
};

export default SystemConfigPage;
