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
   * Lấy danh sách activity log dạng DataTables (phân trang/tìm/sắp xếp/lọc).
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

  private toDmy(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  }

  private dateRange(from?: string | null, to?: string | null): string {
    const f = this.toDmy(from);
    const t = this.toDmy(to);
    if (f && t) return `${f} - ${t}`;
    return f || t || '';
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    userId?: number;
    filterAction?: string | null;
    filterIp?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): ActivityLogPagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];
    const dateSearch = this.dateRange(params.dateFrom, params.dateTo);

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
        col('action', params.filterAction?.trim() || ''),
        col('description'),
        col('ipAddress', params.filterIp?.trim() || ''),
        col('userAgent'),
        col('createdUserName'),
        col('createdDate', dateSearch),
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
