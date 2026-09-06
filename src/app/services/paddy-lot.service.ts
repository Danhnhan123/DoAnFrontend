import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";

import { ApiResponse, DTResponse } from "../models/common";
import {
  PaddyLotDetailDto,
  PaddyLotPagedRequest,
  PaddyLotRow,
  PaddyLotTraceabilityDto,
} from "../models/paddy-lot";
import { buildDataTablesRequest } from "../utils/datatable.util";
import { ApiService } from "./api.service";

@Injectable({ providedIn: "root" })
export class PaddyLotService extends ApiService {

  getPagedAdvanced(
    body: PaddyLotPagedRequest,
  ): Observable<ApiResponse<DTResponse<PaddyLotRow>>> {
    return this.apiPost<DTResponse<PaddyLotRow>>(
      "/paddy-lots/paged-advanced",
      body,
    );
  }

  getAll(): Observable<ApiResponse<PaddyLotDetailDto[]>> {
    return this.apiGet<PaddyLotDetailDto[]>("/paddy-lots");
  }

  getById(id: number): Observable<ApiResponse<PaddyLotDetailDto>> {
    return this.apiGet<PaddyLotDetailDto>(`/paddy-lots/${id}`);
  }

  getTraceabilityById(
    id: number,
  ): Observable<ApiResponse<PaddyLotTraceabilityDto>> {
    return this.apiGet<PaddyLotTraceabilityDto>(`/paddy-lots/${id}/traceability`);
  }

  /** Lô đang CHỜ KIỂM ĐỊNH (AWAITING_QC) — nguồn ô chọn lô ở màn Chất lượng & cách ly. */
  getAwaitingQc(): Observable<ApiResponse<PaddyLotDetailDto[]>> {
    return this.apiGet<PaddyLotDetailDto[]>("/paddy-lots/awaiting-qc");
  }

  /** Lô đang CÁCH LY (QUARANTINE) — nguồn ô chọn lô khi KIỂM TRA LẠI chất lượng. */
  getQuarantined(): Observable<ApiResponse<PaddyLotDetailDto[]>> {
    return this.apiGet<PaddyLotDetailDto[]>("/paddy-lots/quarantined");
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortField?: string;
    sortDir?: "asc" | "desc";
    lotType?: string | null;
    warehouseId?: number | null;
    statusId?: number | null;
  }): PaddyLotPagedRequest {
    const columns = [
      "lotCode",
      "lotType",
      "productVariantName",
      "riceVarietyId",
      "warehouseId",
      "statusId",
      "remainingWeightKg",
      "costPricePerKg",
      "inboundDate",
      "createdDate",
      "id",
    ];

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      {
        lotType: params.lotType || "",
        warehouseId: params.warehouseId ? String(params.warehouseId) : "",
        statusId: params.statusId ? String(params.statusId) : "",
      }
    );
  }
}
