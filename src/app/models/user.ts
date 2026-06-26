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
