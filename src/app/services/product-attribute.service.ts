import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  ProductAttributeDetailDto,
  ProductAttributePagedAdvancedRequest,
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ProductAttributeService extends ApiService {

  /** Danh sách thuộc tính sản phẩm dạng DataTables (phân trang/tìm/sắp xếp). */
  getPagedAdvanced(
    body: ProductAttributePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/product-attribute/paged-advanced',
      body
    );
  }

  /** Chi tiết một thuộc tính sản phẩm theo id. */
  getById(id: number): Observable<ApiResponse<ProductAttributeDetailDto>> {
    return this.apiGet<ProductAttributeDetailDto>(
      `/product-attribute/${id}`
    );
  }

  /** Tạo mới thuộc tính sản phẩm. */
  create(payload: CreateProductAttributeDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/product-attribute`,
      payload
    );
  }

  /** Cập nhật thuộc tính sản phẩm. */
  update(payload: UpdateProductAttributeDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/product-attribute`,
      payload
    );
  }

  /** Xóa mềm thuộc tính sản phẩm. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/product-attribute/${id}`);
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
    const columns = ['id', 'name', 'description', 'createdDate'];
    const columnFilters = {
      name: params.filterName?.trim() || '',
      description: params.filterDescription?.trim() || '',
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
    ) as ProductAttributePagedAdvancedRequest;
  }
}
