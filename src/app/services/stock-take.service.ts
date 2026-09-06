import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  CreateStockTakePayload,
  DTResponse,
  SaveStockTakeCountsPayload,
  StockTakeBagTargetSuggestion,
  StockTakeDetail,
  StockTakePagedRequest,
  StockTakeRow,
  StockTakeScopeOptions,
  StockTakeSummary,
  StockTakeThresholds,
} from '../models';

@Injectable({ providedIn: 'root' })
export class StockTakeService extends ApiService {
  private readonly reportBase = '/stocktakes';

  getPagedAdvanced(body: StockTakePagedRequest): Observable<ApiResponse<DTResponse<StockTakeRow>>> {
    return this.apiPost<DTResponse<StockTakeRow>>(`${this.reportBase}/paged-advanced`, body);
  }

  getSummary(): Observable<ApiResponse<StockTakeSummary>> {
    return this.apiGet<StockTakeSummary>(`${this.reportBase}/summary`);
  }

  getThresholds(): Observable<ApiResponse<StockTakeThresholds>> {
    return this.apiGet<StockTakeThresholds>(`${this.reportBase}/thresholds`);
  }

  getById(id: number): Observable<ApiResponse<StockTakeDetail>> {
    return this.apiGet<StockTakeDetail>(`${this.reportBase}/${id}`);
  }

  create(payload: CreateStockTakePayload): Observable<ApiResponse<number>> {
    return this.apiPost<number>(this.reportBase, payload);
  }

  saveCounts(id: number, payload: SaveStockTakeCountsPayload): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(`${this.reportBase}/${id}/counts`, payload);
  }

  submit(id: number, note?: string | null): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(`${this.reportBase}/${id}/submit`, { note: note?.trim() || null });
  }

  approve(id: number, approveNote?: string | null): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(`${this.reportBase}/${id}/approve`, { approveNote: approveNote?.trim() || null });
  }

  reject(id: number, reason: string): Observable<ApiResponse<unknown>> {
    return this.apiPut<unknown>(`${this.reportBase}/${id}/reject`, { reason: reason.trim() });
  }

  /** Cột đang có bao — nguồn dropdown chọn cột cần kiểm kê. */
  getScopeOptions(warehouseId: number, quarantineOnly?: boolean | null): Observable<ApiResponse<StockTakeScopeOptions>> {
    return this.apiGet<StockTakeScopeOptions>(`${this.reportBase}/scope-options`, {
      params: {
        warehouseId,
        quarantineOnly: quarantineOnly ?? undefined,
      },
    });
  }

  /** Gợi ý ô cách ly / cột thường cho một bao (vẫn chọn lại được). */
  getBagTargetSuggestions(id: number, bagId: number): Observable<ApiResponse<StockTakeBagTargetSuggestion[]>> {
    return this.apiGet<StockTakeBagTargetSuggestion[]>(`${this.reportBase}/${id}/bags/${bagId}/target-suggestions`);
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    statusId?: number | null;
    warehouseId?: number | null;
  }): StockTakePagedRequest {
    const columns = ['sTCode', 'warehouseId', 'scopeDisplay', 'itemCount', 'varianceLineCount', 'netVarianceKg', 'stockTakeStatusId', 'createdDate', 'id'];
    const columnFilters = {
      warehouseId: params.warehouseId ? String(params.warehouseId) : '',
      stockTakeStatusId: params.statusId ? String(params.statusId) : '',
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: 'id',
        sortDir: 'desc',
      },
      columns,
      columnFilters
    ) as StockTakePagedRequest;
  }
}
