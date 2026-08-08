import { DTParameters } from './search';

// Dùng CODE ổn định (đồng bộ cột Code ở bảng trạng thái) thay cho tên hiển thị tiếng Việt.
export const STOCK_TRANSFER_STATUS = {
  DRAFT: 'DRAFT',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export interface StockTransferRow {
  id: number;
  organizationId?: number | null;
  transferCode: string;
  statusId: number;
  statusName: string;
  statusCode: string;
  statusColor?: string | null;
  fromWarehouseId: number;
  fromWarehouseName: string;
  toWarehouseId: number;
  toWarehouseName: string;
  assignedUserId?: number | null;
  transferDate: string;
  note?: string | null;
  itemCount: number;
  totalWeightKg: number;
  itemDisplay?: string | null;
  createdDate: string;
}

export interface StockTransferItemDetail {
  id: number;
  productVariantId: number;
  sku?: string | null;
  productVariantName?: string | null;
  paddyLotId?: number | null;
  lotCode?: string | null;
  fromLocationId?: number | null;
  fromLocationName?: string | null;
  toLocationId?: number | null;
  toLocationName?: string | null;
  weightKg: number;
  note?: string | null;
}

export interface StockTransferDetail extends StockTransferRow {
  items: StockTransferItemDetail[];
  lastModifiedDate?: string | null;
}

export interface StockTransferSummary {
  transfersThisMonth: number;
  inTransitCount: number;
  totalTransferredWeightKg: number;
}

export interface StockTransferItemPayload {
  productVariantId: number;
  paddyLotId?: number | null;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  weightKg: number;
  note?: string | null;
}

export interface CreateStockTransferPayload {
  organizationId?: number | null;
  fromWarehouseId: number;
  toWarehouseId: number;
  transferDate: string;
  assignedUserId?: number | null;
  note?: string | null;
  items: StockTransferItemPayload[];
}

export interface UpdateStockTransferPayload extends CreateStockTransferPayload {
  id: number;
}

export interface StockTransferPagedRequest extends DTParameters {}
