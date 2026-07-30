import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse, LoginRequest, LoginResponse,
  LoginResponseAdminUserInfo, AuthProfile, MenuAggregate
} from '../models';
import { getDeviceInfo, getOrCreateDeviceId } from '../utils/device.util';

const TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = environment.baseUrl;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Thông tin user + phân quyền CHỈ lưu trong bộ nhớ (không đưa vào localStorage).
   * Sau khi tải lại trang sẽ được nạp lại từ API /auth/me/session (xem loadSession()).
   */
  currentUser = signal<LoginResponseAdminUserInfo | null>(null);
  isLoggedIn = signal<boolean>(!!this.getToken());

  constructor(private http: HttpClient, private router: Router) {}

  // ---- Local storage chỉ cho TOKEN (an toàn hơn: không lưu profile/quyền) ----
  private storageGet(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
  }
  private storageSet(key: string, value: string): void {
    if (this.isBrowser) localStorage.setItem(key, value);
  }
  private storageRemove(key: string): void {
    if (this.isBrowser) localStorage.removeItem(key);
  }

  login(body: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.base}/auth/admin/login`, body).pipe(
      tap(res => {
        if (res.isSucceeded && res.resources) {
          this.saveSession(res.resources);
          // Đăng ký thiết bị hiện tại (chuẩn bị cho FCM). Chạy nền, không chặn luồng login.
          this.registerCurrentDevice(res.resources.refreshToken);
        }
      })
    );
  }

  /**
   * Nạp phiên hiện tại (profile + quyền + menu) từ API vào bộ nhớ.
   * Gọi khi app khởi động (còn token) để có phân quyền động mà không cần lưu localStorage.
   * Trả về true nếu nạp thành công.
   */
  loadSession(): Observable<boolean> {
    if (!this.getToken()) return of(false);
    return this.http.get<ApiResponse<LoginResponseAdminUserInfo>>(`${this.base}/auth/me/session`).pipe(
      map(res => {
        if (res.isSucceeded && res.resources) {
          this.currentUser.set(res.resources);
          this.isLoggedIn.set(true);
          return true;
        }
        return false;
      }),
      catchError(() => {
        // Token hỏng/hết hạn và không refresh được -> dọn phiên (không điều hướng ở đây).
        this.clearTokens();
        return of(false);
      })
    );
  }

  /** Gọi API đăng ký thiết bị sau khi đăng nhập (best-effort). */
  private registerCurrentDevice(refreshToken: string): void {
    try {
      const info = getDeviceInfo();
      this.http
        .post(`${this.base}/user-device/register`, {
          deviceId: info.deviceId,
          deviceName: info.deviceName,
          platform: info.platform,
          userAgent: info.userAgent,
          refreshToken,
        })
        .subscribe({ next: () => {}, error: () => {} });
    } catch {
      /* bỏ qua lỗi đăng ký thiết bị */
    }
  }

  logout(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    // Xoá đăng ký thiết bị hiện tại (thu hồi phiên + không hiển thị lại trong danh sách thiết bị).
    this.http
      .post(`${this.base}/user-device/logout`, { deviceId: getOrCreateDeviceId() })
      .subscribe({ next: () => {}, error: () => {} });
    return this.http.post(`${this.base}/auth/logout`, { refreshToken }).pipe(
      tap(() => this.clearSession()),
      catchError(err => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  refreshToken(): Observable<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    return this.http.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${this.base}/auth/refresh-token`,
      { refreshToken: this.getRefreshToken() }
    ).pipe(
      tap(res => {
        if (res.isSucceeded) {
          this.storageSet(TOKEN_KEY, res.resources.accessToken);
          this.storageSet(REFRESH_TOKEN_KEY, res.resources.refreshToken);
        }
      })
    );
  }

  getProfile(): Observable<ApiResponse<AuthProfile>> {
    return this.http.get<ApiResponse<AuthProfile>>(`${this.base}/auth/me`);
  }

  /** Quên mật khẩu (admin): hệ thống sinh mật khẩu mới và gửi qua email. */
  forgotPassword(email: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/auth/forgot-password`, { email });
  }

  /** Người dùng đang đăng nhập có bị buộc đổi mật khẩu hay không. */
  mustChangePassword(): boolean {
    return !!this.currentUser()?.mustChangePassword;
  }

  /** Gỡ cờ buộc đổi mật khẩu sau khi đã đổi thành công. */
  clearMustChangePassword(): void {
    this.patchCurrentUser({ mustChangePassword: false });
  }

  getMenus(): MenuAggregate[] {
    const user = this.currentUser();
    return user?.menus || [];
  }

  /**
   * Cập nhật thông tin user đang đăng nhập TRONG BỘ NHỚ (không đụng localStorage).
   * Dùng sau khi user sửa hồ sơ để tên/avatar trên topbar & sidebar đổi ngay.
   */
  patchCurrentUser(patch: Partial<LoginResponseAdminUserInfo>): void {
    const current = this.currentUser();
    if (!current) return;
    this.currentUser.set({ ...current, ...patch });
  }

  getToken(): string | null {
    return this.storageGet(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.storageGet(REFRESH_TOKEN_KEY);
  }

  private saveSession(data: LoginResponse): void {
    this.storageSet(TOKEN_KEY, data.accessToken);
    this.storageSet(REFRESH_TOKEN_KEY, data.refreshToken);
    this.currentUser.set(data.userInfo);
    this.isLoggedIn.set(true);
  }

  /** Xoá token + trạng thái đăng nhập, KHÔNG điều hướng (dùng cho lỗi nạp phiên). */
  private clearTokens(): void {
    this.storageRemove(TOKEN_KEY);
    this.storageRemove(REFRESH_TOKEN_KEY);
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
  }

  clearSession(): void {
    this.clearTokens();
    this.router.navigate(['/login']);
  }
}
