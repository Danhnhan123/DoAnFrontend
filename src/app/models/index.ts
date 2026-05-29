// API Response wrapper
export interface ApiResponse<T = any> {
  status: number;
  code: string;
  message: string;
  resources: T;
  errors: any;
  isSucceeded: boolean;
}

export interface PagingData<T> {
  items: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
}

export interface DTResponse<T> {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: T[];
}
export interface DataItem<T = number> {
  id: T;
  name: string;
}

// ===================== SEARCH =====================
export interface SearchQuery {
  pageIndex?: number;
  pageSize?: number;
  keyword?: string;
  sortType?: string;
  orderBy?: string;
}
export interface DTColumn {
  data: string;
  name: string;
  searchable: boolean;
  orderable: boolean;
  search: { value: string; regex: boolean; fixed: any[] };
}
export interface DTParameters {
  draw: number;
  columns: DTColumn[];
  order: { column: number; dir: string; name: string }[];
  start: number;
  length: number;
  search: { value: string; regex: boolean; fixed: any[] };
}

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponseAdminUserInfo {
  id: number;
  fullName: string;
  avatarUrl?: string;
  email: string;
  roles: DataItem[];
  permissions: PermissionAggregate[];
  menus: MenuAggregate[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  userInfo: LoginResponseAdminUserInfo;
}

export interface AuthProfile {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: number;
  phoneNumber?: string;
  userStatus: DataItem;
  userRoles: DataItem[];
  avatar?: { url: string };
}

// Menu
export interface MenuAggregate {
  id: number;
  parentId?: number;
  treeIds: string;
  menuType: string;
  name: string;
  url: string;
  icon?: string;
  className?: string;
  sortOrder: number;
  child?: MenuAggregate[];
}

// Permission
export interface PermissionAggregate {
  menuId: number;
  actionIds: number[];
}

/// ===================== USER =====================
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
  username?: string;
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
  email: string;
  passwordHash: string;
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

// ===================== USER STATUS =====================
export interface UserStatusAdvancedRow {
  id: number;
  name: string;
  color: string;
  description?: string;
  createdDate: string;
}

export interface UserStatusDetailDto {
  id: number;
  name: string;
  description: string;
  color: string;
  createdDate: string;
}

export interface CreateUserStatusDto {
  name: string;
  description: string;
  color: string;
}

export interface UpdateUserStatusDto extends CreateUserStatusDto {
  id: number;
}

// ===================== ROLE =====================
export interface RoleListDto {
  id: number;
  name: string;
  description?: string;
  createdDate: string;
  totalUser: number;
  permissons: RolePermissonDto[];
}
export interface RolePermissonDto {
  id: number;
  actionId: number;
  actionName: string;
  menuId: number;
  menuName: string;
}
export interface RoleMenuActionDto {
  actionId: number;
  menuId: number;
}
export interface CreateRoleDto {
  name: string;
  description?: string;
  isCheckAll: boolean;
  permissions: RoleMenuActionDto[];
}
export interface UpdateRoleDto extends CreateRoleDto {
  id: number;
}

// ===================== MENU =====================
export interface MenuAggregate {
  id: number;
  parentId?: number;
  treeIds: string;
  menuType: string;
  name: string;
  url: string;
  icon?: string;
  className?: string;
  sortOrder: number;
  child?: MenuAggregate[];
  isOpen?: boolean;
}
export interface MenuDetailDto {
  id: number;
  parentId?: number;
  treeIds: string;
  menuType: string;
  name: string;
  url: string;
  icon?: string;
  className?: string;
  sortOrder: number;
  isAdminOnly: boolean;
  createdDate: string;
  actionIds: number[];
}
export interface MenuPermissionDto {
  id: number;
  parentId?: number;
  treeIds: string;
  name: string;
  hasCreate: boolean;
  hasRead: boolean;
  hasUpdate: boolean;
  hasDelete: boolean;
  hasExport: boolean;
  hasApprove: boolean;
}
export interface CreateMenuDto {
  parentId?: number | null;
  menuType: string;
  name: string;
  url?: string;
  icon?: string;
  className?: string | null;
  sortOrder: number;
  isAdminOnly: boolean;
  actionIds: number[];
}
export interface UpdateMenuDto extends CreateMenuDto {
  id: number;
}

// System Config
export interface SystemConfigDetailDto {
  id: number;
  key: string;
  value: string;
  description?: string;
  createdDate: string;
}

// Audit Log
export interface AuditLogDetailDto {
  id: number;
  tableName: string;
  action: string;
  oldValues?: string;
  newValues?: string;
  changedBy?: string;
  changedDate: string;
}

// Activity Log
export interface ActivityLogDetailDto {
  id: number;
  userId: number;
  userName: string;
  action: string;
  description?: string;
  ipAddress?: string;
  createdDate: string;
}

// ===================== ACTION =====================
export interface ActionDto {
  id: number;
  name: string;
  description?: string;
  createdDate: string;
}

// Flat menu for permission table
export interface FlatMenu {
  id: number;
  parentId?: number;
  name: string;
  icon?: string;
  url: string;
  sortOrder: number;
  order: number;
}

// ===================== ACTION ADVANCED =====================
export interface ActionAdvancedRow {
  id: number;
  name: string;
  description?: string;
  createdDate: string;
}
export interface ActionDetailDto {
  id: number;
  name: string;
  description?: string;
  createdDate: string;
}
export interface CreateActionDto {
  name: string;
  description?: string;
  createdBy?: number;
}
export interface UpdateActionDto {
  id: number;
  name: string;
  description?: string;
  createdBy?: number;
  uodatedBy?: number;
}

