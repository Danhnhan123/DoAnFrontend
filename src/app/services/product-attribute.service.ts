import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ProductAttributeDetailDto,
  ProductAttributePagedAdvancedRequest,
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ProductAttributeService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách thuộc tính sản phẩm dạng DataTables (phân trang/tìm/sắp xếp). */
  getPagedAdvanced(
    body: ProductAttributePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-attribute/paged-advanced`,
      body
    );
  }

  /** Chi tiết một thuộc tính sản phẩm theo id. */
  getById(id: number): Observable<ApiResponse<ProductAttributeDetailDto>> {
    return this.http.get<ApiResponse<ProductAttributeDetailDto>>(
      `${this.base}/product-attribute/${id}`
    );
  }

  /** Tạo mới thuộc tính sản phẩm. */
  create(payload: CreateProductAttributeDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-attribute`,
      payload
    );
  }

  /** Cập nhật thuộc tính sản phẩm. */
  update(payload: UpdateProductAttributeDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/product-attribute`,
      payload
    );
  }

  /** Xóa mềm thuộc tính sản phẩm. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/product-attribute/${id}`
    );
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * Hỗ trợ tìm nhanh (search), lọc theo tên, mô tả và khoảng ngày tạo.
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterDescription?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): ProductAttributePagedAdvancedRequest {
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['createdDate'];
    const dateSearch = buildDateRange(params.dateFrom ?? '', params.dateTo ?? '');

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('name', params.filterName?.trim() || ''),
        col('description', params.filterDescription?.trim() || ''),
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
