import { DTParameters } from "./search";

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
  statusCode?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  scheduleDate: string;
  location?: string | null;
  estimatedQtyKg?: number | null;
  expectedPrice?: number | null;
  assignedUserId?: number | null;
  warehouseId?: number | null;
  warehouseName?: string | null;
  note?: string | null;
  createdDate: string;
  lastModifiedDate?: string | null;

  /** Số phiếu mua lúa chưa xóa thuộc lịch này. */
  receiptCount?: number;
  /** Tổng khối lượng thực tế (kg) của các phiếu mua thuộc lịch này. */
  receiptedWeightKg?: number;
  /** Khối lượng còn lại có thể lập phiếu (null khi lịch không khai báo dự kiến). */
  remainingQtyKg?: number | null;
  /**
   * Backend đã tính sẵn: lịch còn được lập thêm phiếu mua hay không.
   * false khi lịch đã hủy / đã nhập kho, hoặc đã đủ khối lượng dự kiến.
   */
  canCreateReceipt?: boolean;
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
  productVariantId?: number | null;
  productVariantName?: string | null;
  productVariantSku?: string | null;
  warehouseId: number;
  warehouseName?: string | null;
  actualWeightKg: number;
  acceptedWeightKg?: number | null;
  rejectedWeightKg?: number | null;
  bagCount?: number | null;
  bags?: BagInput[];
  agreedPrice: number;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  refundReceivableAmount: number;
  debtDueDate?: string | null;
  qcFinalizedAt?: string | null;
  qcFinalizedBy?: number | null;
  qualityJson?: string | null;
  priceAdjustReason?: string | null;
  receiptDate: string;
  paddyLotId?: number | null;
  isConfirmed: boolean;
  storedWeightKg?: number;
  remainingWeightKg?: number;
  isFullyStored?: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface BagInput {
  bagNo: number;
  weightKg: number;
  scaleDeviceRef?: string | null;
  weightCaptureMethod?: 'SCALE' | 'MANUAL' | null;
  weighedAt?: string | null;
  weighedBy?: number | null;
}

export interface CreatePaddyPurchaseReceiptDto {
  organizationId?: number | null;
  scheduleId?: number | null;
  farmerId: number;
  riceVarietyId?: number | null;
  productVariantId?: number | null;
  warehouseId: number;
  actualWeightKg: number;
  bagCount?: number | null;
  bags?: BagInput[];
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

/** Item dropdown "Sản phẩm" trên phiếu mua lúa (lọc theo giống lúa). */
export interface PaddyVariantOption {
  id: number;
  name: string;
  sku?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  isActive?: boolean;
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
  qualityInspectionId: number;
}

/**
 * Payload khi chốt phiếu mua lúa.
 * Chỉ gửi dueDate khi phiếu phát sinh công nợ phải trả (debtAmount > 0);
 * nếu không phát sinh nợ thì gửi body rỗng {}.
 */
export interface ConfirmPaddyPurchaseReceiptPayload {
  dueDate?: string | null;
}

export type PutawayPlacementMode = 1 | 2;

export interface GetPutawaySuggestionsRequest {
  warehouseId: number;
  productVariantId: number;
  paddyLotId?: number | null;
  requiredWeightKg: number;
  placementMode: PutawayPlacementMode;
  top: number;
}

export interface PutawayScoreDetails {
  capacityFit: number;
  occupancyFit: number;
  categoryMatch: number;
  priorityNorm: number;
  [key: string]: number | string | boolean | null | undefined;
}

export interface PutawaySuggestion {
  rank: number;
  locationId: number;
  locationCode: string;
  zoneName?: string | null;
  currentOccupancyKg: number;
  maxCapacityKg: number;
  freeCapacityKg: number;
  remainingAfterKg: number;
  currentProductVariantId?: number | null;
  isEmpty: boolean;
  score: number;
  scoreDetails?: PutawayScoreDetails | null;
  reason?: string | null;
}

export interface SplitPutawaySuggestion {
  locationId: number;
  weightKg: number;
  locationCode?: string | null;
  zoneName?: string | null;
  freeCapacityKg?: number | null;
}

export interface PutawaySuggestionsResponse {
  hasSuggestion: boolean;
  warehouseId: number;
  productVariantId: number;
  requiredWeightKg: number;
  suggestions: PutawaySuggestion[];
  message?: string | null;
  canSplit?: boolean;
  totalFreeCapacityKg?: number | null;
  splitSuggestions?: SplitPutawaySuggestion[] | null;
}

export interface ConfirmStoreInRequest {
  productVariantId: number;
  paddyLotId: number;
  selectedLocationId: number;
  suggestedLocationId?: number | null;
  weightKg: number;
  bagCount?: number | null;
  overrideReason?: string | null;
}

export interface ConfirmPaddyStoreInResult {
  receiptId: number;
  lotId: number;
  storedWeightKg: number;
  remainingWeightKg: number;
  isFullyStored: boolean;
}

export interface PaddyPurchasePagedRequest extends DTParameters {}

export type PaddyScheduleStatusCode =
  | "NEW"
  | "CONFIRMED"
  | "COLLECTING"
  | "WEIGHED"
  | "PARTIALLY_STOCKED"
  | "STOCKED"
  | "CANCELLED";

export interface PaddyScheduleStatusOption {
  id: number;
  code: PaddyScheduleStatusCode;
  name: string;
  color: string;
}
