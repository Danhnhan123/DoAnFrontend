import { DTParameters } from './search';

/**
 * Một dòng lịch thu mua trả về từ PaddyPurchaseScheduleAggregate / DetailDto.
 * Đơn vị lưu trong backend là kilogram, giao diện có thể quy đổi sang tấn.
 */
export interface PaddyPurchaseScheduleRow {
  id: number;
  organizationId?: number | null;
  scheduleCode: string;
  farmerId: number;
  farmerName?: string | null;
  statusId: number;
  statusName?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  scheduleDate: string;
  location?: string | null;
  estimatedQtyKg?: number | null;
  expectedPrice?: number | null;
  assignedUserId?: number | null;
  note?: string | null;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface CreatePaddyPurchaseScheduleDto {
  organizationId?: number | null;
  farmerId: number;
  statusId: number;
  riceVarietyId?: number | null;
  scheduleDate: string;
  location?: string | null;
  estimatedQtyKg?: number | null;
  expectedPrice?: number | null;
  assignedUserId?: number | null;
  note?: string | null;
}

export interface UpdatePaddyPurchaseScheduleDto
  extends CreatePaddyPurchaseScheduleDto {
  id: number;
}

/**
 * Một dòng phiếu mua lúa trả về từ PaddyPurchaseReceiptAggregate / DetailDto.
 */
export interface PaddyPurchaseReceiptRow {
  id: number;
  organizationId?: number | null;
  receiptCode: string;
  scheduleId?: number | null;
  scheduleCode?: string | null;
  farmerId: number;
  farmerName?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  warehouseId: number;
  warehouseName?: string | null;
  actualWeightKg: number;
  bagCount?: number | null;
  agreedPrice: number;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  qualityJson?: string | null;
  priceAdjustReason?: string | null;
  receiptDate: string;
  paddyLotId?: number | null;
  isConfirmed: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface CreatePaddyPurchaseReceiptDto {
  organizationId?: number | null;
  scheduleId?: number | null;
  farmerId: number;
  riceVarietyId?: number | null;
  warehouseId: number;
  actualWeightKg: number;
  bagCount?: number | null;
  agreedPrice: number;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  qualityJson?: string | null;
  priceAdjustReason?: string | null;
  receiptDate: string;
}

export interface UpdatePaddyPurchaseReceiptDto
  extends CreatePaddyPurchaseReceiptDto {
  id: number;
}

/** JSON chất lượng được lưu trong PaddyPurchaseReceipt.QualityJson. */
export interface PaddyQualitySnapshot {
  moisturePercent?: number | null;
  grade?: string | null;
  note?: string | null;
}

export interface ConfirmPaddyPurchaseReceiptResult {
  lotId: number;
  lotCode: string;
  inboundOrderId: number;
}

export interface PaddyPurchasePagedRequest extends DTParameters {}

export type PaddyScheduleStatusCode =
  | 'NEW'
  | 'CONFIRMED'
  | 'COLLECTING'
  | 'WEIGHED'
  | 'STOCKED'
  | 'CANCELLED';

export interface PaddyScheduleStatusOption {
  id: number;
  code: PaddyScheduleStatusCode;
  name: string;
  color: string;
}
