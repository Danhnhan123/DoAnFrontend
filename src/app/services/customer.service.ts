import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  CustomerDetailDto,
  CustomerPagedAdvancedRequest,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: CustomerPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/customers/paged-advanced`,
      body
    );
  }

  /**
   * Lấy toàn bộ khách hàng cho dropdown (endpoint GetAll dùng chung, chỉ [Authorize]).
   * Dùng thay cho paged-advanced ở các màn cần dropdown khách hàng nhưng role không có quyền xem menu Khách hàng.
   */
  getAll(): Observable<ApiResponse<CustomerDetailDto[]>> {
    return this.http.get<ApiResponse<CustomerDetailDto[]>>(
      `${this.base}/customers`
    );
  }

  getById(id: number): Observable<ApiResponse<CustomerDetailDto>> {
    return this.http.get<ApiResponse<CustomerDetailDto>>(
      `${this.base}/customers/${id}`
    );
  }

  create(payload: CreateCustomerDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/customers`, payload);
  }

  update(payload: UpdateCustomerDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/customers`, payload);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/customers/${id}`);
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
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const activeValue =
      params.filterIsActive != null ? String(params.filterIsActive) : '';
    const dateSearch = buildDateRange(params.dateFrom ?? '', params.dateTo ?? '');

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('name', params.filterName?.trim() || ''),
        col('code', params.filterCode?.trim() || ''),
        col('customerType'),
        col('contactPerson'),
        col('phone'),
        col('email'),
        col('taxCode'),
        col('isActive', activeValue),
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
