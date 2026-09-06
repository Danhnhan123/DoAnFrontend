import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  ActionAdvancedRow,
  ActionDetailDto,
  CreateActionDto,
  UpdateActionDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ActionService extends ApiService {

  /** Lấy tất cả actions (không phân trang) */
  getAll(): Observable<ApiResponse<ActionAdvancedRow[]>> {
    return this.apiGet<ActionAdvancedRow[]>(
      '/action'
    );
  }

  /** Lấy danh sách action phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/action/paged-advanced',
      body
    );
  }

  /** Lấy chi tiết action theo ID */
  getById(id: number): Observable<ApiResponse<ActionDetailDto>> {
    return this.apiGet<ActionDetailDto>(
      `/action/${id}`
    );
  }

  /** Tạo action mới */
  create(payload: CreateActionDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/action', payload);
  }

  /** Cập nhật action */
  update(payload: UpdateActionDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/action', payload);
  }

  /** Xóa action theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/action/${id}`);
  }

  /** Xây dựng body DataTables cho phân trang action */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName: string;
    filterDesc: string;
    filterDateFrom: string;
    filterDateTo: string;
  }): DTParameters {
    const columns = ['id', 'name', 'description', 'createdDate', 'id'];
    const columnFilters = {
      name: params.filterName,
      description: params.filterDesc,
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
