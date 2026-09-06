import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
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
export class InventoryTransactionService extends ApiService {

  /** Danh sách giao dịch tồn kho (DataTables, mới nhất trước). */
  getPagedAdvanced(
    body: InventoryTransactionAdvancedRequest
  ): Observable<ApiResponse<DTResponse<InventoryTransactionRow>>> {
    return this.apiPost<DTResponse<InventoryTransactionRow>>(
      '/inventory-transactions/advanced',
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
    const length = params.length ?? 20;
    const start = params.start ?? 0;

    return buildDataTablesRequest(
      {
        page: Math.floor(start / length) + 1,
        pageSize: length,
        search: '',
        sortField: 'createdDate',
        sortDir: 'desc',
      },
      ['createdDate'],
      {},
      {
        warehouseId: params.warehouseId ?? null,
        productVariantId: params.productVariantId ?? null,
      }
    ) as InventoryTransactionAdvancedRequest;
  }
}
