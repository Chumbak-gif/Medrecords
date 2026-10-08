/**
 * Topbar component matching the Angular TopbarComponent.
 * Contains: hamburger toggle, logo, theme toggle, notifications, user name, logout button.
 */

import { useEffect, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/store';
import { logout } from '@/features/authentication/store/authSlice';
import { markAllAsRead, markAsRead, clearAllNotifications } from '@/app/store/notificationsSlice';
import { useTheme } from '@/shared/hooks/useTheme';

interface TopbarProps {
  onSidebarToggle: () => void;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Topbar({ onSidebarToggle }: TopbarProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const notifications = useAppSelector((state) => state.notifications.items);
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const { mode, toggle } = useTheme();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
  };

  function toggleNotifications() {
    setNotifOpen((open) => {
      const next = !open;
      if (next && unreadCount > 0) dispatch(markAllAsRead());
      return next;
    });
    setUserMenuOpen(false);
  }

  return (
    <header className="topbar" role="banner">
      <div className="topbar-left">
        <button
          className="hamburger-btn"
          onClick={onSidebarToggle}
          aria-label="Toggle sidebar"
        >
          <i className="pi pi-bars" aria-hidden="true" />
        </button>
      </div>

      <div className="topbar-right">
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
        >
          <i className={mode === 'light' ? 'pi pi-moon' : 'pi pi-sun'} aria-hidden="true" />
        </button>
        <div className="notif-wrapper" ref={notifRef}>
          <button
            className="notification-btn"
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={notifOpen}
            onClick={toggleNotifications}
          >
            <i className="pi pi-bell" aria-hidden="true" />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {notifOpen && (
            <div className="popover notif-popover" role="menu">
              <div className="popover-header">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <button className="popover-link" onClick={() => dispatch(clearAllNotifications())}>Clear all</button>
                )}
              </div>
              <div className="popover-body">
                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <i className="pi pi-bell-slash" aria-hidden="true" />
                    <span>No notifications</span>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      className={`notif-item notif-${n.type}${n.read ? '' : ' notif-unread'}`}
                      onClick={() => dispatch(markAsRead(n.id))}
                    >
                      <span className={`notif-dot notif-dot-${n.type}`} aria-hidden="true" />
                      <span className="notif-content">
                        {n.title && <span className="notif-title">{n.title}</span>}
                        <span className="notif-message">{n.message}</span>
                        <span className="notif-time">{formatRelativeTime(n.timestamp)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="user-avatar" ref={userRef}>
          {user && (
            <button
              className="user-menu-btn"
              aria-label="User menu"
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
              onClick={() => { setUserMenuOpen((o) => !o); setNotifOpen(false); }}
            >
              <i className="pi pi-user" aria-hidden="true" />
              <span className="user-name">{user.fullName}</span>
              <i className="pi pi-angle-down" aria-hidden="true" style={{ fontSize: 12 }} />
            </button>
          )}
          {userMenuOpen && user && (
            <div className="popover user-popover" role="menu">
              <div className="user-popover-info">
                <span className="user-popover-name">{user.fullName}</span>
                {user.email && <span className="user-popover-email">{user.email}</span>}
                <span className="user-popover-role">{user.role?.replace('_', ' ')}</span>
              </div>
              <button className="user-popover-item" role="menuitem" onClick={handleLogout}>
                <i className="pi pi-sign-out" aria-hidden="true" /> Logout
              </button>
            </div>
          )}
          <button className="btn-secondary btn-sm" onClick={handleLogout} aria-label="Log out">
            <i className="pi pi-sign-out" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>

      <style>{`
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

        /* ── Notification badge ── */
        .notif-wrapper { position: relative; }
        .notif-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background: var(--color-primary, #ed1c24);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          line-height: 16px;
          text-align: center;
        }

        /* ── Popovers ── */
        .popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--surface-card);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 200;
          overflow: hidden;
        }
        .notif-popover { width: 340px; }
        .popover-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--color-neutral-200);
          font-size: 13px;
          font-weight: 700;
          color: var(--color-neutral-800);
        }
        .popover-link {
          border: none;
          background: transparent;
          color: var(--color-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .popover-body { max-height: 360px; overflow-y: auto; }
        .notif-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 32px 16px;
          color: var(--color-neutral-400);
          font-size: 13px;
        }
        .notif-empty i { font-size: 1.5rem; }
        .notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          border: none;
          border-bottom: 1px solid var(--color-neutral-100);
          background: transparent;
          cursor: pointer;
          transition: background var(--duration-fast) var(--ease-out);
        }
        .notif-item:hover { background: var(--color-neutral-50); }
        .notif-unread { background: var(--color-primary-50, #fef2f2); }
        .notif-dot {
          width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0;
        }
        .notif-dot-info { background: #3b82f6; }
        .notif-dot-success { background: #10b981; }
        .notif-dot-warning { background: #f59e0b; }
        .notif-dot-error { background: #ef4444; }
        .notif-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .notif-title { font-size: 13px; font-weight: 700; color: var(--color-neutral-800); }
        .notif-message { font-size: 13px; color: var(--color-neutral-700); }
        .notif-time { font-size: 11px; color: var(--color-neutral-400); }

        .user-popover { width: 200px; }
        .user-popover-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--color-neutral-200);
        }
        .user-popover-name { font-size: 13px; font-weight: 700; color: var(--color-neutral-800); }
        .user-popover-email {
          font-size: 11px;
          color: var(--color-neutral-500);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .user-popover-role { font-size: 12px; color: var(--color-neutral-500); text-transform: capitalize; }
        .user-popover-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: transparent;
          color: var(--color-neutral-700);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
        }
        .user-popover-item:hover { background: var(--color-neutral-50); color: var(--color-primary); }
      `}</style>
    </header>
  );
}
