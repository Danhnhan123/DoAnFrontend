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

export interface SaveStockTakeCountsPayload {
  note?: string | null;
  items: Array<{
    id: number;
    actualQuantity?: number | null;
    note?: string | null;
    qrScanned: boolean;
    recountConfirmed: boolean;
  }>;
}

export interface StockTakePagedRequest extends DTParameters {}
