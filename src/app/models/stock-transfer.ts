import { DTParameters } from './search';

export const STOCK_TRANSFER_STATUS = {
  DRAFT: 'Nháp',
  IN_TRANSIT: 'Đang chuyển',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Hủy',
} as const;

export interface StockTransferRow {
  id: number;
  organizationId?: number | null;
  transferCode: string;
  statusId: number;
  statusName: string;
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
