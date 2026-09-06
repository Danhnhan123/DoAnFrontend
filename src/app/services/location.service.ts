import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  LocationDetailDto,
  LocationPagedAdvancedRequest,
  CreateLocationDto,
  UpdateLocationDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class LocationService extends ApiService {

  /** Danh sách vị trí lưu trữ dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: LocationPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/location/paged-advanced',
      body
    );
  }

  /** Toàn bộ vị trí (dùng tính số khu vực/sức chứa cho thẻ kho + nạp popup sửa). */
  getAll(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/location');
  }

  /** Chi tiết một vị trí theo id. */
  getById(id: number): Observable<ApiResponse<LocationDetailDto>> {
    return this.apiGet<LocationDetailDto>(
      `/location/${id}`
    );
  }

  /** Tạo mới vị trí. */
  create(payload: CreateLocationDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/location', payload);
  }

  /** Tạo mới nhiều vị trí cùng lúc (dùng khi lưu kho kèm danh sách vị trí). */
  createList(payloads: CreateLocationDto[]): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/location/list',
      payloads
    );
  }

  /** Cập nhật nhiều vị trí cùng lúc. */
  updateList(payloads: UpdateLocationDto[]): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/location/list',
      payloads
    );
  }

  /** Cập nhật vị trí. */
  update(payload: UpdateLocationDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/location', payload);
  }

  /** Xóa mềm vị trí. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/location/${id}`);
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * - search.value: từ khóa tìm kiếm chung (khu vực, kho, hàng/tầng kệ, mã ô)
   * - order: cột + chiều sắp xếp
   * - columns[].search.value: bộ lọc theo cột (kho, khu vực, mã ô, trạng thái)
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterWarehouseId?: number | null;
    filterZoneName?: string | null;
    filterSlotCode?: string | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): LocationPagedAdvancedRequest {
    const columns = ['id', 'warehouseId', 'zoneName', 'shelfRow', 'shelfLevel', 'slotCode', 'maxCapacity', 'isActive', 'createdDate'];
    const columnFilters = {
      warehouseId: params.filterWarehouseId != null ? String(params.filterWarehouseId) : '',
      zoneName: params.filterZoneName?.trim() || '',
      slotCode: params.filterSlotCode?.trim() || '',
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
    ) as LocationPagedAdvancedRequest;
  }
}
