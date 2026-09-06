import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  MenuAggregate,
  MenuDetailDto,
  CreateMenuDto,
  UpdateMenuDto,
  ActionDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class MenuService extends ApiService {
  private sidebarMenuCache: MenuAggregate[] | null = null;

  /** Lấy tất cả menus (dạng phẳng, API trả về) */
  getAll(): Observable<ApiResponse<MenuAggregate[]>> {
    return this.apiGet<MenuAggregate[]>('/menu');
  }

  getCachedSidebarMenus(): MenuAggregate[] | null {
    return this.sidebarMenuCache;
  }

  setCachedSidebarMenus(menus: MenuAggregate[]): void {
    this.sidebarMenuCache = menus;
  }

  /** Lấy chi tiết menu theo ID */
  getById(id: number): Observable<ApiResponse<MenuDetailDto>> {
    return this.apiGet<MenuDetailDto>(`/menu/${id}`);
  }

  /**
   * Lấy menu theo phân quyền của user đang đăng nhập (dùng render sidebar).
   * Backend dựng đúng theo role/permission hiện tại trong DB nên khi cập nhật
   * vai trò, chỉ cần refetch là sidebar tự cập nhật, không cần đăng nhập lại.
   */
  getMyMenus(): Observable<ApiResponse<MenuAggregate[]>> {
    return this.apiGet<MenuAggregate[]>('/auth/me/menus');
  }

  /** Tạo menu mới */
  create(payload: CreateMenuDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/menu', payload);
  }

  /** Cập nhật menu */
  update(payload: UpdateMenuDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/menu', payload);
  }

  /** Xóa menu theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/menu/${id}`);
  }

  /** Xây dựng cấu trúc cây menu từ mảng phẳng */
  buildMenuTree(flatList: MenuAggregate[]): MenuAggregate[] {
    const map = new Map<number, MenuAggregate>();
    const roots: MenuAggregate[] = [];

    flatList.forEach((item) => {
      map.set(item.id, { ...item, child: [] });
    });

    flatList.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parentId) {
        const parent = map.get(item.parentId);
        if (parent) parent.child!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
