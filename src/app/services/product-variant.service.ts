import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ProductVariantDetailDto,
  ProductVariantPagedAdvancedRequest,
  CreateProductVariantDto,
  UpdateProductVariantDto,
  ProductOption,
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
   * Lấy danh sách sản phẩm gốc để chọn productId.
   */
  getProducts(): Observable<ApiResponse<ProductOption[]>> {
    return this.http.get<ApiResponse<ProductOption[]>>(
      `${this.base}/product`
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

  /**
   * Build body DataTables giống màn User.
   */
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