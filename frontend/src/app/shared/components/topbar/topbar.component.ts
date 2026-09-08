import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <header class="topbar" role="banner">
      <div class="topbar-left">
        <button class="hamburger-btn" (click)="sidebarToggle.emit()"
                aria-label="Toggle sidebar">
          <i class="pi pi-bars" aria-hidden="true"></i>
        </button>
        <img src="assets/logo.png" alt="MEDRecords" class="brand-logo" />
      </div>

      <div class="topbar-right">
        <button class="theme-toggle" (click)="theme.toggle()"
                [attr.aria-label]="'Switch to ' + (theme.mode() === 'light' ? 'dark' : 'light') + ' mode'">
          <i [class]="theme.mode() === 'light' ? 'pi pi-moon' : 'pi pi-sun'" aria-hidden="true"></i>
        </button>
        <button class="notification-btn" aria-label="Notifications">
          <i class="pi pi-bell" aria-hidden="true"></i>
        </button>
        <div class="user-avatar">
          @if (auth.currentUser()) {
            <button class="user-menu-btn" aria-label="User menu">
              <i class="pi pi-user" aria-hidden="true"></i>
              <span class="user-name">{{ auth.currentUser()!.full_name }}</span>
            </button>
          }
          <p-button
            label="Logout"
            icon="pi pi-sign-out"
            severity="secondary"
            size="small"
            [attr.aria-label]="'Log out'"
            (onClick)="auth.logout()"
          />
        </div>
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      height: var(--topbar-height);
      background: var(--surface-card);
      border-bottom: 1px solid var(--color-neutral-200);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-5);
      box-shadow: var(--shadow-sm);
      position: sticky;
      top: 0;
      z-index: 100;
      flex-shrink: 0;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .hamburger-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      color: var(--color-neutral-600);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-out);
    }

    .hamburger-btn:hover {
      background: var(--color-neutral-100);
      color: var(--color-primary);
    }

    .brand-logo {
      height: 28px;
      width: auto;
      object-fit: contain;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .theme-toggle,
    .notification-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      color: var(--color-neutral-600);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-out);
    }

    .theme-toggle:hover,
    .notification-btn:hover {
      background: var(--color-neutral-100);
      color: var(--color-primary);
    }

    .user-avatar {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .user-menu-btn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      padding: var(--space-1) var(--space-2);
      color: var(--color-neutral-700);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-out);
    }

    .user-menu-btn:hover {
      background: var(--color-neutral-100);
    }

    .user-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-neutral-800);
    }
  `]
})
export class TopbarComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);

  @Output() sidebarToggle = new EventEmitter<void>();
}
