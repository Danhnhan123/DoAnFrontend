import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  RoleListDto,
  CreateRoleDto,
  UpdateRoleDto,
  RolePermissonDto,
  MenuAggregate,
  MenuPermissionDto,
  ActionDto,
  FlatMenu,
  SearchQuery,
} from '../models';

/** Hàm tiện ích: Phẳng hóa cấu trúc cây menu thành mảng phẳng */
export function flattenMenus(menus: MenuAggregate[]): FlatMenu[] {
  const result: FlatMenu[] = [];
  const traverse = (items: MenuAggregate[]) => {
    for (const m of items) {
      const { child, sortOrder, ...rest } = m;
      result.push({ ...rest, order: sortOrder, sortOrder } as FlatMenu);
      if (child?.length) traverse(child);
    }
  };
  traverse(menus);
  return result;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy danh sách vai trò phân trang */
  getPagedRoles(query: SearchQuery): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/role/paged`, {
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      keyword: query.keyword,
      sortType: query.sortType || 'DESC',
      orderBy: query.orderBy || 'createdDate',
    });
  }

  /** Tạo vai trò mới */
  create(payload: CreateRoleDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/role`, payload);
  }

  /** Cập nhật vai trò */
  update(payload: UpdateRoleDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/role`, payload);
  }

  /** Xóa vai trò theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/role/${id}`);
  }

  /** Lấy toàn bộ danh sách menu (cấu trúc phẳng hoặc cây) */
  getAllMenus(): Observable<ApiResponse<MenuAggregate[]>> {
    return this.http.get<ApiResponse<MenuAggregate[]>>(`${this.base}/menu`);
  }

  /** Lấy toàn bộ danh sách actions */
  getAllActions(): Observable<ApiResponse<ActionDto[]>> {
    return this.http.get<ApiResponse<ActionDto[]>>(`${this.base}/action`);
  }

  /** Lấy cấu hình quyền hạn của tất cả menu */
  getMenuPermissions(): Observable<ApiResponse<MenuPermissionDto[]>> {
    return this.http.get<ApiResponse<MenuPermissionDto[]>>(
      `${this.base}/menu/permissons`
    );
  }

  /** Lấy danh sách quyền hạn của một vai trò cụ thể */
  getRolePermissions(roleId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.base}/role/${roleId}/permissons`
    );
  }
}
