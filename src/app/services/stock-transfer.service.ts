import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  CreateStockTransferPayload,
  DTResponse,
  LocationSuggestion,
  SourceColumnBag,
  StockTransferDetail,
  StockTransferPagedRequest,
  StockTransferRow,
  StockTransferSummary,
  UpdateStockTransferPayload,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class StockTransferService extends ApiService {
  private readonly reportBase = '/stock-transfers';

  getPagedAdvanced(
    body: StockTransferPagedRequest
  ): Observable<ApiResponse<DTResponse<StockTransferRow>>> {
    return this.apiPost<DTResponse<StockTransferRow>>(
      `${this.reportBase}/paged-advanced`,
      body
    );
  }

  getSummary(): Observable<ApiResponse<StockTransferSummary>> {
    return this.apiGet<StockTransferSummary>(
      `${this.reportBase}/summary`
    );
  }

  getById(id: number): Observable<ApiResponse<StockTransferDetail>> {
    return this.apiGet<StockTransferDetail>(`${this.reportBase}/${id}`);
  }

  getSourceBags(
    fromWarehouseId: number,
    fromLocationId: number,
    productVariantId?: number | null
  ): Observable<ApiResponse<SourceColumnBag[]>> {
    return this.apiGet<SourceColumnBag[]>(
      `${this.reportBase}/source-bags`,
      {
        params: {
          fromWarehouseId: String(fromWarehouseId),
          fromLocationId: String(fromLocationId),
          productVariantId: productVariantId ? String(productVariantId) : undefined,
        },
      }
    );
  }

  getDestinationSuggestions(
    toWarehouseId: number,
    productVariantId: number,
    weightKg = 0
  ): Observable<ApiResponse<LocationSuggestion[]>> {
    return this.apiGet<LocationSuggestion[]>(
      `${this.reportBase}/destination-suggestions`,
      {
        params: {
          toWarehouseId: String(toWarehouseId),
          productVariantId: String(productVariantId),
          weightKg: String(weightKg || 0),
        },
      }
    );
  }

  getQuarantineSuggestions(
    fromWarehouseId: number,
    productVariantId: number,
    weightKg = 0
  ): Observable<ApiResponse<LocationSuggestion[]>> {
    return this.apiGet<LocationSuggestion[]>(
      `${this.reportBase}/quarantine-suggestions`,
      {
        params: {
          fromWarehouseId: String(fromWarehouseId),
          productVariantId: String(productVariantId),
          weightKg: String(weightKg || 0),
        },
      }
    );
  }

  create(
    payload: CreateStockTransferPayload
  ): Observable<ApiResponse<number>> {
    return this.apiPost<number>(this.reportBase, payload);
  }

  update(
    id: number,
    payload: UpdateStockTransferPayload
  ): Observable<ApiResponse<number>> {
    return this.apiPut<number>(`${this.reportBase}/${id}`, payload);
  }

  dispatch(id: number): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `${this.reportBase}/${id}/dispatch`,
      {}
    );
  }

  receive(id: number): Observable<ApiResponse<any>> {
    return this.apiPut<any>(`${this.reportBase}/${id}/receive`, {});
  }

  cancel(id: number, reason?: string): Observable<ApiResponse<any>> {
    return this.apiPut<any>(`${this.reportBase}/${id}/cancel`, {
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
    const columnFilters = {
      statusCode: params.statusCode || '',
      fromWarehouseId: params.fromWarehouseId ? String(params.fromWarehouseId) : '',
      toWarehouseId: params.toWarehouseId ? String(params.toWarehouseId) : '',
      transferDate: buildDateRange(params.dateFrom || '', params.dateTo || ''),
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField || 'createdDate',
        sortDir: params.sortDir || 'desc',
      },
      columns,
      columnFilters
    ) as StockTransferPagedRequest;
  }
}
