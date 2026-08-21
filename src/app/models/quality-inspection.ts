import { DTParameters } from './search';

/**
 * Một dòng Phiếu kiểm định chất lượng lô lúa/gạo.
 * Khớp QualityInspectionDetailDto của backend.
 */
export interface QualityInspectionRow {
  id: number;
  paddyLotId: number;
  lotCode?: string | null;
  /** Code trạng thái lô. 'AWAITING_QC' = phiếu kiểm định nháp (chờ nhập kết quả). */
  lotStatusCode?: string | null;
  /** NULL for legacy rows; the UI must not guess an inspection type. */
  inspectionType?: QualityInspectionType | null;
  completedAt?: string | null;
  completedBy?: number | null;
  inspectorId?: number | null;
  inspectorName?: string | null;
  inspectedAt: string;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  passedInspection: boolean;
  handling?: string | null;
  note?: string | null;
  /** Kg bị ảnh hưởng — khi Không đạt sẽ tách phần này sang lô cách ly. */
  affectedWeightKg?: number | null;
  createdDate: string;
  lastModifiedDate?: string | null;
  displayRole?: 'splitPassed' | 'splitQuarantine';
  sourceInspectionId?: number;
  /** Khối lượng của phần được trình bày sau khi tách (đạt hoặc cách ly). */
  displayWeightKg?: number | null;
  /** Tổng khối lượng lịch sử của lô ngay trước khi tách. */
  displayTotalWeightKg?: number | null;
}

export interface QualityInspectionDetailDto extends QualityInspectionRow {}

export interface CreateQualityInspectionDto {
  paddyLotId: number;
  inspectorId?: number | null;
  inspectedAt: string;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  passedInspection: boolean;
  handling?: string | null;
  note?: string | null;
  /** Kg bị ảnh hưởng (tách một phần sang cách ly). Bỏ trống = cách ly toàn bộ lô. */
  affectedWeightKg?: number | null;
  affectedBagIds?: number[];
}

export interface UpdateQualityInspectionDto extends CreateQualityInspectionDto {
  id: number;
}

/** Body DataTables của POST /quality-inspections/paged-advanced. */
export interface QualityInspectionPagedRequest extends DTParameters {}

export type QualityInspectionType =
  | 'RECEIVING'
  | 'STORAGE'
  | 'RECHECK'
  | 'OUTBOUND_EXCEPTION';

export type BagQualityResult = 'PASS' | 'ISSUE_DETECTED';

export type QualityInspectionBagDisposition =
  | 'ACCEPT_NORMAL'
  | 'ACCEPT_QUARANTINE'
  | 'REJECT_RETURN'
  | 'KEEP_STORED'
  | 'QUARANTINE'
  | 'RELEASE'
  | 'KEEP_QUARANTINE';

export type BagDisposition = QualityInspectionBagDisposition;

/** Kết quả QC hiện tại của một bao trong inspection session. */
export interface QualityInspectionBagResultDto {
  bagId: number;
  bagNo: number;
  weightKg: number;
  status: string;
  locationId?: number | null;
  locationCode?: string | null;
  qualityResult?: BagQualityResult | null;
  disposition?: BagDisposition | null;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  handling?: string | null;
  note?: string | null;
  inspectedAt?: string | null;
  inspectorName?: string | null;
}

/** Tiến độ kiểm tra cấp bao của một QualityInspection session. */
export interface QualityInspectionBagProgressDto {
  inspectionId: number;
  inspectionType?: QualityInspectionType | null;
  lotId: number;
  lotCode?: string | null;
  isCompleted: boolean;
  totalBags: number;
  inspectedBags: number;
  remainingBags: number;
  normalBags: number;
  quarantineBags: number;
  rejectedBags: number;
  releasedBags: number;
  items: QualityInspectionBagResultDto[];
}

export interface SaveBagInspectionResultDto {
  bagId: number;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  qualityResult: BagQualityResult;
  disposition: BagDisposition;
  handling?: string | null;
  note?: string | null;
}

export interface CompleteInspectionDto {
  note?: string | null;
}

export interface MoistureConfigDto {
  receivingMoistureMinPercent?: number | null;
  receivingMoistureMaxPercent?: number | null;
  storageQcMoistureWarningPercent?: number | null;
  sourceNote: string;
}
