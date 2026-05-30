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
