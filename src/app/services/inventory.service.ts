import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
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
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Bảng tồn kho theo lô (DataTables). */
  getPagedAdvanced(
    body: InventoryAdvancedRequest
  ): Observable<ApiResponse<DTResponse<InventoryRow>>> {
    return this.http.post<ApiResponse<DTResponse<InventoryRow>>>(
      `${this.base}/inventories/advanced`,
      body
    );
  }

  /** 5 thẻ KPI: Tồn thực tế / Khả dụng / Đã giữ / Đang xử lý / Cách ly. */
  getSummary(
    body: InventorySummaryRequest
  ): Observable<ApiResponse<InventoryStockSummary>> {
    return this.http.post<ApiResponse<InventoryStockSummary>>(
      `${this.base}/inventories/summary`,
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
  }): InventoryAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['id'] ?? 0;

    const col = (data: string) => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value: '', regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: [
        col('lotCode'),
        col('categoryName'),
        col('warehouseName'),
        col('bags'),
        col('quantityOnHand'),
        col('quantityAvailable'),
        col('quantityReserved'),
        col('costPrice'),
        col('id'),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
      warehouseId: params.warehouseId ?? null,
      productCategoryId: params.productCategoryId ?? null,
      lotType: params.lotType ?? null,
      lotStatusId: params.lotStatusId ?? null,
      withLotOnly: params.withLotOnly ?? null,
      lowStockOnly: params.lowStockOnly ?? null,
    };
  }
}
