/**
 * Sidebar navigation component matching the Angular SidebarComponent.
 * Collapsible (240px / 64px), role-based navigation with sections.
 */

import { NavLink } from 'react-router-dom';
import { useAppSelector } from '@/app/store';

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
    ],
  },
  {
    heading: 'Insights',
    items: [
      { label: 'Analytics',   route: '/doctor/analytics',   icon: 'pi-chart-bar' },
      { label: 'Statistics',  route: '/doctor/statistics',  icon: 'pi-chart-line' },
    ],
  },
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
    ],
  },
];

const PHARMA_SECTIONS: NavSection[] = [
  {
    heading: 'Pharma',
    items: [
      { label: 'Analytics', route: '/pharma/analytics', icon: 'pi-chart-line' },
    ],
  },
];

const SYSADMIN_SECTIONS: NavSection[] = [
  {
    heading: 'System',
    items: [
      { label: 'Users',  route: '/sysadmin/users',  icon: 'pi-users' },
      { label: 'Config', route: '/sysadmin/config', icon: 'pi-cog' },
    ],
  },
];

function buildNavSections(role: string | null | undefined): NavSection[] {
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

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const user = useAppSelector((state) => state.auth.user);
  const navSections = buildNavSections(user?.role);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Wordmark */}
      <div className="sidebar-logo">
        <span className="brand-wordmark" style={{ fontSize: collapsed ? '1rem' : '1.25rem' }}>
          {collapsed ? 'M' : 'MEDRecords'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navSections.map((section) => (
          <div key={section.heading}>
            {!collapsed && <span className="section-heading">{section.heading}</span>}
            {section.items.map((item) => (
              <NavLink
                key={item.route}
                to={item.route}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <i className={`pi ${item.icon} nav-icon`} aria-hidden="true" />
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        className="collapse-btn"
        onClick={() => onCollapsedChange(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <i className={`pi ${collapsed ? 'pi-chevron-right' : 'pi-chevron-left'}`} aria-hidden="true" />
      </button>

      <style>{`
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
          flex-shrink: 0;
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
        .brand-wordmark {
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--color-primary);
          white-space: nowrap;
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
      `}</style>
    </aside>
  );
}
