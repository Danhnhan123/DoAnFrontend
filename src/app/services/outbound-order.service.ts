import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AllocateOutboundPayload,
  ApiResponse,
  CompleteDeliveryPayload,
  ConfirmDispatchPayload,
  ConfirmPackingPayload,
  FailDeliveryPayload,
  OutboundOrderDetail,
  OutboundOrderPage,
  OutboundOrderPagedRequest,
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

  getAllocationCandidates(id: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.base}/outbound-orders/${id}/allocation-candidates`
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

  cancel(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/outbound-orders/${id}/cancel`,
      {}
    );
  }
}
