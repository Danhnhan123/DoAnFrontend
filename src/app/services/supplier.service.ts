import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  SupplierDetailDto,
  SupplierPagedAdvancedRequest,
  CreateSupplierDto,
  UpdateSupplierDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class SupplierService extends ApiService {

  /** Danh sách nhà cung cấp dạng DataTables (phân trang/tìm/lọc/sắp xếp). */
  getPagedAdvanced(
    body: SupplierPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/suppliers/paged-advanced',
      body
    );
  }

  /** Chi tiết một nhà cung cấp theo id. */
  getById(id: number): Observable<ApiResponse<SupplierDetailDto>> {
    return this.apiGet<SupplierDetailDto>(
      `/suppliers/${id}`
    );
  }

  /** Tạo mới nhà cung cấp. */
  create(payload: CreateSupplierDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/suppliers', payload);
  }

  /** Cập nhật nhà cung cấp. */
  update(payload: UpdateSupplierDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/suppliers', payload);
  }

  /** Xóa mềm nhà cung cấp. */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/suppliers/${id}`);
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * - search.value: từ khóa tìm kiếm chung
   * - order: cột + chiều sắp xếp
   * - columns[].search.value: bộ lọc theo cột (trạng thái hoạt động)
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterCode?: string | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): SupplierPagedAdvancedRequest {
    const columns = ['id', 'name', 'code', 'contactPerson', 'phone', 'email', 'taxCode', 'isActive', 'createdDate'];
    const columnFilters = {
      name: params.filterName?.trim() || '',
      code: params.filterCode?.trim() || '',
      isActive: params.filterIsActive != null ? String(params.filterIsActive) : '',
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
    ) as SupplierPagedAdvancedRequest;
  }
}
