/**
 * Application route path constants.
 * Centralized route definitions to prevent magic strings throughout the codebase.
 */

export const ROUTES = {
  // Authentication
  LOGIN: '/login',
  LOGOUT: '/logout',

  // Main application
  DASHBOARD: '/dashboard',

  // Patient management
  PATIENTS: '/patients',
  PATIENT_DETAIL: '/patients/:id',
  PATIENT_CREATE: '/patients/new',

  // Assessments
  ASSESSMENTS: '/assessments',
  ASSESSMENT_DETAIL: '/assessments/:id',
  ASSESSMENT_CREATE: '/assessments/new',

  // Prescriptions
  PRESCRIPTIONS: '/prescriptions',
  PRESCRIPTION_DETAIL: '/prescriptions/:id',

  // Follow-ups
  FOLLOWUPS: '/followups',

  // Reports
  REPORTS: '/reports',

  // Audit
  AUDIT: '/audit',

  // User management
  USERS: '/users',
  USER_DETAIL: '/users/:id',

  // Error pages
  UNAUTHORIZED: '/unauthorized',
  NOT_FOUND: '/not-found',

  // Health
  HEALTH: '/health',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
