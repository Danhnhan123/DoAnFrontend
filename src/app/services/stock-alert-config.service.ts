import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  StockAlertConfigDetailDto,
  StockAlertConfigPagedAdvancedRequest,
  CreateStockAlertConfigDto,
  UpdateStockAlertConfigDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class StockAlertConfigService extends ApiService {

  getPagedAdvanced(
    body: StockAlertConfigPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/stock-alert-configs/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<StockAlertConfigDetailDto>> {
    return this.apiGet<StockAlertConfigDetailDto>(
      `/stock-alert-configs/${id}`
    );
  }

  create(payload: CreateStockAlertConfigDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/stock-alert-configs',
      payload
    );
  }

  update(payload: UpdateStockAlertConfigDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/stock-alert-configs',
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/stock-alert-configs/${id}`);
  }

  /** Danh sách kho cho dropdown (GET /warehouse). */
  getWarehouseOptions(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/warehouse');
  }

  /** Danh sách SKU/biến thể cho dropdown (GET /product-variants). */
  getVariantOptions(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/product-variant');
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterWarehouseId: number | null;
    filterVariantId: number | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): StockAlertConfigPagedAdvancedRequest {
    const columns = ['id', 'warehouseId', 'warehouseName', 'productVariantId', 'productVariantSku', 'minThreshold', 'isActive', 'createdDate'];
    const columnFilters = {
      warehouseId: params.filterWarehouseId != null ? String(params.filterWarehouseId) : '',
      productVariantId: params.filterVariantId != null ? String(params.filterVariantId) : '',
      isActive: params.filterIsActive != null ? String(params.filterIsActive) : '',
      createdDate: buildDateRange(params.dateFrom ?? '', params.dateTo ?? ''),
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      columnFilters
    ) as StockAlertConfigPagedAdvancedRequest;
  }
}
