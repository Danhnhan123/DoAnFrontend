export interface UserStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  description?: string;
  createdDate: string;
}

export interface UserStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  description: string;
  color: string;
  createdDate: string;
}

export interface CreateUserStatusDto {
  code?: string;
  name: string;
  description: string;
  color: string;
}

export interface UpdateUserStatusDto extends CreateUserStatusDto {
  id: number;
}
