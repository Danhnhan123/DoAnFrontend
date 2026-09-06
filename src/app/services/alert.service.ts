import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  AlertRule,
  AlertSummaryDto,
  AlertPagedAdvancedRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AlertService extends ApiService {

  /** Danh sách cảnh báo (mới nhất trước). */
  getPagedAdvanced(
    body: AlertPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/alerts/paged-advanced',
      body
    );
  }

  /** Tổng hợp KPI cho 4 thẻ trên cùng. */
  getSummary(): Observable<ApiResponse<AlertSummaryDto>> {
    return this.apiGet<AlertSummaryDto>(
      '/alerts/summary'
    );
  }

  /** Đánh dấu 1 cảnh báo là đã đọc (ghi nhận). */
  acknowledge(id: number): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/alerts/${id}/acknowledge`,
      {}
    );
  }

  /** Đánh dấu tất cả cảnh báo đang mở là đã đọc. */
  markAllRead(): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/alerts/read-all',
      {}
    );
  }

  /** Bỏ (xoá mềm) 1 cảnh báo khỏi danh sách. */
  dismiss(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/alerts/${id}`);
  }

  /** Danh sách quy tắc cảnh báo + trạng thái bật/tắt. */
  getRules(): Observable<ApiResponse<AlertRule[]>> {
    return this.apiGet<AlertRule[]>('/alerts/rules');
  }

  /** Bật/tắt 1 quy tắc cảnh báo theo mã. */
  toggleRule(code: string, enabled: boolean): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/alerts/rules/${code}`,
      { enabled }
    );
  }

  /**
   * Body danh sách: lấy {length} cảnh báo mới nhất kể từ vị trí {start}
   * (sắp xếp theo createdDate giảm dần). Dùng start/length để phân trang.
   */
  buildListBody(length = 100, start = 0): AlertPagedAdvancedRequest {
    return buildDataTablesRequest(
      {
        page: Math.floor(start / length) + 1,
        pageSize: length,
        search: '',
        sortField: 'createdDate',
        sortDir: 'desc',
      },
      ['createdDate']
    ) as AlertPagedAdvancedRequest;
  }
}
