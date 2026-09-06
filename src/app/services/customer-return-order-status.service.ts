import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  CustomerReturnOrderStatusDetailDto,
  CreateCustomerReturnOrderStatusDto,
  UpdateCustomerReturnOrderStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class CustomerReturnOrderStatusService extends ApiService {

  /** Danh sách trạng thái đơn hoàn khách phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/customer-return-order-status/paged-advanced', body);
  }

  /** Chi tiết trạng thái đơn hoàn khách theo ID */
  getById(id: number): Observable<ApiResponse<CustomerReturnOrderStatusDetailDto>> {
    return this.apiGet<CustomerReturnOrderStatusDetailDto>(`/customer-return-order-status/${id}`);
  }

  /** Tạo mới trạng thái đơn hoàn khách */
  create(payload: CreateCustomerReturnOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/customer-return-order-status', payload);
  }

  /** Cập nhật trạng thái đơn hoàn khách */
  update(payload: UpdateCustomerReturnOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/customer-return-order-status', payload);
  }

  /** Xóa trạng thái đơn hoàn khách theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/customer-return-order-status/${id}`);
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
