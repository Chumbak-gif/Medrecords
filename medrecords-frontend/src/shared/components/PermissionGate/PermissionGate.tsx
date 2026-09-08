/**
 * PermissionGate Component
 *
 * Declarative access control component that conditionally renders children
 * based on the current user's permissions.
 *
 * - Renders children unconditionally if permissions array is empty.
 * - Renders nothing (null) when user is unauthenticated or lacks required permissions.
 * - Supports both single permission and multiple permissions with requireAll logic.
 *
 * @see requirements.md — Requirements 3.4, 3.5, 3.6, 3.8
 */

import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';

import type { Permission } from '@/shared/types/common';
import type { AuthState } from '@/shared/types/auth';
import { hasAnyPermission, hasAllPermissions } from '@/core/security/rbac';

/**
 * Minimal RootState shape required by PermissionGate.
 * The full RootState will be defined when the Redux store is configured (task 7.1).
 */
interface RootState {
  auth: AuthState;
}

export interface PermissionGateProps {
  /** Single permission or array of permissions to check. */
  permission: Permission | Permission[];
  /** When true, ALL permissions are required. When false/omitted, ANY one is sufficient. */
  requireAll?: boolean;
  /** Content to render when the user has the required permission(s). */
  children: ReactNode;
}

/**
 * PermissionGate renders its children only if the current user holds the
 * required permission(s). When access is denied, it renders nothing (null).
 */
export function PermissionGate({
  permission,
  requireAll = false,
  children,
}: PermissionGateProps): ReactNode {
  const user = useSelector((state: RootState) => state.auth.user);

  // Normalize to array
  const permissions: Permission[] = Array.isArray(permission) ? permission : [permission];

  // Empty permissions array → render unconditionally (Requirement 3.8)
  if (permissions.length === 0) {
    return children;
  }

  // If user is null (not authenticated), render nothing
  if (!user) {
    return null;
  }

  // Check permissions based on requireAll flag
  const hasAccess = requireAll
    ? hasAllPermissions(user, permissions) // Requirement 3.5
    : hasAnyPermission(user, permissions); // Requirement 3.6

  if (!hasAccess) {
    return null;
  }

  return children;
}
