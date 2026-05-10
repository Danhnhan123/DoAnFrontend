import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  UserStatusAdvancedRow,
  UserStatusDetailDto,
  CreateUserStatusDto,
  UpdateUserStatusDto,
  DTParameters,
} from '../models';
import { buildDateRange } from './user.service';

@Injectable({ providedIn: 'root' })
export class UserStatusService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy danh sách trạng thái người dùng phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/user-status/paged-advanced`,
      body
    );
  }

  /** Lấy chi tiết trạng thái theo ID */
  getById(id: number): Observable<ApiResponse<UserStatusDetailDto>> {
    return this.http.get<ApiResponse<UserStatusDetailDto>>(
      `${this.base}/user-status/${id}`
    );
  }

  /** Tạo trạng thái mới */
  create(payload: CreateUserStatusDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/user-status`,
      payload
    );
  }

  /** Cập nhật trạng thái */
  update(payload: UpdateUserStatusDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/user-status`, payload);
  }

  /** Xóa trạng thái theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/user-status/${id}`);
  }

  /** Xây dựng body DataTables cho phân trang trạng thái user */
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
    const colIndex = params.colMap[params.sortField] ?? 4;
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
          data: 'color',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
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
