import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  DTResponse,
  InventoryTransactionRow,
  InventoryTransactionAdvancedRequest,
} from '../models';

/**
 * Lịch sử biến động tồn kho (InventoryTransaction) — panel "Lịch sử InventoryTransaction"
 * trên màn Giám sát tồn kho. Chỉ đọc (audit trail nhập/xuất/giữ/cách ly...).
 */
@Injectable({ providedIn: 'root' })
export class InventoryTransactionService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách giao dịch tồn kho (DataTables, mới nhất trước). */
  getPagedAdvanced(
    body: InventoryTransactionAdvancedRequest
  ): Observable<ApiResponse<DTResponse<InventoryTransactionRow>>> {
    return this.http.post<ApiResponse<DTResponse<InventoryTransactionRow>>>(
      `${this.base}/inventory-transactions/advanced`,
      body
    );
  }

  /**
   * Body DataTables: {length} giao dịch mới nhất kể từ vị trí {start},
   * lọc theo kho (tuỳ chọn). Dùng start/length để phân trang.
   */
  buildListBody(params: {
    length?: number;
    start?: number;
    warehouseId?: number | null;
    productVariantId?: number | null;
  }): InventoryTransactionAdvancedRequest {
    const col = (data: string) => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value: '', regex: false, fixed: [] as any[] },
    });

    return {
      draw: 1,
      columns: [col('createdDate')],
      order: [{ column: 0, dir: 'desc', name: 'createdDate' }],
      start: params.start ?? 0,
      length: params.length ?? 20,
      search: { value: '', regex: false, fixed: [] },
      warehouseId: params.warehouseId ?? null,
      productVariantId: params.productVariantId ?? null,
    };
  }
}
