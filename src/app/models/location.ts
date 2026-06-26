import { DTParameters } from './search';

/**
 * Một dòng vị trí lưu trữ hiển thị trên bảng.
 * Trùng cấu trúc với LocationAggregate / LocationListDto của backend.
 */
export interface LocationRow {
  id: number;
  warehouseId: number;
  warehouseName: string;
  zoneName: string;
  shelfRow?: string | null;
  shelfLevel?: string | null;
  slotCode?: string | null;
  maxCapacity?: number | null;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
}

/** Chi tiết vị trí (bổ sung các trường nâng cao so với danh sách). */
export interface LocationDetailDto extends LocationRow {
  currentOccupancy: number;
  allowedCategoryId?: number | null;
  allowedCategoryName?: string | null;
  priority: number;
  isQuarantine: boolean;
}

export interface CreateLocationDto {
  warehouseId: number;
  zoneName: string;
  shelfRow?: string | null;
  shelfLevel?: string | null;
  slotCode?: string | null;
  maxCapacity?: number | null;
  description?: string | null;
  isActive: boolean;
  currentOccupancy: number;
  allowedCategoryId?: number | null;
  priority: number;
  isQuarantine: boolean;
}

export interface UpdateLocationDto extends CreateLocationDto {
  id: number;
}

export interface LocationPagedAdvancedRequest extends DTParameters {}
