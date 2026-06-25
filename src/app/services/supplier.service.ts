import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  SupplierDetailDto,
  SupplierPagedAdvancedRequest,
  CreateSupplierDto,
  UpdateSupplierDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách nhà cung cấp dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: SupplierPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/suppliers/paged-advanced`,
      body
    );
  }

  /** Chi tiết một nhà cung cấp theo id. */
  getById(id: number): Observable<ApiResponse<SupplierDetailDto>> {
    return this.http.get<ApiResponse<SupplierDetailDto>>(
      `${this.base}/suppliers/${id}`
    );
  }

  /** Tạo mới nhà cung cấp. */
  create(payload: CreateSupplierDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/suppliers`, payload);
  }

  /** Cập nhật nhà cung cấp. */
  update(payload: UpdateSupplierDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/suppliers`, payload);
  }

  /** Xóa mềm nhà cung cấp. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/suppliers/${id}`);
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * - search.value: từ khóa tìm kiếm chung
   * - order: cột + chiều sắp xếp
   * - columns[].search.value: bộ lọc theo cột (trạng thái hoạt động)
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterIsActive: boolean | null;
  }): SupplierPagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const activeValue =
      params.filterIsActive != null ? String(params.filterIsActive) : '';

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('name'),
        col('code'),
        col('contactPerson'),
        col('phone'),
        col('email'),
        col('taxCode'),
        col('isActive', activeValue),
        col('createdDate'),
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
