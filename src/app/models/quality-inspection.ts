import { DTParameters } from './search';

/**
 * Một dòng Phiếu kiểm định chất lượng lô lúa/gạo (SCR-09).
 * Khớp QualityInspectionDetailDto của backend.
 */
export interface QualityInspectionRow {
  id: number;
  paddyLotId: number;
  lotCode?: string | null;
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
}

export interface UpdateQualityInspectionDto extends CreateQualityInspectionDto {
  id: number;
}

/** Body DataTables của POST /quality-inspections/paged-advanced. */
export interface QualityInspectionPagedRequest extends DTParameters {}
