import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  UserAdvancedRow,
  UserDetailDto,
  CreateUserDto,
  UpdateUserDto,
  UserAdvancedDto,
  UserStatusDetailDto,
  DataItem,
  DTParameters,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

/** Hàm tiện ích: Chuyển chuỗi YYYY-MM-DD sang DD/MM/YYYY */

/** Hàm tiện ích: Xây dựng chuỗi khoảng ngày cho DataTables */

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy danh sách user dạng phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: UserAdvancedDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/user/paged-advanced`,
      body
    );
  }

  /** Lấy chi tiết user theo ID */
  getById(id: number): Observable<ApiResponse<UserDetailDto>> {
    return this.http.get<ApiResponse<UserDetailDto>>(`${this.base}/user/${id}`);
  }

  /** Tạo user mới */
  create(payload: CreateUserDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/user`, payload);
  }

  /** Cập nhật user */
  update(payload: UpdateUserDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/user`, payload);
  }

  /** Xóa user theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.base}/user/${id}`);
  }

  /** Lấy danh sách trạng thái user */
  getUserStatuses(): Observable<ApiResponse<UserStatusDetailDto[]>> {
    return this.http.get<ApiResponse<UserStatusDetailDto[]>>(
      `${this.base}/user-status`
    );
  }

  /** Lấy danh sách vai trò */
  getRoles(): Observable<ApiResponse<DataItem[]>> {
    return this.http.get<ApiResponse<DataItem[]>>(`${this.base}/role`);
  }

  /** Xây dựng body DataTables cho phân trang user */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterUsername: string;
    filterFullname: string;
    filterEmail: string;
    filterPhone: string;
    filterStatusIds: number[];
    filterRoleIds: number[];
    filterDateFrom: string;
    filterDateTo: string;
  }): UserAdvancedDto {
    const colIndex = params.colMap[params.sortField] ?? 5;
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
          data: 'firstName',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'email',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'phoneNumber',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
        {
          data: 'userStatusName',
          name: '',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
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
      username: params.filterUsername,
      fullname: params.filterFullname,
      email: params.filterEmail,
      phoneNumber: params.filterPhone,
      userStatusIds: params.filterStatusIds,
      roleIds: params.filterRoleIds,
    };
  }
}
