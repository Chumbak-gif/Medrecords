/**
 * React Router configuration matching the Angular app routing structure.
 * Role-based routes with the MainLayout shell.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ComponentType } from 'react';
import { MainLayout } from '@/app/layouts/MainLayout';
import { RoleGuard } from './RoleGuard';

// Lazy route factory
function lazyRoute(importFn: () => Promise<{ default: ComponentType }>) {
  const LazyComponent = lazy(importFn);
  return function LazyRouteWrapper() {
    return (
      <Suspense fallback={
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-neutral-500)' }}>
          Loading...
        </div>
      }>
        <LazyComponent />
      </Suspense>
    );
  };
}

// Lazy pages
const LoginPage = lazyRoute(() => import('@/features/authentication/pages/LoginPage'));
const ChangePasswordPage = lazyRoute(() => import('@/features/authentication/pages/ChangePasswordPage'));
const DashboardPage = lazyRoute(() => import('@/features/dashboard/pages/DashboardPage'));
const StatisticsPage = lazyRoute(() => import('@/features/statistics/pages/StatisticsPage'));
const PatientsListPage = lazyRoute(() => import('@/features/patient-management/pages/PatientsListPage'));
const DiseasesPage = lazyRoute(() => import('@/features/diseases/pages/DiseasesPage'));
const TemplatesListPage = lazyRoute(() => import('@/features/templates/pages/TemplatesListPage'));
const TemplateBuilderPage = lazyRoute(() => import('@/features/templates/pages/TemplateBuilderPage'));
const DoctorsPage = lazyRoute(() => import('@/features/doctors/pages/DoctorsPage'));
const AuditLogPage = lazyRoute(() => import('@/features/audit/pages/AuditLogPage'));
const UserManagementPage = lazyRoute(() => import('@/features/user-management/pages/UserManagementPage'));
const SystemConfigPage = lazyRoute(() => import('@/features/system-config/pages/SystemConfigPage'));
const DoctorDashboardPage = lazyRoute(() => import('@/features/dashboard/pages/DoctorDashboardPage'));
const PatientDetailPage = lazyRoute(() => import('@/features/patient-management/pages/PatientDetailPage'));
const RegisterPatientPage = lazyRoute(() => import('@/features/patient-management/pages/RegisterPatientPage'));
const FollowupsPage = lazyRoute(() => import('@/features/followups/pages/FollowupsPage'));
const AssessmentFormPage = lazyRoute(() => import('@/features/assessments/pages/AssessmentFormPage'));
const PharmaAnalyticsPage = lazyRoute(() => import('@/features/dashboard/pages/PharmaAnalyticsPage'));

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },

  // Admin routes
  {
    path: '/admin',
    element: (
      <RoleGuard roles={['admin', 'sys_admin']}>
        <MainLayout />
      </RoleGuard>
    ),
    children: [
      { index: true, element: <Navigate to="analytics" replace /> },
      { path: 'analytics', element: <DashboardPage /> },
      { path: 'statistics', element: <StatisticsPage /> },
      { path: 'patients', element: <PatientsListPage /> },
      { path: 'patients/new', element: <RegisterPatientPage /> },
      { path: 'patients/:id', element: <PatientDetailPage /> },
      { path: 'diseases', element: <DiseasesPage /> },
      { path: 'templates', element: <TemplatesListPage /> },
      { path: 'templates/new', element: <TemplateBuilderPage /> },
      { path: 'templates/:id', element: <TemplateBuilderPage /> },
      { path: 'doctors', element: <DoctorsPage /> },
      { path: 'audit', element: <AuditLogPage /> },
    ],
  },

  // Doctor routes
  {
    path: '/doctor',
    element: (
      <RoleGuard roles={['doctor']}>
        <MainLayout />
      </RoleGuard>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DoctorDashboardPage /> },
      { path: 'analytics', element: <DashboardPage /> },
      { path: 'statistics', element: <StatisticsPage /> },
      { path: 'patients', element: <PatientsListPage /> },
      { path: 'patients/new', element: <RegisterPatientPage /> },
      { path: 'patients/:id', element: <PatientDetailPage /> },
      { path: 'followups', element: <FollowupsPage /> },
      { path: 'assessments/new', element: <AssessmentFormPage /> },
      { path: 'assessments/:id', element: <AssessmentFormPage /> },
    ],
  },

  // Pharma routes
  {
    path: '/pharma',
    element: (
      <RoleGuard roles={['pharma_viewer']}>
        <MainLayout />
      </RoleGuard>
    ),
    children: [
      { index: true, element: <Navigate to="analytics" replace /> },
      { path: 'analytics', element: <PharmaAnalyticsPage /> },
    ],
  },

  // Sys Admin routes
  {
    path: '/sysadmin',
    element: (
      <RoleGuard roles={['sys_admin']}>
        <MainLayout />
      </RoleGuard>
    ),
    children: [
      { index: true, element: <Navigate to="config" replace /> },
      { path: 'config', element: <SystemConfigPage /> },
      { path: 'users', element: <UserManagementPage /> },
    ],
  },

  // Root redirect
  { path: '/', element: <Navigate to="/login" replace /> },

  // Catch-all
  { path: '*', element: <Navigate to="/login" replace /> },
]);
