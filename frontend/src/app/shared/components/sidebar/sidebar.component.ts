import { Component, inject, effect, Output, EventEmitter, Input, OnInit, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const DOCTOR_SECTIONS: NavSection[] = [
  {
    heading: 'Clinical',
    items: [
      { label: 'Dashboard',      route: '/doctor/dashboard',        icon: 'pi-home' },
      { label: 'Patients',       route: '/doctor/patients',         icon: 'pi-users' },
      { label: 'Follow-ups',     route: '/doctor/followups',        icon: 'pi-calendar' },
      { label: 'New Assessment', route: '/doctor/assessments/new',  icon: 'pi-file-edit' },
    ]
  }
];

const ADMIN_SECTIONS: NavSection[] = [
  {
    heading: 'Administration',
    items: [
      { label: 'Analytics',   route: '/admin/analytics',   icon: 'pi-chart-bar' },
      { label: 'Statistics',  route: '/admin/statistics',  icon: 'pi-chart-line' },
      { label: 'Patients',    route: '/admin/patients',    icon: 'pi-users' },
      { label: 'Diseases',    route: '/admin/diseases',    icon: 'pi-heart' },
      { label: 'Templates',   route: '/admin/templates',   icon: 'pi-file' },
      { label: 'Doctors',     route: '/admin/doctors',     icon: 'pi-user' },
      { label: 'Audit Log',   route: '/admin/audit',       icon: 'pi-list' },
    ]
  }
];

const PHARMA_SECTIONS: NavSection[] = [
  {
    heading: 'Pharma',
    items: [
      { label: 'Analytics', route: '/pharma/analytics', icon: 'pi-chart-line' },
    ]
  }
];

const SYSADMIN_SECTIONS: NavSection[] = [
  {
    heading: 'System',
    items: [
      { label: 'Users',  route: '/sysadmin/users',  icon: 'pi-users' },
      { label: 'Config', route: '/sysadmin/config', icon: 'pi-cog' },
    ]
  }
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TooltipModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed">
      <!-- Logo -->
      <div class="sidebar-logo">
        <img src="assets/logo.png" alt="MEDRecords Logo"
          [style.height]="collapsed ? '28px' : '36px'"
          [style.object-fit]="'contain'" />
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav" aria-label="Primary navigation">
        @for (section of navSections; track section.heading) {
          @if (!collapsed) {
            <span class="section-heading">{{ section.heading }}</span>
          }
          @for (item of section.items; track item.route) {
            <a [routerLink]="item.route" routerLinkActive="nav-link-active"
               class="nav-link"
               [pTooltip]="collapsed ? item.label : ''"
               tooltipPosition="right"
               [tooltipDisabled]="!collapsed">
              <i [class]="'pi ' + item.icon" class="nav-icon" aria-hidden="true"></i>
              @if (!collapsed) { <span class="nav-label">{{ item.label }}</span> }
            </a>
          }
        }
      </nav>

      <!-- Collapse toggle (bottom button) -->
      <button class="collapse-btn" (click)="toggleCollapse()"
              [attr.aria-label]="collapsed ? 'Expand sidebar' : 'Collapse sidebar'">
        <i [class]="'pi ' + (collapsed ? 'pi-chevron-right' : 'pi-chevron-left')" aria-hidden="true"></i>
      </button>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .sidebar {
      width: var(--sidenav-width, 240px);
      height: 100vh;
      position: sticky;
      top: 0;
      background: var(--surface-card);
      border-right: 1px solid var(--color-neutral-200);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width var(--duration-normal) var(--ease-out);
      box-shadow: var(--shadow-sm);
    }

    .sidebar.collapsed {
      width: var(--sidenav-width-collapsed, 64px);
    }

    .sidebar-logo {
      height: var(--topbar-height, 56px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 var(--space-3);
      border-bottom: 1px solid var(--color-neutral-200);
      flex-shrink: 0;
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--space-3) var(--space-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .section-heading {
      font-size: 11px;
      font-weight: var(--font-bold);
      color: var(--color-neutral-500);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: var(--space-2) var(--space-3);
      margin-top: var(--space-2);
    }

    .section-heading:first-child {
      margin-top: 0;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      color: var(--color-neutral-600);
      font-size: var(--text-base);
      font-weight: var(--font-medium);
      text-decoration: none;
      transition: all var(--duration-fast) var(--ease-out);
      white-space: nowrap;
      position: relative;
    }

    .nav-link:hover {
      background: var(--color-primary-50);
      color: var(--color-primary);
    }

    .nav-link-active {
      background: var(--color-primary-50);
      color: var(--color-primary);
      font-weight: var(--font-semibold);
      border-left: 3px solid var(--color-primary);
    }

    .nav-link:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .nav-icon {
      font-size: var(--text-xl);
      flex-shrink: 0;
      width: 20px;
      text-align: center;
    }

    .nav-label {
      font-size: var(--text-base);
      font-weight: var(--font-medium);
    }

    .collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: var(--space-2);
      padding: var(--space-2);
      border: 1px solid var(--color-neutral-200);
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-neutral-500);
      cursor: pointer;
      transition: all var(--duration-fast) var(--ease-out);
      flex-shrink: 0;
    }

    .collapse-btn:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: var(--color-primary-50);
    }

    .collapse-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  `]
})
export class SidebarComponent implements OnInit {
  auth = inject(AuthService);
  router = inject(Router);
  private injector = inject(Injector);

  /** Controlled externally by AppShell (hamburger) or internally by collapse button */
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  userRole: string | null = null;
  navSections: NavSection[] = [];

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  ngOnInit(): void {
    // Trigger profile load if not yet loaded (handles page refresh)
    if (this.auth.getToken() && !this.auth.currentUser()) {
      this.auth.loadProfile();
    }
    // React to signal changes and update local property for reliable change detection
    effect(() => {
      this.userRole = this.auth.currentUser()?.role ?? null;
      this.navSections = this.buildNavSections(this.userRole);
    }, { injector: this.injector });
  }

  private buildNavSections(role: string | null): NavSection[] {
    const sections: NavSection[] = [];

    if (role === 'doctor') {
      sections.push(...DOCTOR_SECTIONS);
    }

    if (role === 'admin' || role === 'sys_admin') {
      sections.push(...ADMIN_SECTIONS);
    }

    if (role === 'pharma_viewer') {
      sections.push(...PHARMA_SECTIONS);
    }

    if (role === 'sys_admin') {
      sections.push(...SYSADMIN_SECTIONS);
    }

    return sections;
  }
}
