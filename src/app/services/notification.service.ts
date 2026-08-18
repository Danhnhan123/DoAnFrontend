import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
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
export class NotificationService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách thông báo (màn quản trị: isAdmin = true để xem tất cả). */
  getPagedAdvanced(
    body: NotificationPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/notification/paged-advanced`,
      body
    );
  }

  getById(id: number): Observable<ApiResponse<NotificationDetailDto>> {
    return this.http.get<ApiResponse<NotificationDetailDto>>(
      `${this.base}/notification/${id}`
    );
  }

  create(payload: CreateNotificationDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/notification`, payload);
  }

  update(payload: UpdateNotificationDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/notification`, payload);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/notification/${id}`);
  }

  /** Danh mục thông báo (cho dropdown chọn danh mục + lọc). */
  getCategories(): Observable<ApiResponse<NotificationCategoryDetailDto[]>> {
    return this.http.get<ApiResponse<NotificationCategoryDetailDto[]>>(
      `${this.base}/notification-category`
    );
  }

  /** Danh sách người dùng (cho chọn người nhận). */
  getUsers(): Observable<ApiResponse<UserOption[]>> {
    return this.http.get<ApiResponse<UserOption[]>>(`${this.base}/user`);
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
        col('title'),
        col('content'),
        col('direction'),
        col('notificationCategoryName'),
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
      isAdmin: true,
      userId: 0,
      notificationCategoryIds: params.filterCategoryIds ?? [],
    };
  }
}
