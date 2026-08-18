import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { MenuAggregate } from '../models';
import { ACTION, ACTION_BY_NAME } from '../constants/permission.constants';

/**
 * Phân quyền động phía FE — nguồn dữ liệu là user đang đăng nhập:
 *  - currentUser().permissions: [{ menuId, actionIds[] }]  (quyền theo từng menu)
 *  - currentUser().menus: cây menu READ được (dùng để map Code menu -> Id)
 *
 * Vì `menus` chỉ chứa menu user được xem, còn `permissions` là nguồn quyền theo action,
 * ta map Code -> Id qua `menus` rồi tra action trong `permissions`.
 *
 * Lưu ý bảo mật: đây chỉ là lớp UX (ẩn nút/route). Backend đã chặn thật bằng CustomAuthorize.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  /** Map Code menu (chữ HOA) -> menuId, gộp từ cây menus (mọi cấp). */
  private readonly codeToId = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    const walk = (items?: MenuAggregate[]): void => {
      for (const m of items || []) {
        if (m.code) map.set(m.code.toUpperCase(), m.id);
        if (m.child?.length) walk(m.child);
      }
    };
    walk(this.auth.currentUser()?.menus);
    return map;
  });

  /** Map menuId -> Set(actionId) từ permissions. */
  private readonly actionsByMenuId = computed<Map<number, Set<number>>>(() => {
    const map = new Map<number, Set<number>>();
    for (const p of this.auth.currentUser()?.permissions || []) {
      if (p?.menuId == null) continue;
      map.set(p.menuId, new Set(p.actionIds || []));
    }
    return map;
  });

  /** Kiểm tra user có quyền `actionId` trên menu `menuCode` hay không. */
  can(menuCode: string, actionId: number): boolean {
    if (!menuCode) return false;
    const id = this.codeToId().get(menuCode.toUpperCase());
    if (id == null) return false;
    return this.actionsByMenuId().get(id)?.has(actionId) ?? false;
  }

  /** Dạng chuỗi "CODE:ACTION" (vd "PRODUCT:CREATE") dùng cho directive. */
  canExpr(expr: string): boolean {
    const idx = expr.indexOf(':');
    if (idx < 0) return false;
    const code = expr.slice(0, idx).trim();
    const actionKey = expr.slice(idx + 1).trim().toUpperCase();
    const actionId = ACTION_BY_NAME[actionKey];
    if (actionId == null) return false;
    return this.can(code, actionId);
  }

  canRead(menuCode: string): boolean {
    return this.can(menuCode, ACTION.READ);
  }
  canCreate(menuCode: string): boolean {
    return this.can(menuCode, ACTION.CREATE);
  }
  canUpdate(menuCode: string): boolean {
    return this.can(menuCode, ACTION.UPDATE);
  }
  canDelete(menuCode: string): boolean {
    return this.can(menuCode, ACTION.DELETE);
  }
  canApprove(menuCode: string): boolean {
    return this.can(menuCode, ACTION.APPROVE);
  }
}
