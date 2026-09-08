import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

const roleDashboardMap: Record<string, string> = {
  doctor: '/doctor/dashboard',
  admin: '/admin/analytics',
  pharma_viewer: '/pharma/analytics',
  sys_admin: '/sysadmin/config'
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // If token exists, redirect to appropriate dashboard
  if (auth.getToken()) {
    const role = auth.currentUser()?.role;
    if (role) {
      return router.createUrlTree([roleDashboardMap[role] ?? '/login']);
    }
    // Token exists but profile not loaded yet — let through, app.component will load it
    return true;
  }
  return true;
};
