/**
 * usePermission Hook
 *
 * Memoized permission check hook that returns access status, loading state,
 * and the current user. Supports both single and array permissions with a
 * requireAll option.
 *
 * @see requirements.md — Requirements 3.4, 3.5, 3.6
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import type { Permission } from '@/shared/types/common';
import type { AuthState, UserProfile } from '@/shared/types/auth';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '@/core/security/rbac';

/**
 * Minimal RootState shape required by usePermission.
 * The full RootState will be defined when the Redux store is configured (task 7.1).
 */
interface RootState {
  auth: AuthState;
}

export interface UsePermissionOptions {
  /** When true, ALL permissions are required. When false/omitted, ANY one is sufficient. */
  requireAll?: boolean;
}

export interface UsePermissionResult {
  /** Whether the current user has the required permission(s). */
  hasAccess: boolean;
  /** Whether the auth state is currently loading (e.g., refreshing token). */
  isLoading: boolean;
  /** The current authenticated user, or null if not authenticated. */
  user: UserProfile | null;
}

/**
 * Hook that checks whether the current user holds the specified permission(s).
 *
 * @param permission - A single Permission or array of Permissions to check.
 * @param options - Optional configuration (requireAll).
 * @returns Memoized result with hasAccess, isLoading, and user.
 *
 * @example
 * // Single permission check
 * const { hasAccess } = usePermission({ resource: 'patients', action: 'read' });
 *
 * @example
 * // Multiple permissions with requireAll
 * const { hasAccess, isLoading } = usePermission(
 *   [{ resource: 'patients', action: 'read' }, { resource: 'patients', action: 'update' }],
 *   { requireAll: true }
 * );
 */
export function usePermission(
  permission: Permission | Permission[],
  options?: UsePermissionOptions
): UsePermissionResult {
  const user = useSelector((state: RootState) => state.auth.user);
  const isLoading = useSelector((state: RootState) => state.auth.isLoading);
  const requireAll = options?.requireAll ?? false;

  const hasAccess = useMemo(() => {
    // If user is null (not authenticated), deny access
    if (!user) {
      return false;
    }

    // Normalize to array
    const permissions: Permission[] = Array.isArray(permission)
      ? permission
      : [permission];

    // Empty permissions array → grant access unconditionally
    if (permissions.length === 0) {
      return true;
    }

    // Single permission → use hasPermission directly
    if (permissions.length === 1) {
      return hasPermission(user, permissions[0]);
    }

    // Multiple permissions → requireAll determines the check
    if (requireAll) {
      return hasAllPermissions(user, permissions);
    }

    return hasAnyPermission(user, permissions);
  }, [user, permission, requireAll]);

  return { hasAccess, isLoading, user };
}
