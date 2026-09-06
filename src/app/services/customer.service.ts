import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  CustomerDetailDto,
  CustomerPagedAdvancedRequest,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class CustomerService extends ApiService {

  getPagedAdvanced(
    body: CustomerPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/customers/paged-advanced',
      body
    );
  }

  /**
   * Lấy toàn bộ khách hàng cho dropdown (endpoint GetAll dùng chung, chỉ [Authorize]).
   * Dùng thay cho paged-advanced ở các màn cần dropdown khách hàng nhưng role không có quyền xem menu Khách hàng.
   */
  getAll(): Observable<ApiResponse<CustomerDetailDto[]>> {
    return this.apiGet<CustomerDetailDto[]>(
      '/customers'
    );
  }

  getById(id: number): Observable<ApiResponse<CustomerDetailDto>> {
    return this.apiGet<CustomerDetailDto>(
      `/customers/${id}`
    );
  }

  create(payload: CreateCustomerDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/customers', payload);
  }

  update(payload: UpdateCustomerDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/customers', payload);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/customers/${id}`);
  }

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
  }): CustomerPagedAdvancedRequest {
    const columns = ['id', 'name', 'code', 'customerType', 'contactPerson', 'phone', 'email', 'taxCode', 'isActive', 'createdDate'];
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
    ) as CustomerPagedAdvancedRequest;
  }
}
