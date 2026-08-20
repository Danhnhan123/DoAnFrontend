import { DTParameters } from './search';
import type { BagQualityResult } from './stock-take';

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

export type StockTransferBagDisposition = 'TRANSFER' | 'QUARANTINE' | 'DISPOSE';

export interface StockTransferBagDetail {
  id: number;
  bagId: number;
  bagNo?: number | null;
  qrCode?: string | null;
  sourceLotId?: number | null;
  sourceLotCode?: string | null;
  weightKg: number;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  qualityResult?: string | null;
  qualityNote?: string | null;
  disposition: string;
  quarantineLocationId?: number | null;
  quarantineLocationName?: string | null;
  targetLotId?: number | null;
  targetLotCode?: string | null;
  note?: string | null;
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
  bagIds?: number[];
  bags?: StockTransferBagDetail[];
}

export interface StockTransferDetail extends StockTransferRow {
  items: StockTransferItemDetail[];
  destinationInboundOrderId?: number | null;
  destinationInboundOrderCode?: string | null;
  lastModifiedDate?: string | null;
}

/** Bao ở đỉnh cột nguồn để chọn khi chuyển kho theo BAO. */
export interface SourceColumnBag {
  bagId: number;
  bagNo: number;
  qrCode?: string | null;
  stackOrder: number;
  weightKg: number;
  isFull: boolean;
  lotId?: number | null;
  lotCode?: string | null;
  productVariantId: number;
  productVariantName?: string | null;
  lotQualityStatus?: string | null;
}

export interface StockTransferSummary {
  transfersThisMonth: number;
  inTransitCount: number;
  totalTransferredWeightKg: number;
}

export interface StockTransferBagPayload {
  bagId: number;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  qualityResult: BagQualityResult;
  disposition: StockTransferBagDisposition;
  quarantineLocationId?: number | null;
  qualityNote?: string | null;
  note?: string | null;
}

export interface StockTransferItemPayload {
  productVariantId: number;
  paddyLotId?: number | null;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  weightKg: number;
  note?: string | null;
  bagIds?: number[];
  bags?: StockTransferBagPayload[];
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
