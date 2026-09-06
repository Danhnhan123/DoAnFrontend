import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  CompleteMillingOrderPayload,
  CreateMillingOrderPayload,
  DTResponse,
  MillingLocationOption,
  MillingOperatorOption,
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
export class MillingOrderService extends ApiService {

  getPaged(
    body: MillingOrderPagedRequest
  ): Observable<ApiResponse<DTResponse<MillingOrderRow>>> {
    return this.apiPost<DTResponse<MillingOrderRow>>(
      '/milling-orders/paged-advanced',
      body
    );
  }

  getAll(): Observable<ApiResponse<MillingOrderRow[]>> {
    return this.apiGet<MillingOrderRow[]>(
      '/milling-orders'
    );
  }

  getOperators(): Observable<ApiResponse<MillingOperatorOption[]>> {
    return this.apiGet<MillingOperatorOption[]>(
      '/milling-orders/operators'
    );
  }

  getById(id: number): Observable<ApiResponse<MillingOrderDetailDto>> {
    return this.apiGet<MillingOrderDetailDto>(
      `/milling-orders/${id}`
    );
  }

  create(payload: CreateMillingOrderPayload): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/milling-orders',
      payload
    );
  }

  update(payload: UpdateMillingOrderPayload): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/milling-orders',
      payload
    );
  }

  reserve(
    id: number,
    payload: ReserveMillingOrderPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/milling-orders/${id}/reserve`,
      payload
    );
  }

  start(id: number): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/milling-orders/${id}/start`,
      {}
    );
  }

  complete(
    id: number,
    payload: CompleteMillingOrderPayload
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/milling-orders/${id}/complete`,
      payload
    );
  }

  cancel(id: number): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/milling-orders/${id}/cancel`,
      {}
    );
  }

  getWarehouses(): Observable<ApiResponse<MillingWarehouseOption[]>> {
    return this.apiGet<MillingWarehouseOption[]>(
      '/warehouse'
    );
  }

  getLocations(): Observable<ApiResponse<MillingLocationOption[]>> {
    return this.apiGet<MillingLocationOption[]>(
      '/location'
    );
  }

  getPaddyLots(): Observable<ApiResponse<MillingPaddyLotOption[]>> {
    return this.apiGet<MillingPaddyLotOption[]>(
      `/paddy-lots`
    );
  }

  getProductVariants(): Observable<ApiResponse<MillingProductVariantOption[]>> {
    return this.apiGet<MillingProductVariantOption[]>(
      '/product-variant'
    );
  }

  getYieldConfigs(): Observable<ApiResponse<MillingYieldOption[]>> {
    return this.apiGet<MillingYieldOption[]>(
      `/milling-yield-configs`
    );
  }

  suggestSources(id: number): Observable<ApiResponse<MillingSourceSuggestionResult>> {
    return this.apiGet<MillingSourceSuggestionResult>(
      `/milling-orders/${id}/source-suggestions`
    );
  }

  getRiceVarieties(): Observable<ApiResponse<RiceVarietyDetailDto[]>> {
    return this.apiGet<RiceVarietyDetailDto[]>(
      `/rice-varieties`
    );
  }

  getSalesOrders(): Observable<ApiResponse<MillingSalesOrderPage>> {
    return this.apiPost<MillingSalesOrderPage>(
      `/sales-orders/paged`,
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
    const columns = [
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
    const columnFilters = {
      statusId: params.statusId ? String(params.statusId) : '',
      warehouseId: params.warehouseId ? String(params.warehouseId) : '',
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search || '',
        sortField: params.sortField || 'createdDate',
        sortDir: params.sortDir || 'desc',
      },
      columns,
      columnFilters
    ) as MillingOrderPagedRequest;
  }
}
