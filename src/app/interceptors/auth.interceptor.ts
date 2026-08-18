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

  // Các endpoint auth KHÔNG được đi qua luồng refresh (tránh đệ quy/treo màn hình).
  const isRefreshCall = req.url.includes('/auth/refresh-token');
  const isLoginCall = req.url.includes('/auth/admin/login');

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      // Nếu CHÍNH request refresh-token bị 401 -> refresh token đã hết hạn thật.
      // Đăng xuất ngay, KHÔNG gọi refresh lần nữa (nếu không sẽ chờ chính nó -> deadlock,
      // màn hình bị load trắng vì không bao giờ điều hướng về trang đăng nhập).
      if (isRefreshCall) {
        authService.clearSession();
        return throwError(() => err);
      }
      // Lỗi 401 khi đăng nhập (sai thông tin) -> để form login tự hiển thị lỗi.
      if (isLoginCall) {
        return throwError(() => err);
      }

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