import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  AuditLogDetailDto,
  AuditLogPagedAdvancedRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /**
   * Lấy danh sách audit log dạng DataTables (phân trang/tìm/sắp xếp).
   * Backend quyết định phạm vi theo roleIds (admin/executive xem tất cả,
   * còn lại chỉ xem log do mình tạo - lọc theo userId).
   */
  getPagedAdvanced(
    body: AuditLogPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/audit-log/paged-advanced`,
      body
    );
  }

  /** Chi tiết audit log theo id (có dữ liệu trước/sau khi thay đổi). */
  getById(id: number): Observable<ApiResponse<AuditLogDetailDto>> {
    return this.http.get<ApiResponse<AuditLogDetailDto>>(
      `${this.base}/audit-log/${id}`
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
    roleIds?: number[];
  }): AuditLogPagedAdvancedRequest {
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
        col('targetType'),
        col('targetId'),
        col('description'),
        col('ipAddress'),
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
      roleIds: params.roleIds ?? [],
      actions: [],
      targetTypes: [],
    };
  }

  /** Định dạng JSON để hiển thị đẹp */
  formatJson(val?: string | null): string {
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
