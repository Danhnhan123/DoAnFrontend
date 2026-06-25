import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, ActivityLogPagedAdvancedRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /**
   * Lấy danh sách activity log dạng DataTables (phân trang/tìm/sắp xếp).
   * userId = 0 => lấy tất cả; truyền userId > 0 để lọc theo một người dùng.
   */
  getPagedAdvanced(
    body: ActivityLogPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/activity-log/paged-advanced`,
      body
    );
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    userId?: number;
  }): ActivityLogPagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string) => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value: '', regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('action'),
        col('description'),
        col('ipAddress'),
        col('userAgent'),
        col('createdUserName'),
        col('createdDate'),
      ],
      order: [
        { column: colIndex, dir: params.sortDir, name: params.sortField },
      ],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
      userId: params.userId ?? 0,
    };
  }
}
