import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  UserStatusAdvancedRow,
  UserStatusDetailDto,
  CreateUserStatusDto,
  UpdateUserStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class UserStatusService extends ApiService {

  /** Lấy danh sách trạng thái người dùng phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/user-status/paged-advanced',
      body
    );
  }

  /** Lấy chi tiết trạng thái theo ID */
  getById(id: number): Observable<ApiResponse<UserStatusDetailDto>> {
    return this.apiGet<UserStatusDetailDto>(
      `/user-status/${id}`
    );
  }

  /** Tạo trạng thái mới */
  create(payload: CreateUserStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/user-status`,
      payload
    );
  }

  /** Cập nhật trạng thái */
  update(payload: UpdateUserStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/user-status', payload);
  }

  /** Xóa trạng thái theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/user-status/${id}`);
  }

  /** Xây dựng body DataTables cho phân trang trạng thái user */
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
    const columns = ['id', 'name', 'color', 'description', 'createdDate', 'id'];
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
