/**
 * RBAC Permission definitions for the core security module.
 *
 * Re-exports the immutable ROLE_PERMISSIONS matrix from the shared constants layer.
 * This indirection keeps the core security module self-contained while
 * maintaining a single source of truth in `@/shared/constants/permissions`.
 */

export { ROLE_PERMISSIONS } from '@/shared/constants/permissions';
export type { RolePermissionMap } from '@/shared/constants/permissions';
