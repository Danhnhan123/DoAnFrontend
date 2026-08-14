import { DTParameters } from './search';

export const STOCK_TAKE_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type StockTakeScopeType = 'WAREHOUSE' | 'ZONE' | 'COLUMN' | 'LOT' | 'SKU';

export interface StockTakeRow {
  id: number;
  stCode: string;
  warehouseId: number;
  warehouseName: string;
  stockTakeStatusId: number;
  stockTakeStatusCode: string;
  stockTakeStatusName: string;
  stockTakeStatusColor?: string | null;
  note?: string | null;
  startedDate?: string | null;
  completedDate?: string | null;
  createdDate: string;
  createdByUserId?: number | null;
  createdByName?: string | null;
  scopeDisplay: string;
  itemCount: number;
  varianceLineCount: number;
  netVarianceKg: number;
}

export interface StockTakeMovementEvidence {
  id: number;
  transactionType: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  note?: string | null;
  createdDate: string;
  createdBy?: number | null;
}

/** Tình trạng chất lượng ghi nhận khi kiểm kê. */
export const STOCK_TAKE_QUALITY = {
  OK: 'OK',
  WET: 'WET',
  PEST: 'PEST',
  TORN_BAG: 'TORN_BAG',
  OTHER: 'OTHER',
} as const;

export type StockTakeQualityStatus =
  (typeof STOCK_TAKE_QUALITY)[keyof typeof STOCK_TAKE_QUALITY];

export const STOCK_TAKE_QUALITY_LABEL: Record<string, string> = {
  OK: 'Đạt',
  WET: 'Ẩm/mốc',
  PEST: 'Mọt, côn trùng',
  TORN_BAG: 'Rách bao, đổ vãi',
  OTHER: 'Khác',
};

/** Một bao trong dòng kiểm kê. */
export interface StockTakeItemBag {
  id: number;
  stockTakeItemId: number;
  paddyLotBagId: number;
  bagNo: number;
  qrCode?: string | null;
  systemWeightKg: number;
  /** null = không cân bao này, giữ nguyên kg sổ sách. */
  countedWeightKg?: number | null;
  counted: boolean;
  scannedByQr: boolean;
  isUnexpected: boolean;
  isMissing: boolean;
  weightDifference: number;
  qualityStatus: string;
  note?: string | null;
  countedAt?: string | null;
  countedByUserId?: number | null;
}

export interface StockTakeItem {
  id: number;
  stockTakeId: number;
  productVariantId?: number | null;
  locationId?: number | null;
  paddyLotId?: number | null;
  sku?: string | null;
  productVariantName?: string | null;
  unitWeightKg: number;
  locationCode?: string | null;
  zoneName?: string | null;
  lotCode?: string | null;
  isQuarantine: boolean;
  systemQuantity: number;
  actualQuantity?: number | null;
  difference: number;
  absoluteVarianceKg?: number | null;
  variancePercent?: number | null;
  varianceSeverity: string;
  note?: string | null;
  qrScanned: boolean;
  recountConfirmed: boolean;
  recountConfirmedBy?: number | null;
  recountConfirmedAt?: string | null;

  /** Số bao sổ sách tại (lô, vị trí) lúc chụp phiếu. */
  systemBagCount: number;
  /** Số bao đếm được. null = chưa kiểm đếm. */
  countedBagCount?: number | null;
  /** Lệch số bao (âm = thiếu bao). */
  bagDifference?: number | null;
  /** Số bao đã cân lại. */
  weighedBagCount: number;
  qualityStatus: string;
  qualityNote?: string | null;
  qualityImageUrls?: string | null;
  isQualityFailed: boolean;
  bags: StockTakeItemBag[];

  postSnapshotMovements: StockTakeMovementEvidence[];
}

export interface StockTakeDetail extends Omit<StockTakeRow, 'itemCount'> {
  lastModifiedDate?: string | null;
  approvedByUserId?: number | null;
  approveNote?: string | null;
  stockTakeItems: StockTakeItem[];
}

export interface StockTakeSummary {
  draftCount: number;
  submittedCount: number;
  varianceLineCount: number;
  netAdjustmentKg: number;
}

export interface StockTakeThresholds {
  smallVariancePercent: number;
  mediumVariancePercent: number;
  smallVarianceKg: number;
  mediumVarianceKg: number;
}

export interface CreateStockTakePayload {
  warehouseId: number;
  stockTakeStatusId: number;
  note?: string | null;
  scopeType: StockTakeScopeType;
  zoneName?: string | null;
  locationId?: number | null;
  paddyLotId?: number | null;
  productVariantId?: number | null;
  stockTakeItems: [];
}

/** Kết quả kiểm đếm của một bao gửi lên backend. */
export interface SaveStockTakeBagPayload {
  id: number;
  paddyLotBagId?: number | null;
  qrCode?: string | null;
  counted: boolean;
  scannedByQr: boolean;
  countedWeightKg?: number | null;
  qualityStatus?: string | null;
  note?: string | null;
}

export interface SaveStockTakeCountsPayload {
  note?: string | null;
  items: Array<{
    id: number;
    actualQuantity?: number | null;
    note?: string | null;
    qrScanned: boolean;
    recountConfirmed: boolean;
    qualityStatus?: string | null;
    qualityNote?: string | null;
    qualityImageUrls?: string | null;
    /** null = không kiểm theo bao (giữ nguyên dữ liệu bao của dòng). */
    bags?: SaveStockTakeBagPayload[] | null;
  }>;
}

// Quét QR tem bao là việc làm ngoài kho nên chỉ có ở app mobile
// (`/stocktakes/{id}/scan-bag`); màn web chỉ tích/cân lại theo danh sách bao.

export interface StockTakePagedRequest extends DTParameters {}
