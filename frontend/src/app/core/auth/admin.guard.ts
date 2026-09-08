import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.getToken()) return true; // profile loads async; sidebar reacts when signal updates
  return router.createUrlTree(['/login'], { replaceUrl: true } as never);
};
