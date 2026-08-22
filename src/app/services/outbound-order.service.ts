import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AllocateOutboundPayload,
  AllocationCandidateRow,
  ApiResponse,
  CompleteDeliveryPayload,
  ConfirmDispatchPayload,
  ConfirmPackingPayload,
  FailDeliveryPayload,
  OutboundBagAllocation,
  OutboundOrderDetail,
  OutboundOrderPage,
  OutboundOrderPagedRequest,
  OutboundQualityHoldResult,
  PickOutboundPayload,
} from '../models';

/**
 * Dịch vụ phiếu xuất kho / giao hàng (OutboundOrder).
 * Bao toàn bộ vòng đời: phân bổ (allocate) → lấy hàng (pick) → đóng gói
 * (confirm-packing) → xuất kho (confirm-dispatch) → giao hàng
 * (complete/fail-delivery) và hủy phiếu (cancel).
 */
@Injectable({ providedIn: 'root' })
export class OutboundOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPaged(
    request: OutboundOrderPagedRequest
  ): Observable<ApiResponse<OutboundOrderPage>> {
    return this.http.post<ApiResponse<OutboundOrderPage>>(
      `${this.base}/outbound-orders/paged`,
      request
    );
  }

  getById(id: number): Observable<ApiResponse<OutboundOrderDetail>> {
    return this.http.get<ApiResponse<OutboundOrderDetail>>(
      `${this.base}/outbound-orders/${id}`
    );
  }

  getAllocationCandidates(id: number): Observable<ApiResponse<AllocationCandidateRow[]>> {
    return this.http.get<ApiResponse<AllocationCandidateRow[]>>(
      `${this.base}/outbound-orders/${id}/allocation-candidates`
    );
  }

  getBagAllocations(id: number): Observable<ApiResponse<OutboundBagAllocation[]>> {
    return this.http.get<ApiResponse<OutboundBagAllocation[]>>(
      `${this.base}/outbound-orders/${id}/bag-allocations`
    );
  }

  allocate(
    id: number,
    payload: AllocateOutboundPayload
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/allocate`,
      payload
    );
  }

  pick(id: number, payload: PickOutboundPayload): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/pick`,
      payload
    );
  }

  reportBagQualityIssue(
    orderId: number,
    bagAllocationId: number,
    reason: string
  ): Observable<ApiResponse<OutboundQualityHoldResult>> {
    return this.http.post<ApiResponse<OutboundQualityHoldResult>>(
      `${this.base}/outbound-orders/${orderId}/bag-allocations/${bagAllocationId}/quality-hold`,
      { reason: reason.trim() }
    );
  }

  confirmPacking(
    id: number,
    payload: ConfirmPackingPayload
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/confirm-packing`,
      payload
    );
  }

  confirmDispatch(
    id: number,
    payload: ConfirmDispatchPayload
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/confirm-dispatch`,
      payload
    );
  }

  completeDelivery(
    id: number,
    payload: CompleteDeliveryPayload
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/complete-delivery`,
      payload
    );
  }

  failDelivery(
    id: number,
    payload: FailDeliveryPayload
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/fail-delivery`,
      payload
    );
  }

  /**
   * Hủy phiếu xuất kèm lý do. Backend nhận `reason` là tùy chọn; ràng buộc bắt
   * buộc nhập nằm ở UI (popup xác nhận không cho bỏ trống).
   */
  cancel(id: number, reason: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/cancel`,
      { reason: reason.trim() }
    );
  }

  forceUnlock(id: number, reason: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/force-unlock`,
      { reason: reason.trim() }
    );
  }
}
