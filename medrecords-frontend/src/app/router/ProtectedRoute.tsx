/**
 * ProtectedRoute component for route-level RBAC enforcement.
 *
 * Guards routes by checking:
 * 1. Authentication state — unauthenticated users are redirected to /login
 *    with the current URL preserved as a return path.
 * 2. Authorization — users lacking required permissions are redirected
 *    to /unauthorized with history replacement (no back-button access).
 *
 * @see requirements.md — Requirements 3.3, 3.9
 */

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import type { Permission } from '@/shared/types/common';
import type { AuthState } from '@/shared/types/auth';
import { ROUTES } from '@/shared/constants/routes';
import { hasAnyPermission, hasAllPermissions } from '@/core/security/rbac';

/**
 * Minimal RootState type for the auth slice selector.
 * The full RootState will be defined when the Redux store is configured (task 7.1).
 */
interface RootState {
  auth: AuthState;
}

export interface ProtectedRouteProps {
  /** Single permission or array of permissions required to access the route. */
  permission: Permission | Permission[];
  /** When true with multiple permissions, all must be satisfied. Defaults to false (any one sufficient). */
  requireAll?: boolean;
  /** The content to render when the user is authenticated and authorized. */
  children: ReactNode;
}

/**
 * ProtectedRoute guards a route behind authentication and RBAC permission checks.
 *
 * Behavior:
 * - Unauthenticated → Navigate to /login with returnUrl query parameter
 * - Authenticated but unauthorized → Navigate to /unauthorized (replaces history)
 * - Authenticated and authorized → Render children
 */
export function ProtectedRoute({
  permission,
  requireAll = false,
  children,
}: ProtectedRouteProps): ReactNode {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  // Unauthenticated users are redirected to login with the return URL
  if (!isAuthenticated || !user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.LOGIN}?returnUrl=${returnUrl}`} />;
  }

  // Determine if user has the required permission(s)
  const permissions = Array.isArray(permission) ? permission : [permission];
  const isAuthorized = requireAll
    ? hasAllPermissions(user, permissions)
    : hasAnyPermission(user, permissions);

  // Unauthorized users are redirected to /unauthorized with history replacement
  if (!isAuthorized) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return <>{children}</>;
}
