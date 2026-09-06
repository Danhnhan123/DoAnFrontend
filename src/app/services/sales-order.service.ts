import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  CreateCustomerDto,
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
export class SalesOrderService extends ApiService {

  getPaged(
    request: SalesOrderPagedRequest
  ): Observable<ApiResponse<SalesOrderPage>> {
    return this.apiPost<SalesOrderPage>(
      '/sales-orders/paged',
      request
    );
  }

  getById(id: number): Observable<ApiResponse<SalesOrderDetail>> {
    return this.apiGet<SalesOrderDetail>(
      `/sales-orders/${id}`
    );
  }

  create(
    payload: CreateSalesOrderPayload
  ): Observable<ApiResponse<{ id: number; soCode: string; totalAmount: number }>> {
    return this.apiPost<{ id: number; soCode: string; totalAmount: number }>('/sales-orders', payload);
  }

  update(
    id: number,
    payload: UpdateSalesOrderPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/sales-orders/${id}`,
      payload
    );
  }

  confirm(id: number): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/sales-orders/${id}/confirm`,
      {}
    );
  }

  reserve(id: number): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/sales-orders/${id}/reserve`,
      {}
    );
  }

  cancel(id: number, reason?: string | null): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/sales-orders/${id}/cancel`,
      { reason: reason?.trim() || null }
    );
  }

  createOutbound(
    id: number,
    payload: CreateOutboundPayload
  ): Observable<ApiResponse<{ outboundOrderId: number }>> {
    return this.apiPost<{ outboundOrderId: number }>(
      `/sales-orders/${id}/create-outbound`,
      payload
    );
  }

  getMillingOrders(
    salesOrderId: number
  ): Observable<ApiResponse<MillingOrderDetailDto[]>> {
    return this.apiGet<MillingOrderDetailDto[]>(
      `/milling-orders/by-sales-order/${salesOrderId}`
    );
  }

  getCustomers(): Observable<ApiResponse<CustomerSalesOption[]>> {
    return this.apiGet<CustomerSalesOption[]>(
      '/customers'
    );
  }

  createCustomer(
    payload: CreateCustomerDto
  ): Observable<ApiResponse<number>> {
    return this.apiPost<number>('/customers', payload);
  }

  getWarehouses(): Observable<ApiResponse<WarehouseSalesOption[]>> {
    return this.apiGet<WarehouseSalesOption[]>(
      '/warehouse'
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

    return this.apiGet<{
        dataSource: ProductVariantSalesOption[];
        total: number;
        totalFiltered: number;
      }>('/product-variant/search', { params });
  }
}
