import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  StockTakeStatusDetailDto,
  CreateStockTakeStatusDto,
  UpdateStockTakeStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class StockTakeStatusService extends ApiService {

  /** Danh sách trạng thái kiểm kê phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/stock-take-status/paged-advanced', body);
  }

  /** Chi tiết trạng thái kiểm kê theo ID */
  getById(id: number): Observable<ApiResponse<StockTakeStatusDetailDto>> {
    return this.apiGet<StockTakeStatusDetailDto>(`/stock-take-status/${id}`);
  }

  /** Tạo mới trạng thái kiểm kê */
  create(payload: CreateStockTakeStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/stock-take-status', payload);
  }

  /** Cập nhật trạng thái kiểm kê */
  update(payload: UpdateStockTakeStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/stock-take-status', payload);
  }

  /** Xóa trạng thái kiểm kê theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/stock-take-status/${id}`);
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
