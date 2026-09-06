import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  FarmerDetailDto,
  FarmerPagedAdvancedRequest,
  CreateFarmerDto,
  UpdateFarmerDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class FarmerService extends ApiService {

  getPagedAdvanced(
    body: FarmerPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/farmers/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<FarmerDetailDto>> {
    return this.apiGet<FarmerDetailDto>(
      `/farmers/${id}`
    );
  }

  create(payload: CreateFarmerDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/farmers', payload);
  }

  update(payload: UpdateFarmerDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/farmers', payload);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/farmers/${id}`);
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
  }): FarmerPagedAdvancedRequest {
    const columns = ['id', 'name', 'code', 'phone', 'region', 'isActive', 'createdDate'];
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
    ) as FarmerPagedAdvancedRequest;
  }
}
