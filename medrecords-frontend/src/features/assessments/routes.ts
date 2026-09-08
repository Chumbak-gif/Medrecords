/**
 * Assessments feature route definitions.
 *
 * Exports route configuration for integration with the main router.
 * Requirements: 7.1
 */

import { ROUTES } from '@/shared/constants/routes';

export const assessmentRoutes = {
  path: ROUTES.ASSESSMENTS,
  children: [
    { index: true, page: 'AssessmentsListPage' },
    { path: 'new', page: 'AssessmentCreatePage' },
    { path: ':id', page: 'AssessmentDetailPage' },
  ],
  permission: { resource: 'assessments', action: 'read' as const },
};
