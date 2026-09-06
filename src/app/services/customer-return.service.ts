import { HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
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
export class CustomerReturnService extends ApiService {
  private readonly reportBase = '/customer-returns';

  getPaged(
    query: CustomerReturnPagedQuery,
  ): Observable<ApiResponse<CustomerReturnPage>> {
    return this.apiPost<CustomerReturnPage>(
      `${this.reportBase}/paged`,
      query,
    );
  }

  getById(id: number): Observable<ApiResponse<CustomerReturnDetail>> {
    return this.apiGet<CustomerReturnDetail>(
      `${this.reportBase}/${id}`,
    );
  }

  create(
    payload: CreateCustomerReturnPayload,
  ): Observable<ApiResponse<string>> {
    return this.apiPost<string>(this.reportBase, payload);
  }

  getSources(keyword = ""): Observable<ApiResponse<CustomerReturnSourceOrder[]>> {
    let params = new HttpParams().set("page", 1).set("pageSize", 1000);
    if (keyword.trim()) params = params.set("keyword", keyword.trim());
    return this.apiGet<CustomerReturnSourceOrder[]>(
      `${this.reportBase}/sources`,
      { params },
    );
  }

  getSourceById(outboundOrderId: number): Observable<ApiResponse<CustomerReturnSourceDetail>> {
    return this.apiGet<CustomerReturnSourceDetail>(
      `${this.reportBase}/sources/${outboundOrderId}`,
    );
  }

  update(payload: UpdateCustomerReturnPayload): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(this.reportBase, payload);
  }

  submit(id: number): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(`${this.reportBase}/${id}/submit`, {});
  }

  approve(id: number, note?: string): Observable<ApiResponse<unknown>> {
    let params = new HttpParams();
    if (note?.trim()) params = params.set("note", note.trim());
    return this.apiPut<unknown>(
      `${this.reportBase}/${id}/approve`,
      {},
      { params },
    );
  }

  reject(id: number, reason: string): Observable<ApiResponse<unknown>> {
    const params = new HttpParams().set("reason", reason);
    return this.apiPut<unknown>(`${this.reportBase}/${id}/reject`, {}, { params });
  }

  receive(payload: ReceiveCustomerReturnPayload): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(`${this.reportBase}/receive`, payload);
  }

  inspect(
    payload: InspectCustomerReturnPayload,
  ): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(`${this.reportBase}/inspect`, payload);
  }

  getImpactPreview(
    id: number,
  ): Observable<ApiResponse<CustomerReturnImpactPreview>> {
    return this.apiGet<CustomerReturnImpactPreview>(
      `${this.reportBase}/${id}/impact-preview`,
    );
  }

  confirm(id: number): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(
      `${this.reportBase}/${id}/confirm`,
      {},
    );
  }

  registerRefund(id: number, payload: RegisterCustomerReturnRefundPayload): Observable<ApiResponse<unknown>> {
    return this.apiPost<unknown>(`${this.reportBase}/${id}/refunds`, payload);
  }

  cancel(id: number, reason: string): Observable<ApiResponse<unknown>> {
    const params = new HttpParams().set("reason", reason);
    return this.apiPut<unknown>(`${this.reportBase}/${id}/cancel`, {}, { params });
  }
}
