import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  DataItem,
  AuditLogDetailDto,
  AuditLogPagedAdvancedRequest,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

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
export class AuditLogService extends ApiService {

  /**
   * Lấy danh sách audit log dạng DataTables (phân trang/tìm/sắp xếp/lọc).
   * Phạm vi (admin xem tất cả / user xem của mình) do backend tự quyết theo
   * role trong JWT, FE không cần gửi roleIds.
   */
  getPagedAdvanced(
    body: AuditLogPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/audit-log/paged-advanced',
      body
    );
  }

  /** Chi tiết audit log theo id (có dữ liệu trước/sau khi thay đổi). */
  getById(id: number): Observable<ApiResponse<AuditLogDetailDto>> {
    return this.apiGet<AuditLogDetailDto>(
      `/audit-log/${id}`
    );
  }

  /** Danh sách hành động để lọc (Thêm mới/Cập nhật/Xoá...). */
  getActions(): Observable<ApiResponse<DataItem<string>[]>> {
    return this.apiGet<DataItem<string>[]>(
      `/audit-log/actions`
    );
  }

  /** Danh sách loại đối tượng (bảng dữ liệu) để lọc. */
  getAuditEntities(): Observable<ApiResponse<DataItem<string>[]>> {
    return this.apiGet<DataItem<string>[]>(
      `/audit-log/audit-entities`
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
    filterActions?: string[];
    filterTargetTypes?: string[];
    dateFrom?: string | null;
    dateTo?: string | null;
  }): AuditLogPagedAdvancedRequest {
    const columns = ['id', 'action', 'targetType', 'targetId', 'description', 'ipAddress', 'createdUserName', 'createdDate'];
    const columnFilters = {
      createdDate: buildDateRange(params.dateFrom ?? '', params.dateTo ?? ''),
    };

    // Mở rộng mỗi hành động được chọn thành tất cả biến thể tên (Anh + Việt).
    const expandedActions = Array.from(
      new Set(
        (params.filterActions ?? []).flatMap((a) => ACTION_SYNONYMS[a] ?? [a])
      )
    );

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
        userId: params.userId ?? 0,
        roleIds: [],
        actions: expandedActions,
        targetTypes: params.filterTargetTypes ?? [],
      }
    ) as AuditLogPagedAdvancedRequest;
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
