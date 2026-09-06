import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { buildDataTablesRequest } from "../utils/datatable.util";
import {
  ApiResponse,
  ConfirmPaddyStoreInResult,
  ConfirmStoreInRequest,
  ConfirmPaddyPurchaseReceiptPayload,
  ConfirmPaddyPurchaseReceiptResult,
  CreatePaddyPurchaseReceiptDto,
  CreatePaddyPurchaseScheduleDto,
  CreateFarmerDto,
  DTParameters,
  FarmerDetailDto,
  PaddyPurchaseReceiptRow,
  PaddyPurchaseScheduleRow,
  PaddyScheduleStatusCode,
  GetPutawaySuggestionsRequest,
  PaddyVariantOption,
  PutawaySuggestionsResponse,
  RiceVarietyDetailDto,
  UpdatePaddyPurchaseReceiptDto,
  UpdatePaddyPurchaseScheduleDto,
  WarehouseDetailDto,
} from "../models";

@Injectable({ providedIn: "root" })
export class PaddyPurchaseService extends ApiService {

  // ───────────────────────── LỊCH THU MUA ─────────────────────────

  getSchedules(): Observable<ApiResponse<PaddyPurchaseScheduleRow[]>> {
    return this.apiGet<PaddyPurchaseScheduleRow[]>(
      `/paddy-purchase-schedules`,
    );
  }

