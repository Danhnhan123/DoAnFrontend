import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  StockTransferStatusDetailDto,
  CreateStockTransferStatusDto,
  UpdateStockTransferStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class StockTransferStatusService extends ApiService {

  /** Danh sách trạng thái điều chuyển phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/stock-transfer-status/paged-advanced', body);
  }

  /** Chi tiết trạng thái điều chuyển theo ID */
  getById(id: number): Observable<ApiResponse<StockTransferStatusDetailDto>> {
    return this.apiGet<StockTransferStatusDetailDto>(`/stock-transfer-status/${id}`);
  }

  /** Tạo mới trạng thái điều chuyển */
  create(payload: CreateStockTransferStatusDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/stock-transfer-status', payload);
  }

  /** Cập nhật trạng thái điều chuyển */
  update(payload: UpdateStockTransferStatusDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/stock-transfer-status', payload);
  }

  /** Xóa trạng thái điều chuyển theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/stock-transfer-status/${id}`);
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
