import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  SalesOrderStatusDetailDto,
  CreateSalesOrderStatusDto,
  UpdateSalesOrderStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class SalesOrderStatusService extends ApiService {

  /** Danh sách trạng thái đơn bán phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/sales-order-status/paged-advanced', body);
  }

  /** Chi tiết trạng thái đơn bán theo ID */
  getById(id: number): Observable<ApiResponse<SalesOrderStatusDetailDto>> {
    return this.apiGet<SalesOrderStatusDetailDto>(`/sales-order-status/${id}`);
  }

  /** Tạo mới trạng thái đơn bán */
  create(payload: CreateSalesOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/sales-order-status', payload);
  }

  /** Cập nhật trạng thái đơn bán */
  update(payload: UpdateSalesOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/sales-order-status', payload);
  }

  /** Xóa trạng thái đơn bán theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/sales-order-status/${id}`);
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
    const columns = ['id', 'name', 'color', 'createdDate', 'id'];
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
