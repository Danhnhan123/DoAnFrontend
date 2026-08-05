import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, throwError, switchMap, of, map, finalize, shareReplay } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DevicePresenceService } from '../services/device-presence.service';

/**
 * Single-flight refresh: khi nhiều request cùng nhận 401 (vd lúc tải lại trang),
 * TẤT CẢ sẽ chờ CHUNG một lần refresh thay vì mỗi request tự gọi refresh.
 * Tránh race làm hỏng refresh token — BE dùng refresh token 1 lần rồi xoay vòng,
 * nên gọi refresh song song sẽ khiến các request sau bị "RefreshTokenIsUsed" -> đăng xuất.
 */
let refreshInFlight$: Observable<boolean> | null = null;

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
      if (err.status !== 401) return throwError(() => err);

      const refreshToken = authService.getRefreshToken();
      if (!refreshToken) {
        authService.clearSession();
        return throwError(() => err);
      }

      // Chỉ tạo MỘT luồng refresh dùng chung cho mọi request 401 đồng thời.
      if (!refreshInFlight$) {
        refreshInFlight$ = authService.refreshToken().pipe(
          map(res => !!res.isSucceeded),
          catchError(() => of(false)),
          finalize(() => { refreshInFlight$ = null; }),
          shareReplay(1)
        );
      }

      return refreshInFlight$.pipe(
        switchMap(ok => {
          if (!ok) {
            authService.clearSession();
            return throwError(() => err);
          }
          // Token mới đã được authService.refreshToken() lưu vào storage.
          const newToken = authService.getToken();
          const retryReq = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` }
          });
          return next(retryReq);
        })
      );
    })
  );
};