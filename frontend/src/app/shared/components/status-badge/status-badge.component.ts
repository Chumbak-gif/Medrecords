import { Component, Input } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';

export type BadgeVariant =
  | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  | 'draft' | 'submitted' | 'error' | 'success' | 'warning' | 'info'
  | 'locked' | 'completed' | 'cancelled' | 'overdue' | 'expired'
  | string;

interface BadgeColorConfig {
  bg: string;
  text: string;
}

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  template: `
    <span class="badge" role="status"
          [style.--badge-bg]="colorMap[(status || '').toLowerCase()]?.bg || colorMap['default'].bg"
          [style.--badge-text]="colorMap[(status || '').toLowerCase()]?.text || colorMap['default'].text">
      {{ status | titlecase }}
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--badge-bg);
      color: var(--badge-text);
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: BadgeVariant = '';

  colorMap: Record<string, BadgeColorConfig> = {
    active:    { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    approved:  { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    completed: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    success:   { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
    pending:   { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
    warning:   { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
    overdue:   { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
    rejected:  { bg: 'var(--color-error-bg)',   text: 'var(--color-error-text)' },
    error:     { bg: 'var(--color-error-bg)',   text: 'var(--color-error-text)' },
    cancelled: { bg: 'var(--color-error-bg)',   text: 'var(--color-error-text)' },
    expired:   { bg: 'var(--color-error-bg)',   text: 'var(--color-error-text)' },
    draft:     { bg: 'var(--color-info-bg)',    text: 'var(--color-info-text)' },
    submitted: { bg: 'var(--color-info-bg)',    text: 'var(--color-info-text)' },
    info:      { bg: 'var(--color-info-bg)',    text: 'var(--color-info-text)' },
    locked:    { bg: 'var(--color-info-bg)',    text: 'var(--color-info-text)' },
    inactive:  { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' },
    default:   { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' },
  };
}
