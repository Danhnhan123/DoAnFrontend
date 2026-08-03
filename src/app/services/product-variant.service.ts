import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ProductVariantDetailDto,
  ProductVariantPagedAdvancedRequest,
  CreateProductVariantDto,
  UpdateProductVariantDto,
  ProductVariantSearchParams,
  ProductOption,
  LookupOption,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ProductVariantService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /**
   * Lấy danh sách biến thể sản phẩm theo dạng DataTables.
   * API này dùng cho table có phân trang, tìm kiếm, sắp xếp.
   */
  getPagedAdvanced(
    body: ProductVariantPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-variant/paged-advanced`,
      body
    );
  }

    /**
   * API search mới của backend.
   * Dùng khi muốn lọc thêm IsActive.
   * Response dạng PagingData, không phải DataTables.
   */
  search(params: ProductVariantSearchParams): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.keyword) {
      httpParams = httpParams.set('keyword', params.keyword);
    }

    if (params.orderBy) {
      httpParams = httpParams.set('orderBy', params.orderBy);
    }

    if (params.sortType) {
      httpParams = httpParams.set('sortType', params.sortType);
    }

    if (params.productId !== null && params.productId !== undefined) {
      httpParams = httpParams.set('productId', params.productId);
    }

    if (params.isActive !== null && params.isActive !== undefined) {
      httpParams = httpParams.set('isActive', params.isActive);
    }

    return this.http.get<ApiResponse<any>>(
      `${this.base}/product-variant/search`,
      { params: httpParams }
    );
  }

  /**
   * Lấy chi tiết một biến thể theo id.
   * Dùng khi mở modal sửa.
   */
  getById(id: number): Observable<ApiResponse<ProductVariantDetailDto>> {
    return this.http.get<ApiResponse<ProductVariantDetailDto>>(
      `${this.base}/product-variant/${id}`
    );
  }

  /**
   * Tạo mới biến thể sản phẩm.
   */
  create(payload: CreateProductVariantDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-variant`,
      payload
    );
  }

  /**
   * Cập nhật biến thể sản phẩm.
   */
  update(payload: UpdateProductVariantDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/product-variant`,
      payload
    );
  }

  /**
   * Xóa mềm biến thể.
   */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/product-variant/${id}`
    );
  }

  /**
   * Kích hoạt biến thể (IsActive = true) qua endpoint chuyên dụng.
   * Dùng cho nút bật/tắt trạng thái ở màn danh sách thay vì gọi update toàn bộ.
   */
  activate(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-variant/${id}/activate`,
      {}
    );
  }

  /**
   * Vô hiệu hóa biến thể (IsActive = false) qua endpoint chuyên dụng.
   */
  deactivate(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-variant/${id}/deactivate`,
      {}
    );
  }

  /**
   * Lấy danh sách sản phẩm gốc để chọn productId.
   */
  getProducts(): Observable<ApiResponse<ProductOption[]>> {
    return this.http.get<ApiResponse<ProductOption[]>>(
      `${this.base}/product`
    );
  }

  /**
   * Body DataTables tối giản để lấy toàn bộ option cho dropdown (1 trang lớn).
   */
  private optionsBody(columns: string[]): any {
    return {
      draw: 1,
      columns: columns.map((data) => ({
        data,
        name: data,
        searchable: true,
        orderable: true,
        search: { value: '', regex: false, fixed: [] },
      })),
      order: [{ column: 1, dir: 'asc', name: columns[1] ?? columns[0] }],
      start: 0,
      length: 1000,
      search: { value: '', regex: false, fixed: [] },
    };
  }

  /** Danh sách đơn vị tính cho dropdown trong form. */
  getUnitOfMeasureOptions(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/unit-of-measures/paged-advanced`,
      this.optionsBody(['id', 'name', 'symbol', 'createdDate'])
    );
  }

  /** Danh sách giống lúa cho dropdown trong form. */
  getRiceVarietyOptions(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/rice-varieties/paged-advanced`,
      this.optionsBody(['id', 'name', 'code', 'season', 'isActive', 'createdDate'])
    );
  }

  /** Danh sách thuộc tính sản phẩm cho editor thuộc tính biến thể. */
  getProductAttributeOptions(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/product-attribute/paged-advanced`,
      this.optionsBody(['id', 'name', 'description', 'createdDate'])
    );
  }

   /**
   * Trả về URL ảnh QR code.
   * API này là file PNG nên có thể mở trực tiếp bằng window.open.
   */
  getQrCodeUrl(id: number): string {
    return `${this.base}/product-variant/${id}/qr-code`;
  }

  /**
   * Trả về URL file PDF nhãn QR.
   */
  getQrLabelUrl(id: number): string {
    return `${this.base}/product-variant/${id}/qr-label`;
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterProductId: number | null;
  }): ProductVariantPagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? 7;

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
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'productName',
          name: 'productName',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'unitOfMeasureName',
          name: 'unitOfMeasureName',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'sku',
          name: 'sku',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'salePrice',
          name: 'salePrice',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'isActive',
          name: 'isActive',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'createdDate',
          name: 'createdDate',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
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
      productId: params.filterProductId,
    };
  }
}