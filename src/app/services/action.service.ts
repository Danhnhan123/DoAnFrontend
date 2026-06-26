import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ActionAdvancedRow,
  ActionDetailDto,
  CreateActionDto,
  UpdateActionDto,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class ActionService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy tất cả actions (không phân trang) */
  getAll(): Observable<ApiResponse<ActionAdvancedRow[]>> {
    return this.http.get<ApiResponse<ActionAdvancedRow[]>>(
      `${this.base}/action`
    );
  }

  /** Lấy danh sách action phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/action/paged-advanced`,
      body
    );
  }

  /** Lấy chi tiết action theo ID */
  getById(id: number): Observable<ApiResponse<ActionDetailDto>> {
    return this.http.get<ApiResponse<ActionDetailDto>>(
      `${this.base}/action/${id}`
    );
  }

  /** Tạo action mới */
  create(payload: CreateActionDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/action`, payload);
  }

  /** Cập nhật action */
  update(payload: UpdateActionDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/action`, payload);
  }

  /** Xóa action theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/action/${id}`);
  }

  /** Xây dựng body DataTables cho phân trang action */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName: string;
    filterDesc: string;
    filterDateFrom: string;
    filterDateTo: string;
  }): DTParameters {
    const colIndex = params.colMap[params.sortField] ?? 3;
    const dateRange = buildDateRange(
      params.filterDateFrom,
      params.filterDateTo
    );

    return {
      draw: params.page,
      columns: [
        {
          data: 'id',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'name',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: params.filterName, regex: false, fixed: [] },
        },
        {
          data: 'description',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: params.filterDesc, regex: false, fixed: [] },
        },
        {
          data: 'createdDate',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: dateRange, regex: false, fixed: [] },
        },
        {
          data: 'id',
          name: '',
          searchable: false,
          orderable: false,
          search: { value: '', regex: false, fixed: [] },
        },
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: '' }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search, regex: false, fixed: [] },
    };
  }
}
