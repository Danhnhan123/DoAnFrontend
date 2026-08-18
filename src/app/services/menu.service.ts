import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  MenuAggregate,
  MenuDetailDto,
  CreateMenuDto,
  UpdateMenuDto,
  ActionDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;
  private sidebarMenuCache: MenuAggregate[] | null = null;

  /** Lấy tất cả menus (dạng phẳng, API trả về) */
  getAll(): Observable<ApiResponse<MenuAggregate[]>> {
    return this.http.get<ApiResponse<MenuAggregate[]>>(`${this.base}/menu`);
  }

  getCachedSidebarMenus(): MenuAggregate[] | null {
    return this.sidebarMenuCache;
  }

  setCachedSidebarMenus(menus: MenuAggregate[]): void {
    this.sidebarMenuCache = menus;
  }

  /** Lấy chi tiết menu theo ID */
  getById(id: number): Observable<ApiResponse<MenuDetailDto>> {
    return this.http.get<ApiResponse<MenuDetailDto>>(`${this.base}/menu/${id}`);
  }

  /**
   * Lấy menu theo phân quyền của user đang đăng nhập (dùng render sidebar).
   * Backend dựng đúng theo role/permission hiện tại trong DB nên khi cập nhật
   * vai trò, chỉ cần refetch là sidebar tự cập nhật, không cần đăng nhập lại.
   */
  getMyMenus(): Observable<ApiResponse<MenuAggregate[]>> {
    return this.http.get<ApiResponse<MenuAggregate[]>>(`${this.base}/auth/me/menus`);
  }

  /** Tạo menu mới */
  create(payload: CreateMenuDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/menu`, payload);
  }

  /** Cập nhật menu */
  update(payload: UpdateMenuDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/menu`, payload);
  }

  /** Xóa menu theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/menu/${id}`);
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
