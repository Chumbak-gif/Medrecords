import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi-card">
      <div class="kpi-icon" [style.background]="color + '18'" [style.color]="color">
        <i [class]="'pi ' + icon" aria-hidden="true"></i>
      </div>
      <div class="kpi-content">
        <span class="kpi-value">{{ value }}</span>
        <span class="kpi-label">{{ title }}</span>
      </div>
    </div>
  `,
  styles: [`
    .kpi-card {
      background: var(--surface-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-neutral-200);
      padding: var(--space-5);
      display: flex;
      align-items: center;
      gap: var(--space-4);
      transition: all var(--duration-normal) var(--ease-spring);
    }
    .kpi-card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .kpi-icon {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: var(--text-xl);
    }
    .kpi-content {
      display: flex;
      flex-direction: column;
    }
    .kpi-value {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--color-neutral-900);
    }
    .kpi-label {
      font-size: var(--text-sm);
      color: var(--color-neutral-600);
    }
  `]
})
export class KpiCardComponent {
  @Input() title: string = '';
  @Input() value: string | number = '';
  @Input() icon: string = '';
  @Input() color: string = 'var(--color-primary)';
}
