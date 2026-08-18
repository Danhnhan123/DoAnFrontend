import { CanMatchFn, Route } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Guard READ theo menu (dạng canMatch): nếu user KHÔNG có quyền READ trên menu của route,
 * guard trả về false -> route này không "match" -> Angular rơi xuống route '**' -> hiện trang 404.
 * Nhờ dùng canMatch (thay vì canActivate + redirect) nên URL giữ nguyên mà vẫn ra 404.
 *
 * Cách dùng: gắn `canMatch: [menuReadGuard]` và `data: { menuCode: 'PRODUCT' }` cho route.
 * Route không có `menuCode` (dashboard, profile...) sẽ luôn cho qua.
 */
export const menuReadGuard: CanMatchFn = (route: Route) => {
  const auth = inject(AuthService);
  // Chưa đăng nhập: để authGuard ở route cha xử lý điều hướng về /login.
  if (!auth.isLoggedIn()) return true;

  const menuCode = route.data?.['menuCode'] as string | undefined;
  if (!menuCode) return true;

  return inject(PermissionService).canRead(menuCode);
};
