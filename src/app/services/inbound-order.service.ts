import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models';
import {
  InboundOrderDetailDto,
  InboundOrderItemDto,
  InboundOrderPagedAdvancedRequest,
  PutawaySuggestionDto,
  SelectInboundPutawayDto,
} from '../models/inbound-order';
import { buildDateRange } from '../utils/date.utils';

/**
 * Dịch vụ phiếu nhập kho và Store-in/Put-away.
 */
@Injectable({ providedIn: 'root' })
export class InboundOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách phiếu nhập dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: InboundOrderPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/inbound-orders/paged-advanced`,
      body
    );
  }

  /**
   * Danh sách phiếu nhập lúa/gạo đang chờ xếp kho (put-away) cho màn Store-in.
   * Gộp 1 request (thay cho list + N getById) — backend đã hydrate sẵn item.
   */
  getPutawayPending(): Observable<ApiResponse<InboundOrderDetailDto[]>> {
    return this.http.get<ApiResponse<InboundOrderDetailDto[]>>(
      `${this.base}/inbound-orders/putaway-pending`
    );
  }

  /** Chi tiết phiếu nhập (header + dòng hàng + chứng từ). */
  getById(id: number): Observable<ApiResponse<InboundOrderDetailDto>> {
    return this.http.get<ApiResponse<InboundOrderDetailDto>>(
      `${this.base}/inbound-orders/${id}`
    );
  }

  submit(id: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/submit`,
      {}
    );
  }

  /** Phê duyệt phiếu nhập (Submitted -> Approved). */
  approve(id: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/approve`,
      {}
    );
  }

  /** Từ chối phiếu nhập (Submitted -> Rejected) kèm lý do. */
  reject(id: number, reason: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/reject`,
      JSON.stringify(reason.trim()),
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  /** Hủy phiếu nhập. */
  cancel(id: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/cancel`,
      {}
    );
  }

  startReceipt(
    orderId: number,
    inboundOrderItemId: number
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.http.post<ApiResponse<InboundOrderItemDto>>(
      `${this.base}/inbound-orders/${orderId}/receipts/start`,
      { inboundOrderItemId }
    );
  }

  recordQuantity(
    orderId: number,
    receiptId: number,
    quantityReceived: number,
    note?: string
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.http.post<ApiResponse<InboundOrderItemDto>>(
      `${this.base}/inbound-orders/${orderId}/receipts/${receiptId}/record-quantity`,
      { quantityReceived, note: note?.trim() || null }
    );
  }

  getPutawaySuggestions(
    orderId: number,
    receiptId: number
  ): Observable<ApiResponse<PutawaySuggestionDto[]>> {
    return this.http.get<ApiResponse<PutawaySuggestionDto[]>>(
      `${this.base}/inbound-orders/${orderId}/receipts/${receiptId}/putaway-suggestions`
    );
  }

  selectPutaway(
    orderId: number,
    receiptId: number,
    payload: SelectInboundPutawayDto
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.http.post<ApiResponse<InboundOrderItemDto>>(
      `${this.base}/inbound-orders/${orderId}/receipts/${receiptId}/select-putaway`,
      payload
    );
  }

  confirmReceipt(
    orderId: number,
    receiptId: number,
    operationKey: string
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.http.post<ApiResponse<InboundOrderItemDto>>(
      `${this.base}/inbound-orders/${orderId}/receipts/${receiptId}/confirm`,
      { operationKey }
    );
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * - search.value: từ khóa chung (POCode / nhà cung cấp / ghi chú)
   * - columns[].search.value: lọc theo cột (trạng thái, khoảng ngày dự kiến)
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterStatus?: string | null;
    expectedFrom?: string | null;
    expectedTo?: string | null;
  }): InboundOrderPagedAdvancedRequest {
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const statusValue = params.filterStatus?.trim() || '';
    const expectedRange = buildDateRange(
      params.expectedFrom ?? '',
      params.expectedTo ?? ''
    );

    return {
      draw: params.page,
      columns: [
        col('poCode'),
        col('supplierName'),
        col('warehouseName'),
        col('inboundOrderStatusName', statusValue),
        col('expectedDate', expectedRange),
        col('totalAssetValue'),
        col('createdDate'),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
