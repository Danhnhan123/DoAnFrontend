import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models';
import {
  InboundOrderDetailDto,
  InboundOrderItemDto,
  InboundOrderPagedAdvancedRequest,
  PutawaySuggestionDto,
  BagPutawayPlanDto,
  BagPutawayColumnRequestDto,
  SelectInboundPutawayDto,
} from '../models/inbound-order';
import { buildDateRange } from '../utils/date.utils';
import { buildDataTablesRequest } from '../utils/datatable.util';

/**
 * Dịch vụ phiếu nhập kho và Store-in/Put-away.
 */
@Injectable({ providedIn: 'root' })
export class InboundOrderService extends ApiService {

  /** Danh sách phiếu nhập dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: InboundOrderPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/inbound-orders/paged-advanced',
      body
    );
  }

  /**
   * Danh sách phiếu nhập lúa/gạo đang chờ xếp kho (put-away) cho màn Store-in.
   * Gộp 1 request (thay cho list + N getById) — backend đã hydrate sẵn item.
   */
  getPutawayPending(): Observable<ApiResponse<InboundOrderDetailDto[]>> {
    return this.apiGet<InboundOrderDetailDto[]>(
      '/inbound-orders/putaway-pending'
    );
  }

  /** Chi tiết phiếu nhập (header + dòng hàng + chứng từ). */
  getById(id: number): Observable<ApiResponse<InboundOrderDetailDto>> {
    return this.apiGet<InboundOrderDetailDto>(
      `/inbound-orders/${id}`
    );
  }

  submit(id: number): Observable<ApiResponse<unknown>> {
    return this.apiPost<unknown>(
      `/inbound-orders/${id}/submit`,
      {}
    );
  }

  /** Phê duyệt phiếu nhập (Submitted -> Approved). */
  approve(id: number): Observable<ApiResponse<unknown>> {
    return this.apiPost<unknown>(
      `/inbound-orders/${id}/approve`,
      {}
    );
  }

  /** Từ chối phiếu nhập (Submitted -> Rejected) kèm lý do. */
  reject(id: number, reason: string): Observable<ApiResponse<unknown>> {
    return this.apiPost<unknown>(
      `/inbound-orders/${id}/reject`,
      JSON.stringify(reason.trim()),
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  /** Hủy phiếu nhập. */
  cancel(id: number): Observable<ApiResponse<unknown>> {
    return this.apiPost<unknown>(
      `/inbound-orders/${id}/cancel`,
      {}
    );
  }

  startReceipt(
    orderId: number,
    inboundOrderItemId: number
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.apiPost<InboundOrderItemDto>(
      `/inbound-orders/${orderId}/receipts/start`,
      { inboundOrderItemId }
    );
  }

  recordQuantity(
    orderId: number,
    receiptId: number,
    quantityReceived: number,
    note?: string
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.apiPost<InboundOrderItemDto>(
      `/inbound-orders/${orderId}/receipts/${receiptId}/record-quantity`,
      { quantityReceived, note: note?.trim() || null }
    );
  }

  getPutawaySuggestions(
    orderId: number,
    receiptId: number
  ): Observable<ApiResponse<PutawaySuggestionDto[]>> {
    return this.apiGet<PutawaySuggestionDto[]>(
      `/inbound-orders/${orderId}/receipts/${receiptId}/putaway-suggestions`
    );
  }

  getBagPutawayPlan(orderId: number, receiptId: number): Observable<ApiResponse<BagPutawayPlanDto>> {
    return this.apiGet<BagPutawayPlanDto>(
      `/inbound-orders/${orderId}/receipts/${receiptId}/bag-putaway-plan`
    );
  }

  selectPutaway(
    orderId: number,
    receiptId: number,
    payload: SelectInboundPutawayDto
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.apiPost<InboundOrderItemDto>(
      `/inbound-orders/${orderId}/receipts/${receiptId}/select-putaway`,
      payload
    );
  }

  confirmReceipt(
    orderId: number,
    receiptId: number,
    operationKey: string,
    columns?: BagPutawayColumnRequestDto[]
  ): Observable<ApiResponse<InboundOrderItemDto>> {
    return this.apiPost<InboundOrderItemDto>(
      `/inbound-orders/${orderId}/receipts/${receiptId}/confirm`,
      { operationKey, columns: columns?.length ? columns : null }
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
    const columns = ['poCode', 'supplierName', 'warehouseName', 'inboundOrderStatusName', 'expectedDate', 'totalAssetValue', 'createdDate'];
    const columnFilters = {
      inboundOrderStatusName: params.filterStatus?.trim() || '',
      expectedDate: buildDateRange(
        params.expectedFrom ?? '',
        params.expectedTo ?? ''
      ),
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      columnFilters
    ) as InboundOrderPagedAdvancedRequest;
  }
}
