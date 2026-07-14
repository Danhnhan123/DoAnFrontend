export interface MenuAggregate {
  id: number;
  code?: string;
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
  code?: string;
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
  code?: string | null;
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

export interface FlatMenu {
  id: number;
  parentId?: number;
  name: string;
  icon?: string;
  url: string;
  sortOrder: number;
  order: number;
}
