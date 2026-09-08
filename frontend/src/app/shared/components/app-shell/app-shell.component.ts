import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="app-shell">
      <app-sidebar
        [collapsed]="sidebarCollapsed()"
        (collapsedChange)="sidebarCollapsed.set($event)"
      />
      <div class="app-main">
        <app-topbar (sidebarToggle)="toggleSidebar()" />
        <main id="main-content" class="app-content" role="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .skip-link {
      position: absolute;
      top: -100%;
      left: var(--space-4);
      padding: var(--space-2) var(--space-4);
      background: var(--color-primary);
      color: white;
      border-radius: var(--radius-md);
      z-index: 9999;
      transition: top var(--duration-fast) var(--ease-out);
    }

    .skip-link:focus {
      top: var(--space-2);
    }

    .app-shell {
      display: flex;
      min-height: 100vh;
    }

    .app-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      max-width: 1600px;
    }

    .app-content {
      padding: var(--space-6);
      flex: 1;
      overflow-y: auto;
    }
  `]
})
export class AppShellComponent {
  sidebarCollapsed = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }
}
