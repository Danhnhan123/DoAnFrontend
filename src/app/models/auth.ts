import { DataItem } from './common';
import { MenuAggregate } from './menu';
import { PermissionAggregate } from './permission';

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
