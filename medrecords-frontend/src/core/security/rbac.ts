/**
 * RBAC Authorization Engine
 *
 * Implements the Permission Resolution Algorithm as defined in the design document:
 * 1. Wildcard resource ('*') with 'manage' action grants everything (admin).
 * 2. 'manage' action on a specific resource grants all actions for that resource.
 * 3. Otherwise an exact resource + action match is required.
 * 4. Undefined roles receive an empty permission set (deny all).
 *
 * @see design.md — RBAC Permission Resolution Algorithm
 * @see requirements.md — Requirements 3.1, 3.2, 3.7
 */

import type { Permission } from '@/shared/types/common';
import type { UserProfile } from '@/shared/types/auth';
import { ROLE_PERMISSIONS } from './permissions';

/**
 * Retrieve the permissions array for a given role.
 * Returns an empty array for undefined/unknown roles (deny all).
 */
export function getPermissionsForRole(role: string): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check whether a user holds a single required permission.
 *
 * Resolution order:
 * 1. Wildcard resource with 'manage' → grants everything.
 * 2. Matching resource with 'manage' → grants all actions on that resource.
 * 3. Exact resource + action match.
 */
export function hasPermission(user: UserProfile, required: Permission): boolean {
  const userPermissions = getPermissionsForRole(user.role);

  return userPermissions.some((perm) => {
    // Wildcard resource with manage action grants everything
    if (perm.resource === '*' && perm.action === 'manage') {
      return true;
    }

    // Resource must match for non-wildcard checks
    if (perm.resource !== required.resource) {
      return false;
    }

    // 'manage' action on a specific resource grants all actions for that resource
    if (perm.action === 'manage') {
      return true;
    }

    // Exact action match
    return perm.action === required.action;
  });
}

/**
 * Check whether a user holds at least one of the specified permissions.
 * Returns true if the user satisfies any single permission in the array.
 * Returns true for an empty permissions array (no restriction).
 */
export function hasAnyPermission(user: UserProfile, permissions: Permission[]): boolean {
  if (permissions.length === 0) {
    return true;
  }
  return permissions.some((perm) => hasPermission(user, perm));
}

/**
 * Check whether a user holds all of the specified permissions.
 * Returns true only if the user satisfies every permission in the array.
 * Returns true for an empty permissions array (no restriction).
 */
export function hasAllPermissions(user: UserProfile, permissions: Permission[]): boolean {
  if (permissions.length === 0) {
    return true;
  }
  return permissions.every((perm) => hasPermission(user, perm));
}
