import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // Token presence is the auth indicator — profile loads async after
  if (auth.getToken()) return true;
  return router.createUrlTree(['/login']);
};
