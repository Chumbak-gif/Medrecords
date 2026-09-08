/**
 * Dashboard feature route definitions.
 *
 * Requirements: 7.1
 */

import { ROUTES } from '@/shared/constants/routes';

export const dashboardRoutes = {
  path: ROUTES.DASHBOARD,
  page: 'DashboardPage',
  // Dashboard is accessible to all authenticated users
  permission: { resource: 'patients', action: 'read' as const },
};
