import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  LocationDetailDto,
  LocationPagedAdvancedRequest,
  CreateLocationDto,
  UpdateLocationDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách vị trí lưu trữ dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: LocationPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/location/paged-advanced`,
      body
    );
  }

  /** Chi tiết một vị trí theo id. */
  getById(id: number): Observable<ApiResponse<LocationDetailDto>> {
    return this.http.get<ApiResponse<LocationDetailDto>>(
      `${this.base}/location/${id}`
    );
  }

  /** Tạo mới vị trí. */
  create(payload: CreateLocationDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/location`, payload);
  }

  /** Cập nhật vị trí. */
  update(payload: UpdateLocationDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/location`, payload);
  }

  /** Xóa mềm vị trí. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/location/${id}`);
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
    const warehouseValue =
      params.filterWarehouseId != null ? String(params.filterWarehouseId) : '';
    const dateSearch = buildDateRange(params.dateFrom ?? '', params.dateTo ?? '');

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('warehouseId', warehouseValue),
        col('zoneName', params.filterZoneName?.trim() || ''),
        col('shelfRow'),
        col('shelfLevel'),
        col('slotCode', params.filterSlotCode?.trim() || ''),
        col('maxCapacity'),
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
