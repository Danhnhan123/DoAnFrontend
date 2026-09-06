import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  ProductCategoryDetailDto,
  ProductCategoryPagedAdvancedRequest,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ProductCategoryService extends ApiService {

  /** Danh sách danh mục sản phẩm dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: ProductCategoryPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/product-category/paged-advanced',
      body
    );
  }

  /** Lấy toàn bộ danh mục (dùng cho dropdown chọn danh mục cha). */
  getAll(): Observable<ApiResponse<ProductCategoryDetailDto[]>> {
    return this.apiGet<ProductCategoryDetailDto[]>(
      '/product-category'
    );
  }

  /** Chi tiết một danh mục theo id. */
  getById(id: number): Observable<ApiResponse<ProductCategoryDetailDto>> {
    return this.apiGet<ProductCategoryDetailDto>(
      `/product-category/${id}`
    );
  }

  /** Tạo mới danh mục sản phẩm. */
  create(payload: CreateProductCategoryDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/product-category`,
      payload
    );
  }

  /** Cập nhật danh mục sản phẩm. */
  update(payload: UpdateProductCategoryDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/product-category`,
      payload
    );
  }

  /** Xóa mềm danh mục sản phẩm. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/product-category/${id}`);
  }

  /**
   * Tính TreeIds (materialized path các id tổ tiên) từ danh mục cha.
   * - Danh mục gốc: "/"
   * - Danh mục con: treeIds-của-cha + parentId + "/", vd "/1/" rồi "/1/5/".
   */
  buildTreeIds(
    parentId: number | null | undefined,
    all: ProductCategoryDetailDto[]
  ): string {
    if (!parentId) return '/';
    const parent = all.find((c) => c.id === parentId);
    if (!parent) return '/';
    const base =
      parent.treeIds && parent.treeIds.trim() ? parent.treeIds.trim() : '/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    return `${normalized}${parent.id}/`;
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * - search.value: từ khóa chung (tên / mô tả)
   * - order: cột + chiều sắp xếp
   * - columns[].search.value: bộ lọc theo cột (tên, danh mục cha, ngày tạo)
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterParentId?: number | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): ProductCategoryPagedAdvancedRequest {
    const columns = ['id', 'name', 'description', 'parentName', 'productCount', 'sortOrder', 'createdDate'];
    const columnFilters = {
      name: params.filterName?.trim() || '',
      parentName: params.filterParentId != null ? String(params.filterParentId) : '',
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
    ) as ProductCategoryPagedAdvancedRequest;
  }
}
