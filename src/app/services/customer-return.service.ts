import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import { ApiResponse } from "../models/common";
import {
  CreateCustomerReturnPayload,
  CustomerReturnDetail,
  CustomerReturnImpactPreview,
  CustomerReturnPage,
  CustomerReturnPagedQuery,
  CustomerReturnSourceDetail,
  CustomerReturnSourceOrder,
  InspectCustomerReturnPayload,
  ReceiveCustomerReturnPayload,
  RegisterCustomerReturnRefundPayload,
  UpdateCustomerReturnPayload,
} from "../models/customer-return";

@Injectable({ providedIn: "root" })
export class CustomerReturnService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.baseUrl}/customer-returns`;

  getPaged(
    query: CustomerReturnPagedQuery,
  ): Observable<ApiResponse<CustomerReturnPage>> {
    return this.http.post<ApiResponse<CustomerReturnPage>>(
      `${this.base}/paged`,
      query,
    );
  }

  getById(id: number): Observable<ApiResponse<CustomerReturnDetail>> {
    return this.http.get<ApiResponse<CustomerReturnDetail>>(
      `${this.base}/${id}`,
    );
  }

  create(
    payload: CreateCustomerReturnPayload,
  ): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(this.base, payload);
  }

  getSources(keyword = ""): Observable<ApiResponse<CustomerReturnSourceOrder[]>> {
    let params = new HttpParams().set("page", 1).set("pageSize", 1000);
    if (keyword.trim()) params = params.set("keyword", keyword.trim());
    return this.http.get<ApiResponse<CustomerReturnSourceOrder[]>>(
      `${this.base}/sources`,
      { params },
    );
  }

  getSourceById(outboundOrderId: number): Observable<ApiResponse<CustomerReturnSourceDetail>> {
    return this.http.get<ApiResponse<CustomerReturnSourceDetail>>(
      `${this.base}/sources/${outboundOrderId}`,
    );
  }

  update(payload: UpdateCustomerReturnPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(this.base, payload);
  }

  submit(id: number): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}/submit`, {});
  }

  approve(id: number, note?: string): Observable<ApiResponse<unknown>> {
    let params = new HttpParams();
    if (note?.trim()) params = params.set("note", note.trim());
    return this.http.put<ApiResponse<unknown>>(
      `${this.base}/${id}/approve`,
      {},
      { params },
    );
  }

  reject(id: number, reason: string): Observable<ApiResponse<unknown>> {
    const params = new HttpParams().set("reason", reason);
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}/reject`, {}, { params });
  }

  receive(payload: ReceiveCustomerReturnPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/receive`, payload);
  }

  inspect(
    payload: InspectCustomerReturnPayload,
  ): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/inspect`, payload);
  }

  getImpactPreview(
    id: number,
  ): Observable<ApiResponse<CustomerReturnImpactPreview>> {
    return this.http.get<ApiResponse<CustomerReturnImpactPreview>>(
      `${this.base}/${id}/impact-preview`,
    );
  }

  confirm(id: number): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(
      `${this.base}/${id}/confirm`,
      {},
    );
  }

  registerRefund(id: number, payload: RegisterCustomerReturnRefundPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${id}/refunds`, payload);
  }

  cancel(id: number, reason: string): Observable<ApiResponse<unknown>> {
    const params = new HttpParams().set("reason", reason);
    return this.http.put<ApiResponse<unknown>>(
      `${this.base}/${id}/cancel`,
      {},
      { params },
    );
  }
}
