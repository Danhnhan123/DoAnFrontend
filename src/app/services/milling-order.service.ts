import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiResponse,
  CompleteMillingOrderPayload,
  CreateMillingOrderPayload,
  DTResponse,
  MillingLocationOption,
  MillingOrderDetailDto,
  MillingOrderPagedRequest,
  MillingOrderRow,
  MillingPaddyLotOption,
  MillingProductVariantOption,
  MillingSalesOrderPage,
  MillingSourceSuggestionResult,
  MillingWarehouseOption,
  MillingYieldOption,
  RiceVarietyDetailDto,
  ReserveMillingOrderPayload,
  UpdateMillingOrderPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class MillingOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPaged(
    body: MillingOrderPagedRequest
  ): Observable<ApiResponse<DTResponse<MillingOrderRow>>> {
    return this.http.post<ApiResponse<DTResponse<MillingOrderRow>>>(
      `${this.base}/milling-orders/paged-advanced`,
      body
    );
  }

  getAll(): Observable<ApiResponse<MillingOrderRow[]>> {
    return this.http.get<ApiResponse<MillingOrderRow[]>>(
      `${this.base}/milling-orders`
    );
  }

  getById(id: number): Observable<ApiResponse<MillingOrderDetailDto>> {
    return this.http.get<ApiResponse<MillingOrderDetailDto>>(
      `${this.base}/milling-orders/${id}`
    );
  }

  create(payload: CreateMillingOrderPayload): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/milling-orders`,
      payload
    );
  }

  update(payload: UpdateMillingOrderPayload): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/milling-orders`,
      payload
    );
  }

  reserve(
    id: number,
    payload: ReserveMillingOrderPayload
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/milling-orders/${id}/reserve`,
      payload
    );
  }

  start(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/milling-orders/${id}/start`,
      {}
    );
  }

  complete(
    id: number,
    payload: CompleteMillingOrderPayload
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/milling-orders/${id}/complete`,
      payload
    );
  }

  cancel(id: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/milling-orders/${id}/cancel`,
      {}
    );
  }

  getWarehouses(): Observable<ApiResponse<MillingWarehouseOption[]>> {
    return this.http.get<ApiResponse<MillingWarehouseOption[]>>(
      `${this.base}/warehouse`
    );
  }

  getLocations(): Observable<ApiResponse<MillingLocationOption[]>> {
    return this.http.get<ApiResponse<MillingLocationOption[]>>(
      `${this.base}/location`
    );
  }

  getPaddyLots(): Observable<ApiResponse<MillingPaddyLotOption[]>> {
    return this.http.get<ApiResponse<MillingPaddyLotOption[]>>(
      `${this.base}/paddy-lots`
    );
  }

  getProductVariants(): Observable<ApiResponse<MillingProductVariantOption[]>> {
    return this.http.get<ApiResponse<MillingProductVariantOption[]>>(
      `${this.base}/product-variant`
    );
  }

  getYieldConfigs(): Observable<ApiResponse<MillingYieldOption[]>> {
    return this.http.get<ApiResponse<MillingYieldOption[]>>(
      `${this.base}/milling-yield-configs`
    );
  }

  suggestSources(id: number): Observable<ApiResponse<MillingSourceSuggestionResult>> {
    return this.http.get<ApiResponse<MillingSourceSuggestionResult>>(
      `${this.base}/milling-orders/${id}/source-suggestions`
    );
  }

  getRiceVarieties(): Observable<ApiResponse<RiceVarietyDetailDto[]>> {
    return this.http.get<ApiResponse<RiceVarietyDetailDto[]>>(
      `${this.base}/rice-varieties`
    );
  }

  getSalesOrders(): Observable<ApiResponse<MillingSalesOrderPage>> {
    return this.http.post<ApiResponse<MillingSalesOrderPage>>(
      `${this.base}/sales-orders/paged`,
      { page: 1, pageSize: 200 }
    );
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search?: string;
    statusId?: number | null;
    warehouseId?: number | null;
    sortField?: string;
    sortDir?: 'asc' | 'desc';
  }): MillingOrderPagedRequest {
    const names = [
      'id',
      'millingCode',
      'statusId',
      'warehouseId',
      'totalRiceOutputKg',
      'yieldRateUsed',
      'startedAt',
      'completedAt',
      'createdDate',
    ];
    const sortField = params.sortField || 'createdDate';
    const sortIndex = Math.max(0, names.indexOf(sortField));
    const column = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: names.map((name) => {
        if (name === 'statusId') {
          return column(name, params.statusId ? String(params.statusId) : '');
        }
        if (name === 'warehouseId') {
          return column(
            name,
            params.warehouseId ? String(params.warehouseId) : ''
          );
        }
        return column(name);
      }),
      order: [
        {
          column: sortIndex,
          dir: params.sortDir || 'desc',
          name: sortField,
        },
      ],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: {
        value: (params.search || '').trim(),
        regex: false,
        fixed: [],
      },
    };
  }
}
