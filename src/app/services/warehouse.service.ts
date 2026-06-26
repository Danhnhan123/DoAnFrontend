import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  WarehouseDetailDto,
  WarehousePagedAdvancedRequest,
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách kho dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: WarehousePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/warehouse/paged-advanced`,
      body
    );
  }

  /** Toàn bộ kho (dùng cho dropdown chọn kho). */
  getAll(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.base}/warehouse`);
  }

  /** Chi tiết một kho theo id. */
  getById(id: number): Observable<ApiResponse<WarehouseDetailDto>> {
    return this.http.get<ApiResponse<WarehouseDetailDto>>(
      `${this.base}/warehouse/${id}`
    );
  }

  /** Tạo mới kho. */
  create(payload: CreateWarehouseDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/warehouse`, payload);
  }

  /** Cập nhật kho. */
  update(payload: UpdateWarehouseDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/warehouse`, payload);
  }

  /** Xóa mềm kho. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/warehouse/${id}`);
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
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const activeValue =
      params.filterIsActive != null ? String(params.filterIsActive) : '';
    const dateSearch = buildDateRange(params.dateFrom ?? '', params.dateTo ?? '');

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('code', params.filterCode?.trim() || ''),
        col('name', params.filterName?.trim() || ''),
        col('address'),
        col('isActive', activeValue),
        col('createdDate', dateSearch),
      ],
      order: [
        {
          column: colIndex,
          dir: params.sortDir,
          name: params.sortField,
        },
      ],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: {
        value: params.search.trim(),
        regex: false,
        fixed: [],
      },
    };
  }
}
