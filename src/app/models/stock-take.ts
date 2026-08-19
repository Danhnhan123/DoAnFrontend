import { DTParameters } from './search';

export const STOCK_TAKE_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type StockTakeScopeType = 'WAREHOUSE' | 'ZONE' | 'COLUMN' | 'LOT' | 'SKU';

/** Cách xử lý một bao sau khi kiểm kê. */
export const BAG_DISPOSITION = {
  KEEP: 'KEEP',
  QUARANTINE: 'QUARANTINE',
  DISPOSE: 'DISPOSE',
  RELEASE: 'RELEASE',
} as const;
export type BagDisposition = (typeof BAG_DISPOSITION)[keyof typeof BAG_DISPOSITION];

export type BagQualityResult = 'PASS' | 'ISSUE_DETECTED';

export interface StockTakeItemBag {
  id: number;
  stockTakeItemId: number;
  paddyLotBagId: number;
  bagNo: number;
  qrCode?: string | null;
  lotCode?: string | null;
  systemWeightKg: number;
  systemStackOrder: number;
  /** Thứ tự LẤY RA: 1 = bao trên cùng của cột. */
  pickSequence: number;
  /** Thứ tự CẤT LẠI: bao lấy ra sau cùng được cất vào trước. */
  restowSequence: number;
  counted: boolean;
  scannedByQr: boolean;
  countedWeightKg?: number | null;
  effectiveWeightKg: number;
  isUnexpected: boolean;
  qualityResult?: BagQualityResult | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  qualityNote?: string | null;
  disposition: BagDisposition;
  targetLocationId?: number | null;
  targetLocationCode?: string | null;
  targetZoneName?: string | null;
  dispositionNote?: string | null;
}

export interface StockTakeBagTargetSuggestion {
  locationId: number;
  zoneName: string;
  locationCode?: string | null;
  isQuarantine: boolean;
  maxCapacityKg: number;
  currentOccupancyKg: number;
  availableKg: number;
  score: number;
  reason: string;
  isRecommended: boolean;
}

export interface ScanStockTakeBagResult {
  matched: boolean;
  reason: 'NOT_FOUND' | 'OUT_OF_SCOPE' | 'ALREADY_COUNTED' | 'PULLED_IN' | 'OK';
  message: string;
  stockTakeItemId?: number | null;
  stockTakeItemBagId?: number | null;
  paddyLotBagId?: number | null;
  bagNo?: number | null;
  lotCode?: string | null;
  zoneName?: string | null;
  locationCode?: string | null;
  systemWeightKg?: number | null;
  countedWeightKg?: number | null;
  pickSequence?: number | null;
  restowSequence?: number | null;
  isUnexpected: boolean;
}

export interface StockTakeZoneOption {
  zoneName: string;
  columnCount: number;
  bagCount: number;
  totalWeightKg: number;
  isQuarantine: boolean;
}

export interface StockTakeColumnOption {
  locationId: number;
  zoneName: string;
  locationCode?: string | null;
  qrCode?: string | null;
  bagCount: number;
  totalWeightKg: number;
  isQuarantine: boolean;
}

export interface StockTakeLotOption {
  paddyLotId: number;
  lotCode: string;
  qrCode?: string | null;
  productVariantName?: string | null;
  bagCount: number;
  totalWeightKg: number;
  columnCount: number;
  isQuarantine: boolean;
}

export interface StockTakeScopeOptions {
  zones: StockTakeZoneOption[];
  columns: StockTakeColumnOption[];
  lots: StockTakeLotOption[];
}

export interface StockTakeScopeResolve {
  matched: boolean;
  scopeType?: StockTakeScopeType | null;
  message: string;
  zoneName?: string | null;
  locationId?: number | null;
  locationCode?: string | null;
  paddyLotId?: number | null;
  lotCode?: string | null;
  warehouseId?: number | null;
  isQuarantine: boolean;
  bagCount: number;
  totalWeightKg: number;
}

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
  isOutboundStaging: boolean;
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
  postSnapshotMovements: StockTakeMovementEvidence[];

  /** Số bao sổ sách tại vị trí. */
  systemBagCount: number;
  /** Số bao đếm được (null = chưa kiểm). */
  countedBagCount?: number | null;
  bagDifference: number;
  /** Lý do lệch — bắt buộc khi lệch bao hoặc lệch kg. */
  varianceReason?: string | null;
  adjustedBagCount?: number | null;
  adjustedWeightKg?: number | null;
  quarantineBagCount: number;
  disposedBagCount: number;
  releasedBagCount: number;
  bags: StockTakeItemBag[];
}

export interface StockTakeDetail extends Omit<StockTakeRow, 'itemCount'> {
  lastModifiedDate?: string | null;
  approvedByUserId?: number | null;
  approveNote?: string | null;
  scopeType?: StockTakeScopeType | null;
  scopeZoneName?: string | null;
  scopeLocationId?: number | null;
  scopePaddyLotId?: number | null;
  /** Phiếu kiểm kê khu CÁCH LY — mới được rút bao đạt về khu thường. */
  isQuarantineScope: boolean;
  systemBagCount: number;
  countedBagCount: number;
  netBagVariance: number;
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

export interface SaveStockTakeCountBagPayload {
  id: number;
  paddyLotBagId?: number | null;
  counted: boolean;
  scannedByQr: boolean;
  countedWeightKg?: number | null;
  qualityResult?: BagQualityResult | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  qualityNote?: string | null;
  disposition: BagDisposition;
  targetLocationId?: number | null;
  dispositionNote?: string | null;
}

export interface SaveStockTakeCountsPayload {
  note?: string | null;
  items: Array<{
    id: number;
    /** Chỉ dùng cho dòng tồn kho cũ chưa quản lý theo bao. */
    actualQuantity?: number | null;
    note?: string | null;
    varianceReason?: string | null;
    adjustedBagCount?: number | null;
    adjustedWeightKg?: number | null;
    recountConfirmed: boolean;
    bags: SaveStockTakeCountBagPayload[];
  }>;
}

export interface StockTakePagedRequest extends DTParameters {}
