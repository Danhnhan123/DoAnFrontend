import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ConfirmPaddyPurchaseReceiptResult,
  ConfirmStoreInRequest,
  CreatePaddyPurchaseReceiptDto,
  CreatePaddyPurchaseScheduleDto,
  DTParameters,
  FarmerDetailDto,
  GetPutawaySuggestionsRequest,
  PaddyLotDetailDto,
  PaddyPurchaseReceiptRow,
  PaddyPurchaseScheduleRow,
  PaddyPurchaseUserOption,
  PaddyScheduleStatusCode,
  PutawaySuggestionsResponse,
  RiceVarietyDetailDto,
  UpdatePaddyPurchaseReceiptDto,
  UpdatePaddyPurchaseScheduleDto,
  WarehouseDetailDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class PaddyPurchaseService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  // ───────────────────────── LỊCH THU MUA ─────────────────────────

  getSchedules(): Observable<ApiResponse<PaddyPurchaseScheduleRow[]>> {
    return this.http.get<ApiResponse<PaddyPurchaseScheduleRow[]>>(
      `${this.base}/paddy-purchase-schedules`
    );
  }

  getSchedulesPaged(
    body: DTParameters
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/paddy-purchase-schedules/paged-advanced`,
      body
    );
  }

  getScheduleById(
    id: number
  ): Observable<ApiResponse<PaddyPurchaseScheduleRow>> {
    return this.http.get<ApiResponse<PaddyPurchaseScheduleRow>>(
      `${this.base}/paddy-purchase-schedules/${id}`
    );
  }

  createSchedule(
    payload: CreatePaddyPurchaseScheduleDto
  ): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(
      `${this.base}/paddy-purchase-schedules`,
      payload
    );
  }

  updateSchedule(
    payload: UpdatePaddyPurchaseScheduleDto
  ): Observable<ApiResponse<number>> {
    return this.http.put<ApiResponse<number>>(
      `${this.base}/paddy-purchase-schedules`,
      payload
    );
  }

  updateScheduleStatus(
    id: number,
    statusCode: PaddyScheduleStatusCode
  ): Observable<ApiResponse<number>> {
    return this.http.patch<ApiResponse<number>>(
      `${this.base}/paddy-purchase-schedules/${id}/status`,
      null,
      { params: { statusCode } }
    );
  }

  deleteSchedule(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(
      `${this.base}/paddy-purchase-schedules/${id}`
    );
  }

  // ───────────────────────── PHIẾU MUA LÚA ────────────────────────

  getReceipts(): Observable<ApiResponse<PaddyPurchaseReceiptRow[]>> {
    return this.http.get<ApiResponse<PaddyPurchaseReceiptRow[]>>(
      `${this.base}/paddy-purchase-receipts`
    );
  }

  getReceiptsPaged(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/paddy-purchase-receipts/paged-advanced`,
      body
    );
  }

  getReceiptById(
    id: number
  ): Observable<ApiResponse<PaddyPurchaseReceiptRow>> {
    return this.http.get<ApiResponse<PaddyPurchaseReceiptRow>>(
      `${this.base}/paddy-purchase-receipts/${id}`
    );
  }

  createReceipt(
    payload: CreatePaddyPurchaseReceiptDto
  ): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(
      `${this.base}/paddy-purchase-receipts`,
      payload
    );
  }

  updateReceipt(
    payload: UpdatePaddyPurchaseReceiptDto
  ): Observable<ApiResponse<number>> {
    return this.http.put<ApiResponse<number>>(
      `${this.base}/paddy-purchase-receipts`,
      payload
    );
  }

  confirmReceipt(
    id: number
  ): Observable<ApiResponse<ConfirmPaddyPurchaseReceiptResult>> {
    return this.http.post<ApiResponse<ConfirmPaddyPurchaseReceiptResult>>(
      `${this.base}/paddy-purchase-receipts/${id}/confirm`,
      null
    );
  }

  deleteReceipt(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(
      `${this.base}/paddy-purchase-receipts/${id}`
    );
  }

  // ───────────────────────── LOOKUP CHO FORM ──────────────────────

  getFarmers(): Observable<ApiResponse<FarmerDetailDto[]>> {
    return this.http.get<ApiResponse<FarmerDetailDto[]>>(
      `${this.base}/farmers`
    );
  }

  getRiceVarieties(): Observable<ApiResponse<RiceVarietyDetailDto[]>> {
    return this.http.get<ApiResponse<RiceVarietyDetailDto[]>>(
      `${this.base}/rice-varieties`
    );
  }

 getWarehouses(): Observable<ApiResponse<WarehouseDetailDto[]>> {
    return this.http.get<ApiResponse<WarehouseDetailDto[]>>(
      `${this.base}/warehouse`
    );
  }

  getUsers(): Observable<ApiResponse<PaddyPurchaseUserOption[]>> {
    return this.http.get<ApiResponse<PaddyPurchaseUserOption[]>>(
      `${this.base}/user`
    );
  }

  getPaddyLot(id: number): Observable<ApiResponse<PaddyLotDetailDto>> {
    return this.http.get<ApiResponse<PaddyLotDetailDto>>(
      `${this.base}/paddy-lots/${id}`
    );
  }

  getPutawaySuggestions(
    payload: GetPutawaySuggestionsRequest
  ): Observable<ApiResponse<PutawaySuggestionsResponse>> {
    return this.http.post<ApiResponse<PutawaySuggestionsResponse>>(
      `${this.base}/putaway/suggestions`,
      payload
    );
  }

  confirmPaddyStoreIn(
    receiptId: number,
    payload: ConfirmStoreInRequest
  ): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(
      `${this.base}/paddy-purchase-receipts/${receiptId}/store-in`,
      payload
    );
  }

  // ───────────────────────── BODY DATATABLES ──────────────────────
  buildSchedulePagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField?: string;
    sortDir?: 'asc' | 'desc';
    farmerId?: number | null;
    statusId?: number | null;
    dateRange?: string;
  }): DTParameters {
    const columns = [
      this.column('scheduleCode'),
      this.column('farmerId', params.farmerId ? String(params.farmerId) : ''),
      this.column('riceVarietyId'),
      this.column('estimatedQtyKg'),
      this.column('scheduleDate', params.dateRange || ''),
      this.column('statusId', params.statusId ? String(params.statusId) : ''),
      this.column('createdDate'),
    ];

    const sortField = params.sortField || 'scheduleDate';
    const sortIndex = Math.max(
      0,
      columns.findIndex((x) => x.data === sortField)
    );

    return {
      draw: params.page,
      columns,
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

  buildReceiptPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField?: string;
    sortDir?: 'asc' | 'desc';
    farmerId?: number | null;
    warehouseId?: number | null;
    dateRange?: string;
  }): DTParameters {
    const columns = [
      this.column('receiptCode'),
      this.column('farmerId', params.farmerId ? String(params.farmerId) : ''),
      this.column('riceVarietyId'),
      this.column('actualWeightKg'),
      this.column('agreedPrice'),
      this.column('totalAmount'),
      this.column('qualityJson'),
      this.column('paidAmount'),
      this.column('debtAmount'),
      this.column('receiptDate', params.dateRange || ''),
      this.column(
        'warehouseId',
        params.warehouseId ? String(params.warehouseId) : ''
      ),
      this.column('createdDate'),
    ];

    const sortField = params.sortField || 'receiptDate';
    const sortIndex = Math.max(
      0,
      columns.findIndex((x) => x.data === sortField)
    );

    return {
      draw: params.page,
      columns,
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

  private column(data: string, value = '') {
    return {
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    };
  }
}
