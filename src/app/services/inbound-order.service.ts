import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models';
import {
  CreateInboundOrderDto,
  InboundOrderDetailDto,
  InboundOrderListQuery,
  InboundOrderPagingData,
  ProductVariantOption,
  WarehouseOption,
} from '../models/inbound-order';

@Injectable({ providedIn: 'root' })
export class InboundOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPaged(
    query: InboundOrderListQuery
  ): Observable<ApiResponse<InboundOrderPagingData>> {
    const params = new HttpParams()
      .set('pageIndex', String(query.pageIndex))
      .set('pageSize', String(query.pageSize))
      .set('keyword', query.keyword.trim())
      .set('sortType', query.sortType ?? 'desc')
      .set('orderBy', query.orderBy ?? 'createdDate');

    return this.http.get<ApiResponse<InboundOrderPagingData>>(
      `${this.base}/inbound-orders`,
      { params }
    );
  }

  getById(id: number): Observable<ApiResponse<InboundOrderDetailDto>> {
    return this.http.get<ApiResponse<InboundOrderDetailDto>>(
      `${this.base}/inbound-orders/${id}`
    );
  }

  create(payload: CreateInboundOrderDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(
      `${this.base}/inbound-orders`,
      payload
    );
  }

  update(id: number, payload: any): Observable<ApiResponse<number>> {
    return this.http.put<ApiResponse<number>>(
      `${this.base}/inbound-orders/${id}`,
      payload
    );
  }

  submit(id: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/submit`,
      {}
    );
  }

  approve(id: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/approve`,
      {}
    );
  }

  reject(id: number, reason: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/reject`,
      JSON.stringify(reason.trim()),
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      }
    );
  }

  cancel(id: number): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/inbound-orders/${id}/cancel`,
      {}
    );
  }

  getWarehouses(): Observable<ApiResponse<WarehouseOption[]>> {
    return this.http.get<ApiResponse<WarehouseOption[]>>(
      `${this.base}/warehouse`
    );
  }

  getProductVariants(): Observable<ApiResponse<ProductVariantOption[]>> {
    return this.http.get<ApiResponse<ProductVariantOption[]>>(
      `${this.base}/product-variant`
    );
  }
}
