import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import { ApiResponse, ActivityLogPagedAdvancedRequest } from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ActivityLogService extends ApiService {

  /**
   * Lấy danh sách activity log dạng DataTables (phân trang/tìm/sắp xếp/lọc).
   * userId = 0 => lấy tất cả; truyền userId > 0 để lọc theo một người dùng.
   */
  getPagedAdvanced(
    body: ActivityLogPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/activity-log/paged-advanced',
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
    filterAction?: string | null;
    filterIp?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): ActivityLogPagedAdvancedRequest {
    const columns = ['id', 'action', 'description', 'ipAddress', 'userAgent', 'createdUserName', 'createdDate'];
    const columnFilters = {
      action: params.filterAction?.trim() || '',
      ipAddress: params.filterIp?.trim() || '',
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
        userId: params.userId ?? 0,
      }
    ) as ActivityLogPagedAdvancedRequest;
  }
}
