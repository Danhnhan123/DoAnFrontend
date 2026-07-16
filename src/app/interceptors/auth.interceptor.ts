import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DevicePresenceService } from '../services/device-presence.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Mỗi request API (khi đã đăng nhập) = có hoạt động -> đánh dấu để tính trạng thái idle.
  if (token) {
    inject(DevicePresenceService).markActivity();
  }

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        const refreshToken = authService.getRefreshToken();
        if (refreshToken) {
          return authService.refreshToken().pipe(
            switchMap(res => {
              if (res.isSucceeded) {
                const newReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${res.resources.accessToken}` }
                });
                return next(newReq);
              }
              authService.clearSession();
              return throwError(() => err);
            }),
            catchError(() => {
              authService.clearSession();
              return throwError(() => err);
            })
          );
        }
        authService.clearSession();
      }
      return throwError(() => err);
    })
  );
};