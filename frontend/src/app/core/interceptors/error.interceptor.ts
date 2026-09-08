import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthService } from '../auth/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        auth.logout();
      } else if (error.status === 403) {
        messageService.add({
          severity: 'error',
          summary: 'Access Denied',
          detail: 'Access denied'
        });
      }
      return throwError(() => error);
    })
  );
};
