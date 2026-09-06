import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  OrganizationDetailDto,
  OrganizationPagedAdvancedRequest,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class OrganizationService extends ApiService {

  getPagedAdvanced(
    body: OrganizationPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/organizations/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<OrganizationDetailDto>> {
    return this.apiGet<OrganizationDetailDto>(
      `/organizations/${id}`
    );
  }

  create(payload: CreateOrganizationDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/organizations',
      payload
    );
  }

  update(payload: UpdateOrganizationDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/organizations',
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(
      `/organizations/${id}`
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
  }): OrganizationPagedAdvancedRequest {
    const columns = ['id', 'name', 'code', 'taxCode', 'contactEmail', 'contactPhone', 'isActive', 'createdDate'];
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
    ) as OrganizationPagedAdvancedRequest;
  }
}
