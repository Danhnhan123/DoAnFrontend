import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  NotificationDetailDto,
  NotificationPagedAdvancedRequest,
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationCategoryDetailDto,
  UserOption,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class NotificationService extends ApiService {

  /** Danh sách thông báo (màn quản trị: isAdmin = true để xem tất cả). */
  getPagedAdvanced(
    body: NotificationPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/notification/paged-advanced',
      body
    );
  }

  getById(id: number): Observable<ApiResponse<NotificationDetailDto>> {
    return this.apiGet<NotificationDetailDto>(
      `/notification/${id}`
    );
  }

  create(payload: CreateNotificationDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/notification', payload);
  }

  update(payload: UpdateNotificationDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/notification', payload);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/notification/${id}`);
  }

  /** Danh mục thông báo (cho dropdown chọn danh mục + lọc). */
  getCategories(): Observable<ApiResponse<NotificationCategoryDetailDto[]>> {
    return this.apiGet<NotificationCategoryDetailDto[]>(
      '/notification-category'
    );
  }

  /** Danh sách người dùng (cho chọn người nhận). */
  getUsers(): Observable<ApiResponse<UserOption[]>> {
    return this.apiGet<UserOption[]>('/user');
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterCategoryIds?: number[];
    dateFrom?: string | null;
    dateTo?: string | null;
  }): NotificationPagedAdvancedRequest {
    const columns = ['id', 'title', 'content', 'direction', 'notificationCategoryName', 'createdDate'];
    const columnFilters = {
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
      columnFilters,
      {
        isAdmin: true,
        userId: 0,
        notificationCategoryIds: params.filterCategoryIds ?? [],
      }
    ) as NotificationPagedAdvancedRequest;
  }
}
