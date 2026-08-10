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
  UserProfileDto,
  UpdateUserProfileDto,
  ChangePasswordDto,
  FileUploadItem,
  FileManagerPaging,
  FolderNode,
  UserStatistics,
  UserImportRow,
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
  /**
   * Lấy toàn bộ user (kèm vai trò) cho dropdown dùng chung — endpoint GetAll chỉ [Authorize].
   * Dùng ở các màn cần chọn user (vd Kiểm định chất lượng) mà role không có quyền READ menu User.
   */
  getAll(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.base}/user`);
  }

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

  /** Tạo hàng loạt user (toàn bộ hoặc không) */
  createList(payload: CreateUserDto[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/user/create-list`, payload);
  }

  /** Tải file mẫu import (xlsx | csv) dạng Blob */
  downloadImportTemplate(format: 'xlsx' | 'csv'): Observable<Blob> {
    return this.http.get(`${this.base}/user/import-template`, {
      params: { format },
      responseType: 'blob',
    });
  }

  /** Upload file Excel/CSV, nhận về danh sách dòng user đã đọc được */
  parseImport(file: File): Observable<ApiResponse<UserImportRow[]>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ApiResponse<UserImportRow[]>>(
      `${this.base}/user/import-parse`,
      form
    );
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

  /** Thống kê người dùng trên toàn bộ hệ thống (tổng, đang hoạt động, theo vai trò). */
  getUserStatistics(): Observable<ApiResponse<UserStatistics>> {
    return this.http.get<ApiResponse<UserStatistics>>(
      `${this.base}/user/statistics`
    );
  }

  /** Lấy hồ sơ tài khoản của chính user đang đăng nhập */
  getMyProfile(): Observable<ApiResponse<UserProfileDto>> {
    return this.http.get<ApiResponse<UserProfileDto>>(`${this.base}/user/me`);
  }

  /** Cập nhật hồ sơ cá nhân của chính mình */
  updateMyProfile(
    payload: UpdateUserProfileDto
  ): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.base}/user/me`, payload);
  }

  /** Đổi mật khẩu của chính mình */
  changeMyPassword(
    payload: ChangePasswordDto
  ): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/user/me/change-password`,
      payload
    );
  }

  // ===================== FILE MANAGER (chọn ảnh avatar) =====================

  /** Lấy cây thư mục (dùng chung của trình quản lý file). */
  getFolders(): Observable<ApiResponse<FolderNode[]>> {
    return this.http.get<ApiResponse<FolderNode[]>>(
      `${this.base}/file-manager/folders`
    );
  }

  /** Tạo thư mục mới. Trả về id của thư mục vừa tạo. */
  createFolder(
    folderName: string,
    parentId: number | null
  ): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(
      `${this.base}/file-manager/folders`,
      { folderName, parentId: parentId ?? 0 }
    );
  }

  /**
   * Lấy ảnh trong 1 thư mục (có phân trang, chỉ ảnh, lọc theo người sở hữu ở backend).
   */
  getFolderImages(
    folderId: number,
    pageIndex = 1,
    pageSize = 24
  ): Observable<ApiResponse<FileManagerPaging<FileUploadItem>>> {
    return this.http.post<ApiResponse<FileManagerPaging<FileUploadItem>>>(
      `${this.base}/file-manager/folders/${folderId}/paged`,
      {
        pageIndex,
        pageSize,
        keyword: '',
        fileTypes: ['image'],
      }
    );
  }

  /** Upload ảnh vào 1 thư mục cụ thể. */
  uploadToFolder(
    folderId: number,
    file: File
  ): Observable<ApiResponse<any>> {
    const form = new FormData();
    form.append('Files', file);
    form.append('FolderUploadId', String(folderId));
    return this.http.post<ApiResponse<any>>(
      `${this.base}/file-manager/upload`,
      form
    );
  }

  /** Xây dựng body DataTables cho phân trang user */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
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
      fullname: params.filterFullname,
      email: params.filterEmail,
      phoneNumber: params.filterPhone,
      userStatusIds: params.filterStatusIds,
      roleIds: params.filterRoleIds,
    };
  }
}
