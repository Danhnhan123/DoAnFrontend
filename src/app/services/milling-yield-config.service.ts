import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  MillingYieldConfigDetailDto,
  MillingYieldConfigPagedAdvancedRequest,
  CreateMillingYieldConfigDto,
  UpdateMillingYieldConfigDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class MillingYieldConfigService extends ApiService {

  getPagedAdvanced(
    body: MillingYieldConfigPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/milling-yield-configs/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<MillingYieldConfigDetailDto>> {
    return this.apiGet<MillingYieldConfigDetailDto>(
      `/milling-yield-configs/${id}`
    );
  }

  create(payload: CreateMillingYieldConfigDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/milling-yield-configs`,
      payload
    );
  }

  update(payload: UpdateMillingYieldConfigDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/milling-yield-configs`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/milling-yield-configs/${id}`);
  }

  /** Danh sách giống lúa cho dropdown (GET /rice-varieties). */
  getRiceVarietyOptions(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/rice-varieties');
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterRiceVarietyId: number | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): MillingYieldConfigPagedAdvancedRequest {
    const columns = ['id', 'riceVarietyId', 'riceVarietyName', 'yieldRate', 'moistureFrom', 'moistureTo', 'isActive', 'createdDate'];
    const columnFilters = {
      riceVarietyId: params.filterRiceVarietyId != null ? String(params.filterRiceVarietyId) : '',
      isActive: params.filterIsActive != null ? String(params.filterIsActive) : '',
      createdDate: buildDateRange(params.dateFrom ?? '', params.dateTo ?? ''),
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      columnFilters
    ) as MillingYieldConfigPagedAdvancedRequest;
  }
}
