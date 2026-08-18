import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiResponse,
  CreateStockTransferPayload,
  DTResponse,
  StockTransferDetail,
  StockTransferPagedRequest,
  StockTransferRow,
  StockTransferSummary,
  UpdateStockTransferPayload,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class StockTransferService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.baseUrl}/stock-transfers`;

  getPagedAdvanced(
    body: StockTransferPagedRequest
  ): Observable<ApiResponse<DTResponse<StockTransferRow>>> {
    return this.http.post<ApiResponse<DTResponse<StockTransferRow>>>(
      `${this.base}/paged-advanced`,
      body
    );
  }

  getSummary(): Observable<ApiResponse<StockTransferSummary>> {
    return this.http.get<ApiResponse<StockTransferSummary>>(
      `${this.base}/summary`
    );
  }

  getById(id: number): Observable<ApiResponse<StockTransferDetail>> {
    return this.http.get<ApiResponse<StockTransferDetail>>(`${this.base}/${id}`);
  }

  create(
    payload: CreateStockTransferPayload
  ): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(this.base, payload);
  }

  update(
    id: number,
    payload: UpdateStockTransferPayload
  ): Observable<ApiResponse<number>> {
    return this.http.put<ApiResponse<number>>(`${this.base}/${id}`, payload);
  }

  dispatch(id: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/${id}/dispatch`,
      {}
    );
  }

  receive(id: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/${id}/receive`, {});
  }

  cancel(id: number, reason?: string): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/${id}/cancel`, {
      reason: reason?.trim() || null,
    });
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    statusCode?: string | null;
    fromWarehouseId?: number | null;
    toWarehouseId?: number | null;
    dateFrom?: string;
    dateTo?: string;
    sortField?: string;
    sortDir?: 'asc' | 'desc';
  }): StockTransferPagedRequest {
    const columns = [
      'transferCode',
      'fromWarehouseId',
      'toWarehouseId',
      'itemDisplay',
      'itemCount',
      'totalWeightKg',
      'statusCode',
      'transferDate',
      'createdDate',
      'id',
    ];
    const sortField = params.sortField || 'createdDate';
    const sortIndex = Math.max(0, columns.indexOf(sortField));
    const column = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: columns.map((name) => {
        if (name === 'statusCode') return column(name, params.statusCode || '');
        if (name === 'fromWarehouseId') {
          return column(
            name,
            params.fromWarehouseId ? String(params.fromWarehouseId) : ''
          );
        }
        if (name === 'toWarehouseId') {
          return column(
            name,
            params.toWarehouseId ? String(params.toWarehouseId) : ''
          );
        }
        if (name === 'transferDate') {
          return column(
            name,
            buildDateRange(params.dateFrom || '', params.dateTo || '')
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
        value: params.search.trim(),
        regex: false,
        fixed: [],
      },
    };
  }
}
