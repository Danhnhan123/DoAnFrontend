import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  AlertDetailDto,
  AlertSummaryDto,
  AlertPagedAdvancedRequest,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: AlertPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/alerts/paged-advanced`,
      body
    );
  }

  getSummary(): Observable<ApiResponse<AlertSummaryDto>> {
    return this.http.get<ApiResponse<AlertSummaryDto>>(
      `${this.base}/alerts/summary`
    );
  }

  getById(id: number): Observable<ApiResponse<AlertDetailDto>> {
    return this.http.get<ApiResponse<AlertDetailDto>>(
      `${this.base}/alerts/${id}`
    );
  }

  acknowledge(id: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/alerts/${id}/acknowledge`,
      {}
    );
  }

  resolve(id: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/alerts/${id}/resolve`,
      {}
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/alerts/${id}`);
  }

  /** Danh sách kho cho dropdown lọc (GET /warehouse). */
  getWarehouseOptions(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.base}/warehouse`);
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterAlertType: string | null;
    filterSeverity: string | null;
    filterStatus: string | null;
    filterWarehouseId: number | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): AlertPagedAdvancedRequest {
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const warehouseValue =
      params.filterWarehouseId != null ? String(params.filterWarehouseId) : '';
    const dateSearch = buildDateRange(
      params.dateFrom ?? '',
      params.dateTo ?? ''
    );

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('alertType', params.filterAlertType ?? ''),
        col('severity', params.filterSeverity ?? ''),
        col('status', params.filterStatus ?? ''),
        col('warehouseId', warehouseValue),
        col('warehouseName'),
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
