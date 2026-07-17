import { DTParameters } from './search';

/** Một dòng cấu hình ngưỡng cảnh báo tồn thấp hiển thị trên bảng. */
export interface StockAlertConfigRow {
  id: number;
  warehouseId: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  productVariantId?: number | null;
  productVariantSku?: string | null;
  productName?: string | null;
  minThreshold: number;
  isActive: boolean;
  createdDate: string;
}

export interface StockAlertConfigDetailDto extends StockAlertConfigRow {
  lastModifiedDate?: string | null;
}

export interface CreateStockAlertConfigDto {
  warehouseId: number;
  productVariantId?: number | null;
  minThreshold: number;
  isActive: boolean;
}

export interface UpdateStockAlertConfigDto extends CreateStockAlertConfigDto {
  id: number;
}

export interface StockAlertConfigPagedAdvancedRequest extends DTParameters {}

/** Option kho cho dropdown (đặt tên riêng để tránh trùng WarehouseOption của inbound-order). */
export interface StockWarehouseOption {
  id: number;
  code: string;
  name: string;
}

/** Option SKU/biến thể cho dropdown. */
export interface StockVariantOption {
  id: number;
  sku: string;
  productName?: string | null;
}
