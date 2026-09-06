import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  MillingOrderStatusDetailDto,
  CreateMillingOrderStatusDto,
  UpdateMillingOrderStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class MillingOrderStatusService extends ApiService {

  /** Danh sách trạng thái lệnh xay phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/milling-order-status/paged-advanced', body);
  }

  /** Chi tiết trạng thái lệnh xay theo ID */
  getById(id: number): Observable<ApiResponse<MillingOrderStatusDetailDto>> {
    return this.apiGet<MillingOrderStatusDetailDto>(`/milling-order-status/${id}`);
  }

  /** Tạo mới trạng thái lệnh xay */
  create(payload: CreateMillingOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/milling-order-status', payload);
  }

  /** Cập nhật trạng thái lệnh xay */
  update(payload: UpdateMillingOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/milling-order-status', payload);
  }

  /** Xóa trạng thái lệnh xay theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/milling-order-status/${id}`);
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
