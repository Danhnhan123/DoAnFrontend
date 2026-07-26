import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiResponse,
  CreateOutboundPayload,
  CreateSalesOrderPayload,
  CustomerSalesOption,
  MillingOrderDetailDto,
  ProductVariantSalesOption,
  SalesOrderDetail,
  SalesOrderPage,
  SalesOrderPagedRequest,
  UpdateSalesOrderPayload,
  WarehouseSalesOption,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPaged(
    request: SalesOrderPagedRequest
  ): Observable<ApiResponse<SalesOrderPage>> {
    return this.http.post<ApiResponse<SalesOrderPage>>(
      `${this.base}/sales-orders/paged`,
      request
    );
  }

  getById(id: number): Observable<ApiResponse<SalesOrderDetail>> {
    return this.http.get<ApiResponse<SalesOrderDetail>>(
      `${this.base}/sales-orders/${id}`
    );
  }

  create(
    payload: CreateSalesOrderPayload
  ): Observable<ApiResponse<{ id: number; soCode: string; totalAmount: number }>> {
    return this.http.post<
      ApiResponse<{ id: number; soCode: string; totalAmount: number }>
    >(`${this.base}/sales-orders`, payload);
  }

  update(
    id: number,
    payload: UpdateSalesOrderPayload
  ): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/sales-orders/${id}`,
      payload
    );
  }

  confirm(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/sales-orders/${id}/confirm`,
      {}
    );
  }

  reserve(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/sales-orders/${id}/reserve`,
      {}
    );
  }

  cancel(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/sales-orders/${id}/cancel`,
      {}
    );
  }

  createOutbound(
    id: number,
    payload: CreateOutboundPayload
  ): Observable<ApiResponse<{ outboundOrderId: number }>> {
    return this.http.post<ApiResponse<{ outboundOrderId: number }>>(
      `${this.base}/sales-orders/${id}/create-outbound`,
      payload
    );
  }

  getMillingOrders(
    salesOrderId: number
  ): Observable<ApiResponse<MillingOrderDetailDto[]>> {
    return this.http.get<ApiResponse<MillingOrderDetailDto[]>>(
      `${this.base}/milling-orders/by-sales-order/${salesOrderId}`
    );
  }

  getCustomers(): Observable<ApiResponse<CustomerSalesOption[]>> {
    return this.http.get<ApiResponse<CustomerSalesOption[]>>(
      `${this.base}/customers`
    );
  }

  getWarehouses(): Observable<ApiResponse<WarehouseSalesOption[]>> {
    return this.http.get<ApiResponse<WarehouseSalesOption[]>>(
      `${this.base}/warehouse`
    );
  }

getProductVariants(
  keyword = ''
): Observable<
  ApiResponse<{
    dataSource: ProductVariantSalesOption[];
    total: number;
    totalFiltered: number;
  }>
> {
  let params = new HttpParams()
    .set('pageIndex', 1)
    .set('pageSize', 1000)
    .set('isActive', true);

  if (keyword.trim()) {
    params = params.set('keyword', keyword.trim());
  }

  return this.http.get<
    ApiResponse<{
      dataSource: ProductVariantSalesOption[];
      total: number;
      totalFiltered: number;
    }>
  >(`${this.base}/product-variant/search`, { params });
}
}

