import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  LotStatusDetailDto,
  CreateLotStatusDto,
  UpdateLotStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class LotStatusService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách trạng thái lô phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/lot-status/paged-advanced`, body);
  }

  /** Chi tiết trạng thái lô theo ID */
  getById(id: number): Observable<ApiResponse<LotStatusDetailDto>> {
    return this.http.get<ApiResponse<LotStatusDetailDto>>(`${this.base}/lot-status/${id}`);
  }

  /** Tạo mới trạng thái lô */
  create(payload: CreateLotStatusDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/lot-status`, payload);
  }

  /** Cập nhật trạng thái lô */
  update(payload: UpdateLotStatusDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/lot-status`, payload);
  }

  /** Xóa trạng thái lô theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/lot-status/${id}`);
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
    const colIndex = params.colMap[params.sortField] ?? 4;
    const dateRange = buildDateRange(params.filterDateFrom, params.filterDateTo);

    return {
      draw: params.page,
      columns: [
        { data: 'id', name: '', searchable: true, orderable: true, search: { value: '', regex: false, fixed: [] } },
        { data: 'code', name: '', searchable: true, orderable: true, search: { value: '', regex: false, fixed: [] } },
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
