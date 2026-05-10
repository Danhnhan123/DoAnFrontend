import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse, LoginRequest, LoginResponse,
  LoginResponseAdminUserInfo, AuthProfile, MenuAggregate
} from '../models';

const TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';
const USER_KEY = 'admin_user_info';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = environment.baseUrl;

  currentUser = signal<LoginResponseAdminUserInfo | null>(this.loadUser());
  isLoggedIn = signal<boolean>(!!this.getToken());

  constructor(private http: HttpClient, private router: Router) {}

  login(body: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.base}/auth/admin/login`, body).pipe(
      tap(res => {
        if (res.isSucceeded && res.resources) {
          this.saveSession(res.resources);
        }
      })
    );
  }

  logout(): Observable<any> {
    const refreshToken = this.getRefreshToken();
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
          localStorage.setItem(TOKEN_KEY, res.resources.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, res.resources.refreshToken);
        }
      })
    );
  }

  getProfile(): Observable<ApiResponse<AuthProfile>> {
    return this.http.get<ApiResponse<AuthProfile>>(`${this.base}/auth/me`);
  }

  getMenus(): MenuAggregate[] {
    const user = this.currentUser();
    return user?.menus || [];
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private saveSession(data: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.userInfo));
    this.currentUser.set(data.userInfo);
    this.isLoggedIn.set(true);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }

  private loadUser(): LoginResponseAdminUserInfo | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}