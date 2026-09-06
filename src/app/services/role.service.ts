import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
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
export class RoleService extends ApiService {

  /** Lấy danh sách vai trò phân trang */
  getPagedRoles(query: SearchQuery): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/role/paged', {
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      keyword: query.keyword,
      sortType: query.sortType || 'DESC',
      orderBy: query.orderBy || 'createdDate',
    });
  }

  /** Tạo vai trò mới */
  create(payload: CreateRoleDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/role', payload);
  }

  /** Cập nhật vai trò */
  update(payload: UpdateRoleDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/role', payload);
  }

  /** Xóa vai trò theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/role/${id}`);
  }

  /** Lấy toàn bộ danh sách menu (cấu trúc phẳng hoặc cây) */
  /**
   * Lấy toàn bộ vai trò cho dropdown dùng chung — endpoint GetAll chỉ [Authorize].
   * Dùng ở các màn cần danh sách vai trò (vd Kiểm định) mà role không có quyền READ menu Vai trò.
   */
  getAll(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/role');
  }

  getAllMenus(): Observable<ApiResponse<MenuAggregate[]>> {
    return this.apiGet<MenuAggregate[]>('/menu');
  }

  /** Lấy toàn bộ danh sách actions */
  getAllActions(): Observable<ApiResponse<ActionDto[]>> {
    return this.apiGet<ActionDto[]>('/action');
  }

  /** Lấy cấu hình quyền hạn của tất cả menu */
  getMenuPermissions(): Observable<ApiResponse<MenuPermissionDto[]>> {
    return this.apiGet<MenuPermissionDto[]>(
      `/menu/permissons`
    );
  }

  /** Lấy danh sách quyền hạn của một vai trò cụ thể */
  getRolePermissions(roleId: number): Observable<ApiResponse<any>> {
    return this.apiGet<any>(
      `/role/${roleId}/permissons`
    );
  }
}
