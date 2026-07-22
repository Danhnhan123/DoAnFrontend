import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  AlertRule,
  AlertSummaryDto,
  AlertPagedAdvancedRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách cảnh báo (mới nhất trước). */
  getPagedAdvanced(
    body: AlertPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/alerts/paged-advanced`,
      body
    );
  }

  /** Tổng hợp KPI cho 4 thẻ trên cùng. */
  getSummary(): Observable<ApiResponse<AlertSummaryDto>> {
    return this.http.get<ApiResponse<AlertSummaryDto>>(
      `${this.base}/alerts/summary`
    );
  }

  /** Đánh dấu 1 cảnh báo là đã đọc (ghi nhận). */
  acknowledge(id: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/alerts/${id}/acknowledge`,
      {}
    );
  }

  /** Đánh dấu tất cả cảnh báo đang mở là đã đọc. */
  markAllRead(): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/alerts/read-all`,
      {}
    );
  }

  /** Bỏ (xoá mềm) 1 cảnh báo khỏi danh sách. */
  dismiss(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/alerts/${id}`);
  }

  /** Danh sách quy tắc cảnh báo + trạng thái bật/tắt. */
  getRules(): Observable<ApiResponse<AlertRule[]>> {
    return this.http.get<ApiResponse<AlertRule[]>>(`${this.base}/alerts/rules`);
  }

  /** Bật/tắt 1 quy tắc cảnh báo theo mã. */
  toggleRule(code: string, enabled: boolean): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/alerts/rules/${code}`,
      { enabled }
    );
  }

  /**
   * Body danh sách: lấy {length} cảnh báo mới nhất kể từ vị trí {start}
   * (sắp xếp theo createdDate giảm dần). Dùng start/length để phân trang.
   */
  buildListBody(length = 100, start = 0): AlertPagedAdvancedRequest {
    const col = (data: string) => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value: '', regex: false, fixed: [] as any[] },
    });

    return {
      draw: 1,
      columns: [col('createdDate')],
      order: [{ column: 0, dir: 'desc', name: 'createdDate' }],
      start,
      length,
      search: { value: '', regex: false, fixed: [] },
    };
  }
}
