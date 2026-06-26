import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
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
export class ProductService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy danh sách sản phẩm bằng backend paged-advanced/DataTables. */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product/paged-advanced`,
      body
    );
  }

  /** Lấy chi tiết sản phẩm để hiển thị modal xem/sửa. */
  getById(id: number): Observable<ApiResponse<ProductDetailDto>> {
    return this.http.get<ApiResponse<ProductDetailDto>>(
      `${this.base}/product/${id}`
    );
  }

  /** Tạo mới sản phẩm. */
  create(payload: CreateProductDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/product`, payload);
  }

  /** Cập nhật sản phẩm. */
  update(payload: UpdateProductDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/product`, payload);
  }

  /** Xóa mềm sản phẩm theo API backend. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/product/${id}`);
  }

  /** Lấy tất cả sản phẩm khi cần fallback hoặc dùng cho select khác. */
  getAll(): Observable<ApiResponse<ProductAdvancedRow[]>> {
    return this.http.get<ApiResponse<ProductAdvancedRow[]>>(
      `${this.base}/product`
    );
  }

  /** Lấy danh mục sản phẩm để chọn khi thêm/sửa. */
  getProductCategories(): Observable<ApiResponse<ProductCategoryOption[]>> {
    return this.http.get<ApiResponse<ProductCategoryOption[]>>(
      `${this.base}/product-category`
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
  const colIndex = params.colMap[params.sortField] ?? 5;

  const dateRange = buildDateRange(
    params.filterDateFrom,
    params.filterDateTo
  );
    return {
      draw: params.page,
      columns: [
        {
          data: 'id',
          name: 'id',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'name',
          name: 'name',
          searchable: true,
          orderable: true,
          search: {
            value: params.filterName.trim(),
            regex: false,
            fixed: [],
          },
        },
        {
          data: 'description',
          name: 'description',
          searchable: true,
          orderable: true,
          search: {
            value: params.filterDescription.trim(),
            regex: false,
            fixed: [],
          },
        },
        {
          data: 'productCategoryName',
          name: 'productCategoryName',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'isActive',
          name: 'isActive',
          searchable: true,
          orderable: true,
          search: {
            value: params.filterActive,
            regex: false,
            fixed: [],
          },
        },
        {
          data: 'createdDate',
          name: 'createdDate',
          searchable: true,
          orderable: true,
          search: {
            value: dateRange,
            regex: false,
            fixed: [],
          },
        },
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

      categoryIds: params.filterCategoryId ? [params.filterCategoryId] : [],

      additionalValues: [
        params.filterName.trim(),
        params.filterDescription.trim(),
        params.filterActive,
        params.filterDateFrom,
        params.filterDateTo,
      ],
    };
  }
}
