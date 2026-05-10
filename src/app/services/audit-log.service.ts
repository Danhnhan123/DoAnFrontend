import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  SearchQuery,
  PagingData,
  AuditLogDetailDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy danh sách audit log phân trang */
  getPaged(
    query: SearchQuery
  ): Observable<ApiResponse<PagingData<AuditLogDetailDto>>> {
    return this.http.post<ApiResponse<PagingData<AuditLogDetailDto>>>(
      `${this.base}/audit-log/paged`,
      {
        pageIndex: query.pageIndex,
        pageSize: query.pageSize,
        keyword: query.keyword,
        sortType: (query.sortType || 'DESC').toUpperCase(),
        orderBy: query.orderBy || 'changedDate',
      }
    );
  }

  /** Định dạng JSON để hiển thị đẹp */
  formatJson(val?: string): string {
    if (!val) return '(Không có dữ liệu)';
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return val;
    }
  }

  /** Trả về CSS class theo loại hành động */
  getActionClass(action: string): string {
    if (action?.includes('INSERT') || action?.includes('CREATE'))
      return 'act-create';
    if (action?.includes('UPDATE')) return 'act-update';
    if (action?.includes('DELETE')) return 'act-delete';
    return 'act-other';
  }
}
