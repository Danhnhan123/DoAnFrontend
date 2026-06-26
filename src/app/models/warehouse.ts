import { DTParameters } from './search';

/**
 * Một dòng kho hàng hiển thị trên bảng.
 * Trùng cấu trúc với WarehouseAggregate / WarehouseDetailDto của backend.
 */
export interface WarehouseRow {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface WarehouseDetailDto extends WarehouseRow {}

export interface CreateWarehouseDto {
  code: string;
  name: string;
  address?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface UpdateWarehouseDto extends CreateWarehouseDto {
  id: number;
}

export interface WarehousePagedAdvancedRequest extends DTParameters {}
