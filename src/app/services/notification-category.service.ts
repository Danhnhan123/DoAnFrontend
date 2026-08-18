import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  NotificationCategoryDetailDto,
  NotificationCategoryPagedAdvancedRequest,
  CreateNotificationCategoryDto,
  UpdateNotificationCategoryDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class NotificationCategoryService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: NotificationCategoryPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/notification-category/paged-advanced`,
      body
    );
  }

  getById(id: number): Observable<ApiResponse<NotificationCategoryDetailDto>> {
    return this.http.get<ApiResponse<NotificationCategoryDetailDto>>(
      `${this.base}/notification-category/${id}`
    );
  }

  create(payload: CreateNotificationCategoryDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/notification-category`,
      payload
    );
  }

  update(payload: UpdateNotificationCategoryDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/notification-category`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/notification-category/${id}`
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
    filterDescription?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): NotificationCategoryPagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];
    const dateSearch = buildDateRange(params.dateFrom ?? '', params.dateTo ?? '');

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('name', params.filterName?.trim() || ''),
        col('description', params.filterDescription?.trim() || ''),
        col('color'),
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
