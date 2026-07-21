import { DTParameters } from './search';

/** Dữ liệu một lô lúa/gạo trả về từ PaddyLotAggregate/PaddyLotDetailDto. */
export interface PaddyLotRow {
  id: number;
  organizationId?: number | null;
  lotCode: string;
  lotType: string;
  productVariantId: number;
  sku?: string | null;
  productVariantName?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  statusId: number;
  statusName?: string | null;
  sourceReceiptId?: number | null;
  sourceMillingOrderId?: number | null;
  warehouseId: number;
  warehouseName?: string | null;
  locationId?: number | null;
  inboundDate: string;
  initialWeightKg: number;
  remainingWeightKg: number;
  costPricePerKg: number;
  qualityStatus?: string | null;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface PaddyLotDetailDto extends PaddyLotRow {}

/** Body DataTables của POST /paddy-lots/paged-advanced. */
export interface PaddyLotPagedRequest extends DTParameters {}

export interface PaddyLotStatusOption {
  id: number;
  name: string;
  color: string;
  isSellable: boolean;
}

export interface PaddyLotSummary {
  totalLots: number;
  totalPaddyKg: number;
  totalRiceKg: number;
  attentionLots: number;
}
