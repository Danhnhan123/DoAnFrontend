import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiResponse, DTResponse } from '../models/common';
import {
  PaddyLotDetailDto,
  PaddyLotPagedRequest,
  PaddyLotRow,
} from '../models/paddy-lot';

@Injectable({ providedIn: 'root' })
export class PaddyLotService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: PaddyLotPagedRequest
  ): Observable<ApiResponse<DTResponse<PaddyLotRow>>> {
    return this.http.post<ApiResponse<DTResponse<PaddyLotRow>>>(
      `${this.base}/paddy-lots/paged-advanced`,
      body
    );
  }

  getById(id: number): Observable<ApiResponse<PaddyLotDetailDto>> {
    return this.http.get<ApiResponse<PaddyLotDetailDto>>(
      `${this.base}/paddy-lots/${id}`
    );
  }

  /** Lô đang CHỜ KIỂM ĐỊNH (AWAITING_QC) — nguồn ô chọn lô ở màn Chất lượng & cách ly. */
  getAwaitingQc(): Observable<ApiResponse<PaddyLotDetailDto[]>> {
    return this.http.get<ApiResponse<PaddyLotDetailDto[]>>(
      `${this.base}/paddy-lots/awaiting-qc`
    );
  }

  /** Lô đang CÁCH LY (QUARANTINE) — nguồn ô chọn lô khi KIỂM TRA LẠI chất lượng. */
  getQuarantined(): Observable<ApiResponse<PaddyLotDetailDto[]>> {
    return this.http.get<ApiResponse<PaddyLotDetailDto[]>>(
      `${this.base}/paddy-lots/quarantined`
    );
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortField?: string;
    sortDir?: 'asc' | 'desc';
    lotType?: string | null;
    warehouseId?: number | null;
    statusId?: number | null;
  }): PaddyLotPagedRequest {
    const columns = [
      'lotCode',
      'lotType',
      'productVariantName',
      'riceVarietyId',
      'warehouseId',
      'statusId',
      'remainingWeightKg',
      'costPricePerKg',
      'inboundDate',
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
        if (name === 'lotType') return column(name, params.lotType || '');
        if (name === 'warehouseId') {
          return column(name, params.warehouseId ? String(params.warehouseId) : '');
        }
        if (name === 'statusId') {
          return column(name, params.statusId ? String(params.statusId) : '');
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
        value: (params.search || '').trim(),
        regex: false,
        fixed: [],
      },
    };
  }
}
