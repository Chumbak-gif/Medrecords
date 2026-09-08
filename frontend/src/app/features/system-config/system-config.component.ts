import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';

const API = environment.apiBaseUrl;

export interface AppConfig {
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

@Component({
  selector: 'app-system-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    TooltipModule,
    TagModule,
  ],
  providers: [MessageService],
  styles: [`
    .config-note {
      font-size: 11px;
      color: var(--color-neutral-500);
      margin-top: 2px;
      font-style: italic;
    }
    .inline-edit-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    :host ::ng-deep .p-datatable .p-datatable-tbody > tr > td { padding: 12px 14px; }
    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th { padding: 10px 14px; font-size: 12px; font-weight: 700; }
  `],
  template: `
    <p-toast />

    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700">System Configuration</h2>
        <p style="margin:4px 0 0;color:var(--color-neutral-600);font-size:13px">
          Platform-wide settings — click a value to edit inline
        </p>
      </div>
    </div>

    <div class="card">
      @if (loading()) {
        <div style="text-align:center;padding:40px;color:var(--color-neutral-400)">
          <i class="pi pi-spin pi-spinner" style="font-size:1.5rem"></i>
          <p style="margin-top:8px;font-size:13px">Loading configuration…</p>
        </div>
      } @else {
        <p-table [value]="configs()" dataKey="config_key" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="min-width:220px">Configuration Key</th>
              <th style="min-width:280px">Value</th>
              <th style="width:130px">Actions</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-cfg>
            <tr>
              <td>
                <div>
                  <span style="font-weight:600;font-family:monospace;font-size:13px">
                    {{ cfg.config_key }}
                  </span>
                  @if (getConfigLabel(cfg.config_key)) {
                    <div style="font-size:12px;color:var(--color-neutral-500);margin-top:2px">
                      {{ getConfigLabel(cfg.config_key) }}
                    </div>
                  }
                  @if (getConfigNote(cfg.config_key)) {
                    <div class="config-note">{{ getConfigNote(cfg.config_key) }}</div>
                  }
                </div>
              </td>
              <td>
                @if (editingKey === cfg.config_key) {
                  <div class="inline-edit-row">
                    <input pInputText type="text"
                      [(ngModel)]="editingValue"
                      [style]="{'max-width':'240px','width':'100%'}"
                      (keydown.enter)="saveConfig(cfg)"
                      (keydown.escape)="cancelEdit()"
                      #editInput />
                  </div>
                } @else {
                  <span style="font-size:14px;color:var(--color-neutral-800)">
                    {{ cfg.config_value }}
                  </span>
                }
              </td>
              <td>
                @if (editingKey === cfg.config_key) {
                  <div style="display:flex;gap:6px">
                    <button type="button" pButton icon="pi pi-check"
                      class="p-button-text p-button-sm p-button-success"
                      pTooltip="Save" tooltipPosition="top"
                      [disabled]="saving()"
                      (click)="saveConfig(cfg)"></button>
                    <button type="button" pButton icon="pi pi-times"
                      class="p-button-text p-button-sm p-button-secondary"
                      pTooltip="Cancel" tooltipPosition="top"
                      (click)="cancelEdit()"></button>
                  </div>
                } @else {
                  <button type="button" pButton icon="pi pi-pencil"
                    class="p-button-text p-button-sm p-button-secondary"
                    pTooltip="Edit value" tooltipPosition="top"
                    (click)="startEdit(cfg)"></button>
                }
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="3" style="text-align:center;padding:40px;color:var(--color-neutral-400)">
                <i class="pi pi-cog" style="font-size:2rem;display:block;margin-bottom:8px"></i>
                No configuration keys found.
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </div>
  `,
})
export class SystemConfigComponent implements OnInit {
  private http = inject(HttpClient);
  private messageService = inject(MessageService);

  configs = signal<AppConfig[]>([]);
  loading = signal(false);
  saving = signal(false);

  editingKey: string | null = null;
  editingValue = '';

  ngOnInit(): void {
    this.loadConfigs();
  }

  getConfigLabel(key: string): string {
    return CONFIG_META[key]?.label ?? '';
  }

  getConfigNote(key: string): string {
    return CONFIG_META[key]?.note ?? '';
  }

  loadConfigs(): void {
    this.loading.set(true);
    this.http.get<AppConfig[]>(`${API}/api/v1/config/`).subscribe({
      next: (items) => {
        this.configs.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load configuration' });
        this.loading.set(false);
      },
    });
  }

  startEdit(cfg: AppConfig): void {
    this.editingKey = cfg.config_key;
    this.editingValue = cfg.config_value;
  }

  cancelEdit(): void {
    this.editingKey = null;
    this.editingValue = '';
  }

  saveConfig(cfg: AppConfig): void {
    if (this.editingValue.trim() === '') {
      this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Value cannot be empty' });
      return;
    }
    if (this.editingValue.trim() === cfg.config_value) {
      this.cancelEdit();
      return;
    }
    this.saving.set(true);
    const payload = { value: this.editingValue.trim() };

    this.http.patch<AppConfig>(`${API}/api/v1/config/${cfg.config_key}`, payload).subscribe({
      next: (updated) => {
        this.configs.update(list =>
          list.map(c => c.config_key === updated.config_key ? updated : c)
        );
        this.messageService.add({
          severity: 'success', summary: 'Saved',
          detail: `"${cfg.config_key}" updated to "${updated.config_value}"`,
        });
        this.cancelEdit();
        this.saving.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.detail ?? 'Save failed' });
        this.saving.set(false);
      },
    });
  }
}
