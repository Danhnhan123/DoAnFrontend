import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  PurchaseOrderStatusDetailDto,
  CreatePurchaseOrderStatusDto,
  UpdatePurchaseOrderStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class PurchaseOrderStatusService extends ApiService {

  /** Danh sách trạng thái đơn mua phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/purchase-order-status/paged-advanced', body);
  }

  /** Chi tiết trạng thái đơn mua theo ID */
  getById(id: number): Observable<ApiResponse<PurchaseOrderStatusDetailDto>> {
    return this.apiGet<PurchaseOrderStatusDetailDto>(`/purchase-order-status/${id}`);
  }

  /** Tạo mới trạng thái đơn mua */
  create(payload: CreatePurchaseOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/purchase-order-status', payload);
  }

  /** Cập nhật trạng thái đơn mua */
  update(payload: UpdatePurchaseOrderStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/purchase-order-status', payload);
  }

  /** Xóa trạng thái đơn mua theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/purchase-order-status/${id}`);
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
