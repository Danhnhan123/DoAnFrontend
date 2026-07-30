import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  InboundOrderStatusDetailDto,
  CreateInboundOrderStatusDto,
  UpdateInboundOrderStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class InboundOrderStatusService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách trạng thái đơn nhập phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/inbound-order-status/paged-advanced`, body);
  }

  /** Chi tiết trạng thái đơn nhập theo ID */
  getById(id: number): Observable<ApiResponse<InboundOrderStatusDetailDto>> {
    return this.http.get<ApiResponse<InboundOrderStatusDetailDto>>(`${this.base}/inbound-order-status/${id}`);
  }

  /** Tạo mới trạng thái đơn nhập */
  create(payload: CreateInboundOrderStatusDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/inbound-order-status`, payload);
  }

  /** Cập nhật trạng thái đơn nhập */
  update(payload: UpdateInboundOrderStatusDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/inbound-order-status`, payload);
  }

  /** Xóa trạng thái đơn nhập theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/inbound-order-status/${id}`);
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
    const colIndex = params.colMap[params.sortField] ?? 3;
    const dateRange = buildDateRange(params.filterDateFrom, params.filterDateTo);

    return {
      draw: params.page,
      columns: [
        { data: 'id', name: '', searchable: true, orderable: true, search: { value: '', regex: false, fixed: [] } },
        { data: 'name', name: '', searchable: true, orderable: true, search: { value: params.filterName, regex: false, fixed: [] } },
        { data: 'color', name: '', searchable: true, orderable: true, search: { value: '', regex: false, fixed: [] } },
        { data: 'createdDate', name: '', searchable: true, orderable: true, search: { value: dateRange, regex: false, fixed: [] } },
        { data: 'id', name: '', searchable: false, orderable: false, search: { value: '', regex: false, fixed: [] } },
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: '' }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search, regex: false, fixed: [] },
    };
  }
}
