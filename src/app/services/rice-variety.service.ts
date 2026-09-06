import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  RiceVarietyDetailDto,
  RiceVarietyPagedAdvancedRequest,
  CreateRiceVarietyDto,
  UpdateRiceVarietyDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class RiceVarietyService extends ApiService {

  getPagedAdvanced(
    body: RiceVarietyPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/rice-varieties/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<RiceVarietyDetailDto>> {
    return this.apiGet<RiceVarietyDetailDto>(
      `/rice-varieties/${id}`
    );
  }

  create(payload: CreateRiceVarietyDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/rice-varieties',
      payload
    );
  }

  update(payload: UpdateRiceVarietyDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/rice-varieties',
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(
      `/rice-varieties/${id}`
    );
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterCode?: string | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): RiceVarietyPagedAdvancedRequest {
    const columns = ['id', 'name', 'code', 'season', 'isActive', 'createdDate'];
    const columnFilters = {
      name: params.filterName?.trim() || '',
      code: params.filterCode?.trim() || '',
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
    ) as RiceVarietyPagedAdvancedRequest;
  }
}