  getSchedulesPaged(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/paddy-purchase-schedules/paged-advanced`,
      body,
    );
  }

  getScheduleById(
    id: number,
  ): Observable<ApiResponse<PaddyPurchaseScheduleRow>> {
    return this.apiGet<PaddyPurchaseScheduleRow>(
      `/paddy-purchase-schedules/${id}`,
    );
  }

  createSchedule(
    payload: CreatePaddyPurchaseScheduleDto,
  ): Observable<ApiResponse<number>> {
    return this.apiPost<number>(
      `/paddy-purchase-schedules`,
      payload,
    );
  }

  updateSchedule(
    payload: UpdatePaddyPurchaseScheduleDto,
  ): Observable<ApiResponse<number>> {
    return this.apiPut<number>(
      `/paddy-purchase-schedules`,
      payload,
    );
  }

  updateScheduleStatus(
    id: number,
    statusCode: PaddyScheduleStatusCode,
  ): Observable<ApiResponse<number>> {
    return this.http.patch<ApiResponse<number>>(
      `${this.base}/paddy-purchase-schedules/${id}/status`,
      null,
      { params: { statusCode } },
    );
  }

  deleteSchedule(id: number): Observable<ApiResponse<boolean>> {
    return this.apiDelete<boolean>(
      `/paddy-purchase-schedules/${id}`,
    );
  }

  // ───────────────────────── PHIẾU MUA LÚA ────────────────────────

  getReceipts(): Observable<ApiResponse<PaddyPurchaseReceiptRow[]>> {
    return this.apiGet<PaddyPurchaseReceiptRow[]>(
      `/paddy-purchase-receipts`,
    );
  }

  getReceiptsPaged(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/paddy-purchase-receipts/paged-advanced`,
      body,
    );
  }

  getReceiptById(id: number): Observable<ApiResponse<PaddyPurchaseReceiptRow>> {
    return this.apiGet<PaddyPurchaseReceiptRow>(
      `/paddy-purchase-receipts/${id}`,
    );
  }

  createReceipt(
    payload: CreatePaddyPurchaseReceiptDto,
  ): Observable<ApiResponse<number>> {
    return this.apiPost<number>(
      `/paddy-purchase-receipts`,
      payload,
    );
  }

  updateReceipt(
    payload: UpdatePaddyPurchaseReceiptDto,
  ): Observable<ApiResponse<number>> {
    return this.apiPut<number>(
      `/paddy-purchase-receipts`,
      payload,
    );
  }

  confirmReceipt(
    id: number,
    payload?: ConfirmPaddyPurchaseReceiptPayload,
  ): Observable<ApiResponse<ConfirmPaddyPurchaseReceiptResult>> {
    return this.apiPost<ConfirmPaddyPurchaseReceiptResult>(
      `/paddy-purchase-receipts/${id}/confirm`,
      payload ?? {},
    );
  }

  getPutawaySuggestions(
    payload: GetPutawaySuggestionsRequest,
  ): Observable<ApiResponse<PutawaySuggestionsResponse>> {
    return this.apiPost<PutawaySuggestionsResponse>(
      `/putaway/suggestions`,
      payload,
    );
  }

  confirmPaddyStoreIn(
    receiptId: number,
    payload: ConfirmStoreInRequest,
  ): Observable<ApiResponse<ConfirmPaddyStoreInResult>> {
    return this.apiPost<ConfirmPaddyStoreInResult>(
      `/store-in/PADDY_PURCHASE/${receiptId}/confirm`,
      payload,
    );
  }

  deleteReceipt(id: number): Observable<ApiResponse<boolean>> {
    return this.apiDelete<boolean>(
      `/paddy-purchase-receipts/${id}`,
    );
  }

  // ───────────────────────── LOOKUP CHO FORM ──────────────────────

  getFarmers(): Observable<ApiResponse<FarmerDetailDto[]>> {
    return this.apiGet<FarmerDetailDto[]>(
      `/farmers`,
    );
  }

  createFarmer(payload: CreateFarmerDto): Observable<ApiResponse<number>> {
    return this.apiPost<number>(`/farmers`, payload);
  }

  getRiceVarieties(): Observable<ApiResponse<RiceVarietyDetailDto[]>> {
    return this.apiGet<RiceVarietyDetailDto[]>(
      `/rice-varieties`,
    );
  }

  /** Danh sách biến thể sản phẩm lúa để chọn trên phiếu (FE lọc theo giống lúa). */
  getProductVariants(): Observable<ApiResponse<PaddyVariantOption[]>> {
    return this.apiGet<PaddyVariantOption[]>(
      `/paddy-purchase-receipts/product-variants`,
    );
  }

  getWarehouses(): Observable<ApiResponse<WarehouseDetailDto[]>> {
    return this.apiGet<WarehouseDetailDto[]>(
      `/warehouse`,
    );
  }

  // ───────────────────────── BODY DATATABLES ──────────────────────

  buildSchedulePagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField?: string;
    sortDir?: "asc" | "desc";
    farmerId?: number | null;
    statusId?: number | null;
    dateRange?: string;
  }): DTParameters {
    const columns = ['scheduleCode', 'farmerId', 'riceVarietyId', 'estimatedQtyH', 'scheduleDate', 'statusId', 'createdDate'];
    const columnFilters = {
      farmerId: params.farmerId ? String(params.farmerId) : "",
      scheduleDate: params.dateRange || "",
      statusId: params.statusId ? String(params.statusId) : "",
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField || "scheduleDate",
        sortDir: params.sortDir || "desc",
      },
      columns,
      columnFilters
    ) as DTParameters;
  }

  buildReceiptPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField?: string;
    sortDir?: "asc" | "desc";
    farmerId?: number | null;
    warehouseId?: number | null;
    dateRange?: string;
  }): DTParameters {
    const columns = ['receiptCode', 'farmerId', 'riceVarietyId', 'actualWeightKg', 'agreedPrice', 'totalAmount', 'qualityJson', 'paidAmount', 'debtAmount', 'receiptDate', 'warehouseId', 'createdDate'];
    const columnFilters = {
      farmerId: params.farmerId ? String(params.farmerId) : "",
      receiptDate: params.dateRange || "",
      warehouseId: params.warehouseId ? String(params.warehouseId) : "",
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField || "receiptDate",
        sortDir: params.sortDir || "desc",
      },
      columns,
      columnFilters
    ) as DTParameters;
  }
}
