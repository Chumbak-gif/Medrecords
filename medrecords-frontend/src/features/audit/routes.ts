/**
 * Audit feature route definitions.
 *
 * Requirements: 7.1
 */

import { ROUTES } from '@/shared/constants/routes';

export const auditRoutes = {
  path: ROUTES.AUDIT,
  page: 'AuditPage',
  permission: { resource: 'audit', action: 'read' as const },
};
