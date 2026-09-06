import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  PaddyPurchaseScheduleStatusDetailDto,
  CreatePaddyPurchaseScheduleStatusDto,
  UpdatePaddyPurchaseScheduleStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class PaddyPurchaseScheduleStatusService extends ApiService {

  /** Danh sách trạng thái lịch thu mua phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/paddy-purchase-schedule-status/paged-advanced', body);
  }

  /** Chi tiết trạng thái lịch thu mua theo ID */
  getById(id: number): Observable<ApiResponse<PaddyPurchaseScheduleStatusDetailDto>> {
    return this.apiGet<PaddyPurchaseScheduleStatusDetailDto>(`/paddy-purchase-schedule-status/${id}`);
  }

  /** Tạo mới trạng thái lịch thu mua */
  create(payload: CreatePaddyPurchaseScheduleStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/paddy-purchase-schedule-status', payload);
  }

  /** Cập nhật trạng thái lịch thu mua */
  update(payload: UpdatePaddyPurchaseScheduleStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/paddy-purchase-schedule-status', payload);
  }

  /** Xóa trạng thái lịch thu mua theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/paddy-purchase-schedule-status/${id}`);
  }

  /** Xây dựng body DataTables cho phân trang */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName: string;
    filterDateFrom: string;
    filterDateTo: string;
  }): DTParameters {
    const columns = ['id', 'code', 'name', 'color', 'createdDate', 'id'];
    const columnFilters = {
      name: params.filterName,
      createdDate: buildDateRange(params.filterDateFrom, params.filterDateTo),
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
      columnFilters
    ) as DTParameters;
  }
}
