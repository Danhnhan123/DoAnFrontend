import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  DataItem,
  AuditLogDetailDto,
  AuditLogPagedAdvancedRequest,
} from '../models';

/**
 * Một hành động có thể được lưu dưới nhiều dạng tên khác nhau trong DB
 * (EntityState "Added/Modified/Deleted" do interceptor sinh, hoặc mã tiếng Anh
 * CREATE/UPDATE/DELETE/INSERT do ghi log thủ công). Map dưới đây để khi người
 * dùng chọn 1 nhóm hành động thì lọc khớp tất cả biến thể tương ứng.
 */
const ACTION_SYNONYMS: Record<string, string[]> = {
  Added: ['Added', 'Add', 'CREATE', 'Create', 'INSERT', 'Insert', 'Created'],
  Modified: ['Modified', 'Modify', 'UPDATE', 'Update', 'Updated', 'EDIT', 'Edit'],
  Deleted: ['Deleted', 'Delete', 'DELETE', 'Remove', 'Removed'],
};

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /**
   * Lấy danh sách audit log dạng DataTables (phân trang/tìm/sắp xếp/lọc).
   * Phạm vi (admin xem tất cả / user xem của mình) do backend tự quyết theo
   * role trong JWT, FE không cần gửi roleIds.
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

  /** Danh sách hành động để lọc (Thêm mới/Cập nhật/Xoá...). */
  getActions(): Observable<ApiResponse<DataItem<string>[]>> {
    return this.http.get<ApiResponse<DataItem<string>[]>>(
      `${this.base}/audit-log/actions`
    );
  }

  /** Danh sách loại đối tượng (bảng dữ liệu) để lọc. */
  getAuditEntities(): Observable<ApiResponse<DataItem<string>[]>> {
    return this.http.get<ApiResponse<DataItem<string>[]>>(
      `${this.base}/audit-log/audit-entities`
    );
  }

  /** Chuyển "yyyy-MM-dd" (input type=date) sang "dd/MM/yyyy" backend yêu cầu. */
  private toDmy(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  }

  /** Dựng chuỗi lọc theo ngày cho cột createdDate: 1 ngày hoặc khoảng "a - b". */
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
    filterActions?: string[];
    filterTargetTypes?: string[];
    dateFrom?: string | null;
    dateTo?: string | null;
  }): AuditLogPagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];
    const dateSearch = this.dateRange(params.dateFrom, params.dateTo);

    // Mở rộng mỗi hành động được chọn thành tất cả biến thể tên (Anh + Việt).
    const expandedActions = Array.from(
      new Set(
        (params.filterActions ?? []).flatMap((a) => ACTION_SYNONYMS[a] ?? [a])
      )
    );

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
        col('action'),
        col('targetType'),
        col('targetId'),
        col('description'),
        col('ipAddress'),
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
      roleIds: [],
      actions: expandedActions,
      targetTypes: params.filterTargetTypes ?? [],
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
    if (action?.includes('INSERT') || action?.includes('CREATE') || action?.includes('Added'))
      return 'act-create';
    if (action?.includes('UPDATE') || action?.includes('Modified')) return 'act-update';
    if (action?.includes('DELETE') || action?.includes('Deleted')) return 'act-delete';
    return 'act-other';
  }
}
