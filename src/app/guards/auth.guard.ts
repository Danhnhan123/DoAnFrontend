import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  // Tài khoản mới/đã reset: buộc đổi mật khẩu trước khi vào khu vực quản trị.
  if (auth.mustChangePassword()) {
    router.navigate(['/doi-mat-khau-lan-dau']);
    return false;
  }
  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return true;
  if (auth.mustChangePassword()) {
    router.navigate(['/doi-mat-khau-lan-dau']);
    return false;
  }
  router.navigate(['/admin/dashboard']);
  return false;
};

/**
 * Guard cho màn "Đổi mật khẩu lần đầu": chỉ vào được khi đã đăng nhập.
 * Nếu không còn bị buộc đổi mật khẩu thì chuyển về dashboard.
 */
export const firstLoginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  if (!auth.mustChangePassword()) {
    router.navigate(['/admin/dashboard']);
    return false;
  }
  return true;
};
