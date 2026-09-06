import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
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
export class OutboundOrderService extends ApiService {

  getPaged(
    request: OutboundOrderPagedRequest
  ): Observable<ApiResponse<OutboundOrderPage>> {
    return this.apiPost<OutboundOrderPage>(
      '/outbound-orders/paged',
      request
    );
  }

  getById(id: number): Observable<ApiResponse<OutboundOrderDetail>> {
    return this.apiGet<OutboundOrderDetail>(
      `/outbound-orders/${id}`
    );
  }

  getAllocationCandidates(id: number): Observable<ApiResponse<AllocationCandidateRow[]>> {
    return this.apiGet<AllocationCandidateRow[]>(
      `/outbound-orders/${id}/allocation-candidates`
    );
  }

  getBagAllocations(id: number): Observable<ApiResponse<OutboundBagAllocation[]>> {
    return this.apiGet<OutboundBagAllocation[]>(
      `/outbound-orders/${id}/bag-allocations`
    );
  }

  allocate(
    id: number,
    payload: AllocateOutboundPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/allocate`,
      payload
    );
  }

  pick(id: number, payload: PickOutboundPayload): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/pick`,
      payload
    );
  }

  reportBagQualityIssue(
    orderId: number,
    bagAllocationId: number,
    reason: string
  ): Observable<ApiResponse<OutboundQualityHoldResult>> {
    return this.apiPost<OutboundQualityHoldResult>(
      `/outbound-orders/${orderId}/bag-allocations/${bagAllocationId}/quality-hold`,
      { reason: reason.trim() }
    );
  }

  confirmPacking(
    id: number,
    payload: ConfirmPackingPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/confirm-packing`,
      payload
    );
  }

  confirmDispatch(
    id: number,
    payload: ConfirmDispatchPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/confirm-dispatch`,
      payload
    );
  }

  completeDelivery(
    id: number,
    payload: CompleteDeliveryPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/complete-delivery`,
      payload
    );
  }

  failDelivery(
    id: number,
    payload: FailDeliveryPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/fail-delivery`,
      payload
    );
  }

  /**
   * Hủy phiếu xuất kèm lý do. Backend nhận `reason` là tùy chọn; ràng buộc bắt
   * buộc nhập nằm ở UI (popup xác nhận không cho bỏ trống).
   */
  cancel(id: number, reason: string): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/cancel`,
      { reason: reason.trim() }
    );
  }

  forceUnlock(id: number, reason: string): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/outbound-orders/${id}/force-unlock`,
      { reason: reason.trim() }
    );
  }
}
