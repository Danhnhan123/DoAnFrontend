import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiResponse,
  CreateStockTakePayload,
  DTResponse,
  SaveStockTakeCountsPayload,
  ScanStockTakeBagResult,
  StockTakeBagTargetSuggestion,
  StockTakeDetail,
  StockTakePagedRequest,
  StockTakeRow,
  StockTakeScopeOptions,
  StockTakeScopeResolve,
  StockTakeSummary,
  StockTakeThresholds,
} from '../models';

@Injectable({ providedIn: 'root' })
export class StockTakeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.baseUrl}/stocktakes`;

  getPagedAdvanced(body: StockTakePagedRequest): Observable<ApiResponse<DTResponse<StockTakeRow>>> {
    return this.http.post<ApiResponse<DTResponse<StockTakeRow>>>(`${this.base}/paged-advanced`, body);
  }

  getSummary(): Observable<ApiResponse<StockTakeSummary>> {
    return this.http.get<ApiResponse<StockTakeSummary>>(`${this.base}/summary`);
  }

  getThresholds(): Observable<ApiResponse<StockTakeThresholds>> {
    return this.http.get<ApiResponse<StockTakeThresholds>>(`${this.base}/thresholds`);
  }

  getById(id: number): Observable<ApiResponse<StockTakeDetail>> {
    return this.http.get<ApiResponse<StockTakeDetail>>(`${this.base}/${id}`);
  }

  create(payload: CreateStockTakePayload): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(this.base, payload);
  }

  saveCounts(id: number, payload: SaveStockTakeCountsPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}/counts`, payload);
  }

  submit(id: number, note?: string | null): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}/submit`, { note: note?.trim() || null });
  }

  approve(id: number, approveNote?: string | null): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}/approve`, { approveNote: approveNote?.trim() || null });
  }

  reject(id: number, reason: string): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}/reject`, { reason: reason.trim() });
  }

  /** Quét QR một bao khi đang kiểm kê. API luôn trả 200 kèm lý do nếu không khớp. */
  scanBag(id: number, body: { qrCode?: string | null; paddyLotBagId?: number | null; countedWeightKg?: number | null }): Observable<ApiResponse<ScanStockTakeBagResult>> {
    return this.http.post<ApiResponse<ScanStockTakeBagResult>>(`${this.base}/${id}/scan-bag`, body);
  }

  /** Khu / cột / lô đang có bao — nguồn dropdown chọn phạm vi kiểm kê. */
  getScopeOptions(warehouseId: number, quarantineOnly?: boolean | null): Observable<ApiResponse<StockTakeScopeOptions>> {
    const query = quarantineOnly == null ? '' : `&quarantineOnly=${quarantineOnly}`;
    return this.http.get<ApiResponse<StockTakeScopeOptions>>(`${this.base}/scope-options?warehouseId=${warehouseId}${query}`);
  }

  /** Quét QR dán trên khu/cột hoặc lô để chọn nhanh phạm vi. */
  resolveScopeQr(qrCode: string, warehouseId?: number | null): Observable<ApiResponse<StockTakeScopeResolve>> {
    const query = warehouseId ? `&warehouseId=${warehouseId}` : '';
    return this.http.get<ApiResponse<StockTakeScopeResolve>>(`${this.base}/scope-resolve?qrCode=${encodeURIComponent(qrCode)}${query}`);
  }

  /** Gợi ý ô cách ly / cột thường cho một bao (vẫn chọn lại được). */
  getBagTargetSuggestions(id: number, bagId: number): Observable<ApiResponse<StockTakeBagTargetSuggestion[]>> {
    return this.http.get<ApiResponse<StockTakeBagTargetSuggestion[]>>(`${this.base}/${id}/bags/${bagId}/target-suggestions`);
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    statusId?: number | null;
    warehouseId?: number | null;
  }): StockTakePagedRequest {
    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });
    return {
      draw: params.page,
      columns: [
        col('sTCode'),
        col('warehouseId', params.warehouseId ? String(params.warehouseId) : ''),
        col('scopeDisplay'),
        col('itemCount'),
        col('varianceLineCount'),
        col('netVarianceKg'),
        col('stockTakeStatusId', params.statusId ? String(params.statusId) : ''),
        col('createdDate'),
        col('id'),
      ],
      order: [{ column: 8, dir: 'desc', name: 'id' }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
