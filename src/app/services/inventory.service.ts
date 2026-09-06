import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  DTResponse,
  InventoryRow,
  InventoryStockSummary,
  InventoryAdvancedRequest,
  InventorySummaryRequest,
} from '../models';

/**
 * Dịch vụ tồn kho cho màn "Giám sát tồn kho" (Tồn kho lúa/gạo).
 * - advanced: bảng tồn theo lô/cột/khu (phân trang/tìm/lọc/sắp xếp).
 * - summary: 5 thẻ KPI theo trạng thái (đồng bộ bộ lọc với bảng).
 */
@Injectable({ providedIn: 'root' })
export class InventoryService extends ApiService {

  /** Bảng tồn kho theo lô (DataTables). */
  getPagedAdvanced(
    body: InventoryAdvancedRequest
  ): Observable<ApiResponse<DTResponse<InventoryRow>>> {
    return this.apiPost<DTResponse<InventoryRow>>(
      '/inventories/advanced',
      body
    );
  }

  /** 5 thẻ KPI: Tồn thực tế / Khả dụng / Đã giữ / Đang xử lý / Cách ly. */
  getSummary(
    body: InventorySummaryRequest
  ): Observable<ApiResponse<InventoryStockSummary>> {
    return this.apiPost<InventoryStockSummary>(
      '/inventories/summary',
      body
    );
  }

  /**
   * Dựng body DataTables cho /inventories/advanced.
   * - search.value: từ khóa chung (mã lô / SKU / tên hàng / kho / vị trí)
   * - filter theo kho, danh mục (tab loại), loại lô, trạng thái lô
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    warehouseId?: number | null;
    productCategoryId?: number | null;
    lotType?: string | null;
    lotStatusId?: number | null;
    withLotOnly?: boolean | null;
    lowStockOnly?: boolean | null;
    isQuarantined?: boolean | null;
  }): InventoryAdvancedRequest {
    const columns = ['lotCode', 'categoryName', 'warehouseName', 'bags', 'quantityOnHand', 'quantityAvailable', 'quantityReserved', 'costPrice', 'id'];

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
        warehouseId: params.warehouseId ?? null,
        productCategoryId: params.productCategoryId ?? null,
        lotType: params.lotType ?? null,
        lotStatusId: params.lotStatusId ?? null,
        withLotOnly: params.withLotOnly ?? null,
        lowStockOnly: params.lowStockOnly ?? null,
        isQuarantined: params.isQuarantined ?? null,
      }
    ) as InventoryAdvancedRequest;
  }

  /**
   * Dựng body cho /inventories/summary từ ĐÚNG bộ lọc đang áp cho bảng.
   *
   * Trước đây chỉ truyền kho + danh mục, nên bật lọc "Cách ly"/"Tồn thấp" hay
   * gõ từ khoá thì bảng đổi mà 5 thẻ đứng yên — người dùng đọc ra là số liệu
   * sai. Backend nay nhận cùng bộ lọc nên hai bên luôn nói một chuyện.
   */
  buildSummaryBody(params: {
    search?: string | null;
    warehouseId?: number | null;
    locationId?: number | null;
    productCategoryId?: number | null;
    productVariantId?: number | null;
    lotType?: string | null;
    lotStatusId?: number | null;
    withLotOnly?: boolean | null;
    lowStockOnly?: boolean | null;
    isQuarantined?: boolean | null;
  }): InventorySummaryRequest {
    return {
      search: params.search?.trim() || null,
      warehouseId: params.warehouseId ?? null,
      locationId: params.locationId ?? null,
      productCategoryId: params.productCategoryId ?? null,
      productVariantId: params.productVariantId ?? null,
      lotType: params.lotType ?? null,
      lotStatusId: params.lotStatusId ?? null,
      withLotOnly: params.withLotOnly ?? null,
      lowStockOnly: params.lowStockOnly ?? null,
      isQuarantined: params.isQuarantined ?? null,
    };
  }
}
