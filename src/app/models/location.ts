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
  currentOccupancy?: number | null;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
}

/**
 * Một dòng vị trí trong form thêm/sửa kho (popup gộp Kho + danh sách vị trí).
 * - Có `id`  => vị trí đã tồn tại (sẽ update khi lưu).
 * - Không id => vị trí mới (sẽ create list khi lưu kho).
 */
export interface WarehouseLocationLine {
  id?: number;
  zoneName: string;
  shelfRow?: string | null;
  shelfLevel?: string | null;
  slotCode?: string | null;
  maxCapacity?: number | null;
  currentOccupancy?: number | null;
  allowedCategoryId?: number | null;
  priority?: number | null;
  isQuarantine?: boolean;
  description?: string | null;
  isActive: boolean;
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
