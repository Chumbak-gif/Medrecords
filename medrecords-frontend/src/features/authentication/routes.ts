/**
 * Authentication feature route definitions.
 *
 * Exports route configuration for the auth-related pages.
 * These routes are public (no permission required).
 * Requirements: 7.1
 */

import { ROUTES } from '@/shared/constants/routes';

export const authRoutes = {
  login: {
    path: ROUTES.LOGIN,
    page: 'LoginPage',
    isPublic: true,
  },
  logout: {
    path: ROUTES.LOGOUT,
    page: 'LogoutPage',
    isPublic: true,
  },
};
