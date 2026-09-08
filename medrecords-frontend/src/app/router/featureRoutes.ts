/**
 * Feature route registry.
 *
 * Centralizes all feature module route configurations for the main router.
 * New features register their routes here without modifying other feature modules.
 *
 * Requirements: 7.1, 7.4
 */

import { authRoutes } from '@/features/authentication/routes';
import { patientRoutes } from '@/features/patient-management/routes';
import { assessmentRoutes } from '@/features/assessments/routes';
import { dashboardRoutes } from '@/features/dashboard/routes';
import { auditRoutes } from '@/features/audit/routes';
import { userManagementRoutes } from '@/features/user-management/routes';

export {
  authRoutes,
  patientRoutes,
  assessmentRoutes,
  dashboardRoutes,
  auditRoutes,
  userManagementRoutes,
};
