import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
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
export class ProductVariantService extends ApiService {

  /**
   * Lấy danh sách biến thể sản phẩm theo dạng DataTables.
   * API này dùng cho table có phân trang, tìm kiếm, sắp xếp.
   */
  getPagedAdvanced(
    body: ProductVariantPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/product-variant/paged-advanced',
      body
    );
  }

    /**
   * API search mới của backend.
   * Dùng khi muốn lọc thêm IsActive.
   * Response dạng PagingData, không phải DataTables.
   */
  search(params: ProductVariantSearchParams): Observable<ApiResponse<any>> {
    const httpParams = {
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      keyword: params.keyword || undefined,
      orderBy: params.orderBy || undefined,
      sortType: params.sortType || undefined,
      productId: params.productId ?? undefined,
      isActive: params.isActive ?? undefined,
    };

    return this.apiGet<any>(
      '/product-variant/search',
      httpParams
    );
  }

  /**
   * Lấy chi tiết một biến thể theo id.
   * Dùng khi mở modal sửa.
   */
  getById(id: number): Observable<ApiResponse<ProductVariantDetailDto>> {
    return this.apiGet<ProductVariantDetailDto>(
      `/product-variant/${id}`
    );
  }

  /**
   * Tạo mới biến thể sản phẩm.
   */
  create(payload: CreateProductVariantDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/product-variant',
      payload
    );
  }

  /**
   * Cập nhật biến thể sản phẩm.
   */
  update(payload: UpdateProductVariantDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/product-variant',
      payload
    );
  }

  /**
   * Xóa mềm biến thể.
   */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(
      `/product-variant/${id}`
    );
  }

  /**
   * Kích hoạt biến thể (IsActive = true) qua endpoint chuyên dụng.
   * Dùng cho nút bật/tắt trạng thái ở màn danh sách thay vì gọi update toàn bộ.
   */
  activate(id: number): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/product-variant/${id}/activate`,
      {}
    );
  }

  /**
   * Vô hiệu hóa biến thể (IsActive = false) qua endpoint chuyên dụng.
   */
  deactivate(id: number): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/product-variant/${id}/deactivate`,
      {}
    );
  }

  /**
   * Lấy danh sách sản phẩm gốc để chọn productId.
   */
  getProducts(): Observable<ApiResponse<ProductOption[]>> {
    return this.apiGet<ProductOption[]>(
      '/product'
    );
  }

  /**
   * Danh sách đơn vị tính cho dropdown trong form.
   * Dùng endpoint GetAll dùng chung (chỉ [Authorize]) thay cho paged-advanced (bị chặn READ),
   * để role có quyền quản lý biến thể nhưng không có quyền xem menu Đơn vị tính vẫn lấy được dropdown.
   */
  getUnitOfMeasureOptions(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/unit-of-measures');
  }

  /** Danh sách giống lúa cho dropdown trong form (GetAll dùng chung). */
  getRiceVarietyOptions(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/rice-varieties');
  }

  /** Danh sách thuộc tính sản phẩm cho editor thuộc tính biến thể (GetAll dùng chung). */
  getProductAttributeOptions(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/product-attribute');
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
    const columns = ['id', 'name', 'productName', 'unitOfMeasureName', 'sku', 'salePrice', 'isActive', 'createdDate'];

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      {},
      {
        productId: params.filterProductId,
      }
    ) as ProductVariantPagedAdvancedRequest;
  }
}
