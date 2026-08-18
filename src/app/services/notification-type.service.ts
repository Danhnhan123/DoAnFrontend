import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  NotificationTypeDetailDto,
  NotificationTypePagedAdvancedRequest,
  CreateNotificationTypeDto,
  UpdateNotificationTypeDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class NotificationTypeService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: NotificationTypePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/notification-type/paged-advanced`,
      body
    );
  }

  getById(id: number): Observable<ApiResponse<NotificationTypeDetailDto>> {
    return this.http.get<ApiResponse<NotificationTypeDetailDto>>(
      `${this.base}/notification-type/${id}`
    );
  }

  create(payload: CreateNotificationTypeDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/notification-type`,
      payload
    );
  }

  update(payload: UpdateNotificationTypeDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/notification-type`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/notification-type/${id}`
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
  }): NotificationTypePagedAdvancedRequest {
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
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
