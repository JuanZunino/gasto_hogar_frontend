import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const path = request.url.split(/[?#]/, 1)[0];
  if (!path.startsWith('/api/v1/') || /^\/api\/v1\/login\/?$/.test(path)) {
    return next(request);
  }

  const token = inject(AuthService).token;
  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);
};
