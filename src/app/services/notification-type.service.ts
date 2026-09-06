import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  NotificationTypeDetailDto,
  NotificationTypePagedAdvancedRequest,
  CreateNotificationTypeDto,
  UpdateNotificationTypeDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class NotificationTypeService extends ApiService {

  getPagedAdvanced(
    body: NotificationTypePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/notification-type/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<NotificationTypeDetailDto>> {
    return this.apiGet<NotificationTypeDetailDto>(
      `/notification-type/${id}`
    );
  }

  create(payload: CreateNotificationTypeDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/notification-type`,
      payload
    );
  }

  update(payload: UpdateNotificationTypeDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/notification-type`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/notification-type/${id}`);
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterDescription?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): NotificationTypePagedAdvancedRequest {
    const columns = ['id', 'name', 'description', 'createdDate'];
    const columnFilters = {
      name: params.filterName?.trim() || '',
      description: params.filterDescription?.trim() || '',
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
    ) as NotificationTypePagedAdvancedRequest;
  }
}
