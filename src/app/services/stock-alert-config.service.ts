import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  StockAlertConfigDetailDto,
  StockAlertConfigPagedAdvancedRequest,
  CreateStockAlertConfigDto,
  UpdateStockAlertConfigDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class StockAlertConfigService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: StockAlertConfigPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/stock-alert-configs/paged-advanced`,
      body
    );
  }

  getById(id: number): Observable<ApiResponse<StockAlertConfigDetailDto>> {
    return this.http.get<ApiResponse<StockAlertConfigDetailDto>>(
      `${this.base}/stock-alert-configs/${id}`
    );
  }

  create(payload: CreateStockAlertConfigDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/stock-alert-configs`,
      payload
    );
  }

  update(payload: UpdateStockAlertConfigDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/stock-alert-configs`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/stock-alert-configs/${id}`
    );
  }

  /** Danh sách kho cho dropdown (GET /warehouse). */
  getWarehouseOptions(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.base}/warehouse`);
  }

  /** Danh sách SKU/biến thể cho dropdown (GET /product-variants). */
  getVariantOptions(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.base}/product-variants`);
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
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const activeValue =
      params.filterIsActive != null ? String(params.filterIsActive) : '';
    const warehouseValue =
      params.filterWarehouseId != null ? String(params.filterWarehouseId) : '';
    const variantValue =
      params.filterVariantId != null ? String(params.filterVariantId) : '';
    const dateSearch = buildDateRange(
      params.dateFrom ?? '',
      params.dateTo ?? ''
    );

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('warehouseId', warehouseValue),
        col('warehouseName'),
        col('productVariantId', variantValue),
        col('productVariantSku'),
        col('minThreshold'),
        col('isActive', activeValue),
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
