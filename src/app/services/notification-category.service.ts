import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  NotificationCategoryDetailDto,
  NotificationCategoryPagedAdvancedRequest,
  CreateNotificationCategoryDto,
  UpdateNotificationCategoryDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class NotificationCategoryService extends ApiService {

  getPagedAdvanced(
    body: NotificationCategoryPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/notification-category/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<NotificationCategoryDetailDto>> {
    return this.apiGet<NotificationCategoryDetailDto>(
      `/notification-category/${id}`
    );
  }

  create(payload: CreateNotificationCategoryDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/notification-category`,
      payload
    );
  }

  update(payload: UpdateNotificationCategoryDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/notification-category`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/notification-category/${id}`);
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
  }): NotificationCategoryPagedAdvancedRequest {
    const columns = ['id', 'name', 'description', 'color', 'createdDate'];
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
    ) as NotificationCategoryPagedAdvancedRequest;
  }
}
