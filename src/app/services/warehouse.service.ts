import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  WarehouseDetailDto,
  WarehousePagedAdvancedRequest,
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class WarehouseService extends ApiService {

  /** Danh sách kho dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: WarehousePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/warehouse/paged-advanced',
      body
    );
  }

  /** Toàn bộ kho (dùng cho dropdown chọn kho). */
  getAll(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/warehouse');
  }

  /** Chi tiết một kho theo id. */
  getById(id: number): Observable<ApiResponse<WarehouseDetailDto>> {
    return this.apiGet<WarehouseDetailDto>(
      `/warehouse/${id}`
    );
  }

  /** Tạo mới kho. */
  create(payload: CreateWarehouseDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/warehouse', payload);
  }

  /** Cập nhật kho. */
  update(payload: UpdateWarehouseDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/warehouse', payload);
  }

  /** Xóa mềm kho. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/warehouse/${id}`);
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * - search.value: từ khóa tìm kiếm chung (tên, mã, địa chỉ, mô tả)
   * - order: cột + chiều sắp xếp
   * - columns[].search.value: bộ lọc theo cột (tên, mã, trạng thái)
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterCode?: string | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): WarehousePagedAdvancedRequest {
    const columns = ['id', 'code', 'name', 'address', 'isActive', 'createdDate'];
    const columnFilters = {
      code: params.filterCode?.trim() || '',
      name: params.filterName?.trim() || '',
      isActive: params.filterIsActive != null ? String(params.filterIsActive) : '',
      createdDate: buildDateRange(params.dateFrom ?? '', params.dateTo ?? ''),
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      columnFilters
    ) as WarehousePagedAdvancedRequest;
  }
}
