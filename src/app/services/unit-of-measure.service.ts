import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  UnitOfMeasureDetailDto,
  UnitOfMeasurePagedAdvancedRequest,
  CreateUnitOfMeasureDto,
  UpdateUnitOfMeasureDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class UnitOfMeasureService extends ApiService {

  /** Danh sách đơn vị tính dạng DataTables (phân trang/tìm/sắp xếp). */
  getPagedAdvanced(
    body: UnitOfMeasurePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/unit-of-measures/paged-advanced',
      body
    );
  }

  /** Chi tiết một đơn vị tính theo id. */
  getById(id: number): Observable<ApiResponse<UnitOfMeasureDetailDto>> {
    return this.apiGet<UnitOfMeasureDetailDto>(
      `/unit-of-measures/${id}`
    );
  }

  /** Tạo mới đơn vị tính. */
  create(payload: CreateUnitOfMeasureDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/unit-of-measures`,
      payload
    );
  }

  /** Cập nhật đơn vị tính. */
  update(payload: UpdateUnitOfMeasureDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/unit-of-measures`,
      payload
    );
  }

  /** Xóa mềm đơn vị tính. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/unit-of-measures/${id}`);
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * Đơn vị tính không có lọc nâng cao nên chỉ có search + sort.
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterSymbol?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): UnitOfMeasurePagedAdvancedRequest {
    const columns = ['id', 'name', 'symbol', 'createdDate'];
    const columnFilters = {
      name: params.filterName?.trim() || '',
      symbol: params.filterSymbol?.trim() || '',
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
      columnFilters
    ) as UnitOfMeasurePagedAdvancedRequest;
  }
}
