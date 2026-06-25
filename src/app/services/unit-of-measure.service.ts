import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  UnitOfMeasureDetailDto,
  UnitOfMeasurePagedAdvancedRequest,
  CreateUnitOfMeasureDto,
  UpdateUnitOfMeasureDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class UnitOfMeasureService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách đơn vị tính dạng DataTables (phân trang/tìm/sắp xếp). */
  getPagedAdvanced(
    body: UnitOfMeasurePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/unit-of-measures/paged-advanced`,
      body
    );
  }

  /** Chi tiết một đơn vị tính theo id. */
  getById(id: number): Observable<ApiResponse<UnitOfMeasureDetailDto>> {
    return this.http.get<ApiResponse<UnitOfMeasureDetailDto>>(
      `${this.base}/unit-of-measures/${id}`
    );
  }

  /** Tạo mới đơn vị tính. */
  create(payload: CreateUnitOfMeasureDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/unit-of-measures`,
      payload
    );
  }

  /** Cập nhật đơn vị tính. */
  update(payload: UpdateUnitOfMeasureDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/unit-of-measures`,
      payload
    );
  }

  /** Xóa mềm đơn vị tính. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/unit-of-measures/${id}`
    );
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * Đơn vị tính không có lọc nâng cao nên chỉ có search + sort.
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
  }): UnitOfMeasurePagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string) => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value: '', regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: [col('id'), col('name'), col('symbol'), col('createdDate')],
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
