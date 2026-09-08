/**
 * Patient management feature route definitions.
 *
 * Exports route configuration for integration with the main router.
 * Requirements: 7.1
 */

import { ROUTES } from '@/shared/constants/routes';

export const patientRoutes = {
  path: ROUTES.PATIENTS,
  children: [
    { index: true, page: 'PatientsListPage' },
    { path: 'new', page: 'PatientCreatePage' },
    { path: ':id', page: 'PatientDetailPage' },
  ],
  permission: { resource: 'patients', action: 'read' as const },
};
