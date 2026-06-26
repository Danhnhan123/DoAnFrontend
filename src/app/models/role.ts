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
