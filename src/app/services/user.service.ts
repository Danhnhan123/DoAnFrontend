import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  UserDetailDto,
  CreateUserDto,
  UpdateUserDto,
  UserAdvancedDto,
  UserStatusDetailDto,
  DataItem,
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
import { buildDataTablesRequest } from '../utils/datatable.util';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class UserService extends ApiService {

  /** Lấy danh sách user dạng phân trang nâng cao (DataTables) */
  getPagedAdvanced(body: UserAdvancedDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/user/paged-advanced', body);
  }

  /**
   * Lấy toàn bộ user (kèm vai trò) cho dropdown dùng chung — endpoint GetAll chỉ [Authorize].
   * Dùng ở các màn cần chọn user (vd Kiểm định chất lượng) mà role không có quyền READ menu User.
   */
  getAll(): Observable<ApiResponse<any>> {
    return this.apiGet<any>('/user');
  }

  getById(id: number): Observable<ApiResponse<UserDetailDto>> {
    return this.apiGet<UserDetailDto>(`/user/${id}`);
  }

  /** Tạo user mới */
  create(payload: CreateUserDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/user', payload);
  }

  /** Cập nhật user */
  update(payload: UpdateUserDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/user', payload);
  }

  /** Tạo hàng loạt user (toàn bộ hoặc không) */
  createList(payload: CreateUserDto[]): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/user/create-list', payload);
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
    return this.apiDelete<any>(`/user/${id}`);
  }

  /** Lấy danh sách trạng thái user */
  getUserStatuses(): Observable<ApiResponse<UserStatusDetailDto[]>> {
    return this.apiGet<UserStatusDetailDto[]>('/user-status');
  }

  /** Lấy danh sách vai trò */
  getRoles(): Observable<ApiResponse<DataItem[]>> {
    return this.apiGet<DataItem[]>('/role');
  }

  /** Thống kê người dùng trên toàn bộ hệ thống (tổng, đang hoạt động, theo vai trò). */
  getUserStatistics(): Observable<ApiResponse<UserStatistics>> {
    return this.apiGet<UserStatistics>('/user/statistics');
  }

  /** Lấy hồ sơ tài khoản của chính user đang đăng nhập */
  getMyProfile(): Observable<ApiResponse<UserProfileDto>> {
    return this.apiGet<UserProfileDto>('/user/me');
  }

  /** Cập nhật hồ sơ cá nhân của chính mình */
  updateMyProfile(
    payload: UpdateUserProfileDto
  ): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/user/me', payload);
  }

  /** Đổi mật khẩu của chính mình */
  changeMyPassword(
    payload: ChangePasswordDto
  ): Observable<ApiResponse<any>> {
    return this.apiPut<any>('/user/me/change-password', payload);
  }

  // ===================== FILE MANAGER (chọn ảnh avatar) =====================

  /** Lấy cây thư mục (dùng chung của trình quản lý file). */
  getFolders(): Observable<ApiResponse<FolderNode[]>> {
    return this.apiGet<FolderNode[]>('/file-manager/folders');
  }

  /** Tạo thư mục mới. Trả về id của thư mục vừa tạo. */
  createFolder(
    folderName: string,
    parentId: number | null
  ): Observable<ApiResponse<number>> {
    return this.apiPost<number>('/file-manager/folders', {
      folderName,
      parentId: parentId ?? 0,
    });
  }

  /**
   * Lấy ảnh trong 1 thư mục (có phân trang, chỉ ảnh, lọc theo người sở hữu ở backend).
   * */
  getFolderImages(
    folderId: number,
    pageIndex = 1,
    pageSize = 24
  ): Observable<ApiResponse<FileManagerPaging<FileUploadItem>>> {
    return this.apiPost<FileManagerPaging<FileUploadItem>>(
      `/file-manager/folders/${folderId}/paged`,
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
    const columns = [
      'id',
      'firstName',
      'email',
      'phoneNumber',
      'userStatusName',
      'createdDate',
      'id',
    ];

    const dateRange = buildDateRange(
      params.filterDateFrom,
      params.filterDateTo
    );

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      {
        createdDate: dateRange,
      },
      {
        fullname: params.filterFullname,
        email: params.filterEmail,
        phoneNumber: params.filterPhone,
        userStatusIds: params.filterStatusIds,
        roleIds: params.filterRoleIds,
      }
    );
  }
}
