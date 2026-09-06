import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import { ApiResponse, DTParameters } from '../models';
import {
  CreateProductDto,
  ProductAdvancedRow,
  ProductCategoryOption,
  ProductDetailDto,
  UpdateProductDto,
  ProductPagedAdvancedRequest
} from '../models/product';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ProductService extends ApiService {

  /** Lấy danh sách sản phẩm bằng backend paged-advanced/DataTables. */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/product/paged-advanced',
      body
    );
  }

  /** Lấy chi tiết sản phẩm để hiển thị modal xem/sửa. */
  getById(id: number): Observable<ApiResponse<ProductDetailDto>> {
    return this.apiGet<ProductDetailDto>(
      `/product/${id}`
    );
  }

  /** Tạo mới sản phẩm. */
  create(payload: CreateProductDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/product', payload);
  }

  /** Cập nhật sản phẩm. */
  update(payload: UpdateProductDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/product', payload);
  }

  /** Xóa mềm sản phẩm theo API backend. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/product/${id}`);
  }

  /** Lấy tất cả sản phẩm khi cần fallback hoặc dùng cho select khác. */
  getAll(): Observable<ApiResponse<ProductAdvancedRow[]>> {
    return this.apiGet<ProductAdvancedRow[]>(
      '/product'
    );
  }

  /** Lấy danh mục sản phẩm để chọn khi thêm/sửa. */
  getProductCategories(): Observable<ApiResponse<ProductCategoryOption[]>> {
    return this.apiGet<ProductCategoryOption[]>(
      '/product-category'
    );
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName: string;
    filterDescription: string;
    filterCategoryId: number | null;
    filterActive: '' | 'true' | 'false';
    filterDateFrom: string;
    filterDateTo: string;
  }): ProductPagedAdvancedRequest {
    const columns = ['id', 'name', 'description', 'productCategoryName', 'isActive', 'createdDate'];
    const columnFilters = {
      name: params.filterName.trim(),
      description: params.filterDescription.trim(),
      isActive: params.filterActive,
      createdDate: buildDateRange(params.filterDateFrom, params.filterDateTo),
    };
    const customFilters = {
      categoryIds: params.filterCategoryId ? [params.filterCategoryId] : [],
      additionalValues: [
        params.filterName.trim(),
        params.filterDescription.trim(),
        params.filterActive,
        params.filterDateFrom,
        params.filterDateTo,
      ],
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
      columnFilters,
      customFilters
    ) as ProductPagedAdvancedRequest;
  }
}
