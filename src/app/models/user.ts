import { DataItem } from './common';
import { DTParameters } from './search';

export interface UserAdvancedRow {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  gender?: number;
  userStatusId: number;
  userStatusName: string;
  userStatusCode: string;
  userStatusColor?: string;
  avatarUrl?: string;
  lockEnabled: boolean;
  lockEndDate?: string;
  identityNumber?: string;
  addressDetail?: string;
  createdDate: string;
  dateOfBirth?: string;
  roles: DataItem[];
}

export interface UserAdvancedDto extends DTParameters {
  fullname?: string;
  email?: string;
  phoneNumber?: string;
  userStatusIds?: number[];
  roleIds?: number[];
}

export interface UserDetailDto {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: number;
  phoneNumber?: string;
  identityNumber?: string;
  addressDetail?: string;
  accessFailedCount: number;
  lockEnabled: boolean;
  lockEndDate?: string;
  userStatus: DataItem;
  avatar?: { url: string };
  roles?: DataItem[];
  createdDate: string;
  dateOfBirth?: string;
}

export interface CreateUserDto {
  /** Tên đăng nhập (tách riêng khỏi email). */
  username: string;
  /** Email chỉ dùng để nhận thông báo/cấp mật khẩu từ hệ thống. */
  email: string;
  phoneNumber?: string;
  gender?: number;
  firstName: string;
  lastName: string;
  identityNumber?: string;
  addressDetail?: string;
  roles: number[];
}

export interface UpdateUserDto {
  id: number;
  userStatusId: number;
  lockEnabled: boolean;
  lockEndDate?: string | null;
  roles: number[];
}

/** Một dòng trong bảng tạo user hàng loạt (client-side). */
export interface UserBulkRow {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  gender?: number;
  roles: number[];
}

/** Dòng user đọc từ file import (BE trả về). */
export interface UserImportRow {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  identityNumber?: string;
  gender?: number;
}

/** Lỗi theo dòng khi tạo hàng loạt (BE trả về khi 422). Row là số thứ tự 1-based. */
export interface UserBatchRowError {
  row: number;
  errors: string[];
}

/** Hồ sơ tài khoản của chính user đang đăng nhập (GET /user/me). */
export interface UserProfileDto {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: number;
  phoneNumber?: string;
  identityNumber?: string;
  /** Lưu ý: tên field khớp đúng với backend (thiếu 1 chữ 'd'). */
  addresDetail?: string;
  userStatus: DataItem;
  userRoles: DataItem[];
  avatar?: { id: number; url: string };
}

/** Payload cập nhật hồ sơ cá nhân (PUT /user/me). */
export interface UpdateUserProfileDto {
  firstName: string;
  lastName: string;
  gender?: number | null;
  phoneNumber?: string | null;
  identityNumber?: string | null;
  addresDetail?: string | null;
  avatarId?: number | null;
}

/** Payload đổi mật khẩu (PUT /user/me/change-password). */
export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

/** Kết quả upload avatar (POST /file-manager/upload-by-category). */
export interface AvatarUploadResult {
  id: number;
  fileUrl: string;
  fileName: string;
  fileKey: string;
  fileType: string;
  fileSize: number;
}

/** Một ảnh trong thư viện file (POST /file-manager/{category}/paged). */
export interface FileUploadItem {
  id: number;
  fileName: string;
  fileSize?: number;
  fileKey?: string;
  fileType?: string;
  url: string;
}

/** Cấu trúc phân trang trả về từ file-manager (khác PagingData chung). */
export interface FileManagerPaging<T> {
  dataSource: T[];
  total: number;
  totalFiltered: number;
  currentPage: number;
  pageSize: number;
}

/** Số user theo từng vai trò (thành phần của thống kê). */
export interface RoleCount {
  roleId: number;
  roleName: string;
  count: number;
}

/** Thống kê người dùng trên toàn bộ hệ thống (GET /user/statistics). */
export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  roleCounts: RoleCount[];
}

/** Một thư mục trong cây thư mục file-manager (GET /file-manager/folders). */
export interface FolderNode {
  id: number;
  folderName: string;
  folderPath: string;
  parentId?: number | null;
  treeIds: string;
  createdDate: string;
  childs: FolderNode[];
}
