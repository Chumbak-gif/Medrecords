/**
 * Lazy-loaded route components.
 *
 * Uses React.lazy() to code-split each feature module into independent bundles.
 * Each lazy component is wrapped in Suspense with a LoadingSpinner fallback.
 *
 * Requirements: 7.2, 10.2, 10.4
 */

import { lazy, Suspense, type ComponentType } from 'react';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

/**
 * Factory for creating a lazy-loaded route component wrapped in Suspense.
 */
function lazyRoute(importFn: () => Promise<{ default: ComponentType }>) {
  const LazyComponent = lazy(importFn);
  return function LazyRouteWrapper() {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <LazyComponent />
      </Suspense>
    );
  };
}

// ---------------------------------------------------------------------------
// Feature module lazy routes
// ---------------------------------------------------------------------------

/** Dashboard feature */
export const LazyDashboardPage = lazyRoute(
  () => import('@/features/dashboard/pages/DashboardPage')
);

/** Patient management feature */
export const LazyPatientsListPage = lazyRoute(
  () => import('@/features/patient-management/pages/PatientsListPage')
);

/** Assessments feature */
export const LazyAssessmentsListPage = lazyRoute(
  () => import('@/features/assessments/pages/AssessmentsListPage')
);

/** Audit log feature */
export const LazyAuditPage = lazyRoute(
  () => import('@/features/audit/pages/AuditPage')
);

/** User management feature (admin only) */
export const LazyUserManagementPage = lazyRoute(
  () => import('@/features/user-management/pages/UserManagementPage')
);

/** Authentication pages */
export const LazyLoginPage = lazyRoute(
  () => import('@/features/authentication/pages/LoginPage')
);
