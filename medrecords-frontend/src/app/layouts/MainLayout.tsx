/**
 * Main Application Shell layout matching the Angular AppShell.
 * Flex container: Sidebar (left) + Main area (right).
 * Main area: Topbar (top) + Content (scrollable).
 */

import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="app-shell">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <div className="app-main">
          <Topbar onSidebarToggle={() => setSidebarCollapsed(v => !v)} />
          <main id="main-content" className="app-content" role="main">
            {children || <Outlet />}
          </main>
        </div>
      </div>

      <style>{`
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
      `}</style>
    </>
  );
}

export default MainLayout;
