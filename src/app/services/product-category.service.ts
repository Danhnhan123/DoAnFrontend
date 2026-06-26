import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ProductCategoryDetailDto,
  ProductCategoryPagedAdvancedRequest,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ProductCategoryService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách danh mục sản phẩm dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: ProductCategoryPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-category/paged-advanced`,
      body
    );
  }

  /** Lấy toàn bộ danh mục (dùng cho dropdown chọn danh mục cha). */
  getAll(): Observable<ApiResponse<ProductCategoryDetailDto[]>> {
    return this.http.get<ApiResponse<ProductCategoryDetailDto[]>>(
      `${this.base}/product-category`
    );
  }

  /** Chi tiết một danh mục theo id. */
  getById(id: number): Observable<ApiResponse<ProductCategoryDetailDto>> {
    return this.http.get<ApiResponse<ProductCategoryDetailDto>>(
      `${this.base}/product-category/${id}`
    );
  }

  /** Tạo mới danh mục sản phẩm. */
  create(payload: CreateProductCategoryDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-category`,
      payload
    );
  }

  /** Cập nhật danh mục sản phẩm. */
  update(payload: UpdateProductCategoryDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/product-category`,
      payload
    );
  }

  /** Xóa mềm danh mục sản phẩm. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/product-category/${id}`
    );
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
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const parentValue =
      params.filterParentId != null ? String(params.filterParentId) : '';
    const dateSearch = buildDateRange(
      params.dateFrom ?? '',
      params.dateTo ?? ''
    );

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('name', params.filterName?.trim() || ''),
        col('description'),
        col('parentName', parentValue),
        col('productCount'),
        col('sortOrder'),
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
