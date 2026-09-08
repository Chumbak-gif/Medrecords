/**
 * User management feature route definitions.
 *
 * Only accessible to admin users (users:manage permission).
 * Requirements: 7.1
 */

import { ROUTES } from '@/shared/constants/routes';

export const userManagementRoutes = {
  path: ROUTES.USERS,
  page: 'UserManagementPage',
  permission: { resource: 'users', action: 'manage' as const },
};
