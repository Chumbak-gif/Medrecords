/**
 * RBAC Permission matrix mapping each UserRole to permitted resource-action pairs.
 * This is the single source of truth for authorization decisions.
 *
 * @see design.md — RBAC Permission Resolution Algorithm
 */
import type { Permission } from '@/shared/types/common';

/**
 * A read-only map of roles to their permitted resource-action pairs.
 */
export type RolePermissionMap = Readonly<Record<string, readonly Permission[]>>;

/**
 * The immutable ROLE_PERMISSIONS matrix.
 * Admin has wildcard access; other roles have explicit grants.
 */
export const ROLE_PERMISSIONS: RolePermissionMap = Object.freeze({
  admin: Object.freeze([
    { resource: '*', action: 'manage' },
  ] as const),

  sys_admin: Object.freeze([
    { resource: '*', action: 'manage' },
  ] as const),

  doctor: Object.freeze([
    { resource: 'patients', action: 'read' },
    { resource: 'patients', action: 'create' },
    { resource: 'patients', action: 'update' },
    { resource: 'assessments', action: 'read' },
    { resource: 'assessments', action: 'create' },
    { resource: 'assessments', action: 'update' },
    { resource: 'prescriptions', action: 'create' },
    { resource: 'prescriptions', action: 'read' },
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'export' },
  ] as const),

  nurse: Object.freeze([
    { resource: 'patients', action: 'read' },
    { resource: 'patients', action: 'create' },
    { resource: 'assessments', action: 'read' },
    { resource: 'followups', action: 'read' },
    { resource: 'followups', action: 'create' },
  ] as const),

  receptionist: Object.freeze([
    { resource: 'patients', action: 'read' },
    { resource: 'patients', action: 'create' },
  ] as const),

  auditor: Object.freeze([
    { resource: 'audit', action: 'read' },
    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'export' },
  ] as const),
});
