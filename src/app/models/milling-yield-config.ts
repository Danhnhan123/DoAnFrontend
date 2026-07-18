import { DTParameters } from './search';

/** Một dòng cấu hình tỷ lệ xay (yield) hiển thị trên bảng. */
export interface MillingYieldConfigRow {
  id: number;
  organizationId?: number | null;
  riceVarietyId?: number | null;
  riceVarietyCode?: string | null;
  riceVarietyName?: string | null;
  moistureFrom?: number | null;
  moistureTo?: number | null;
  yieldRate: number;
  brokenRiceRate?: number | null;
  branRate?: number | null;
  huskRate?: number | null;
  effectiveFrom?: string | null;
  isActive: boolean;
  createdDate: string;
}

export interface MillingYieldConfigDetailDto extends MillingYieldConfigRow {
  lastModifiedDate?: string | null;
}

export interface CreateMillingYieldConfigDto {
  organizationId?: number | null;
  riceVarietyId?: number | null;
  moistureFrom?: number | null;
  moistureTo?: number | null;
  yieldRate: number;
  brokenRiceRate?: number | null;
  branRate?: number | null;
  huskRate?: number | null;
  effectiveFrom?: string | null;
  isActive: boolean;
}

export interface UpdateMillingYieldConfigDto extends CreateMillingYieldConfigDto {
  id: number;
}

export interface MillingYieldConfigPagedAdvancedRequest extends DTParameters {}

/** Option giống lúa cho dropdown. */
export interface RiceVarietyOption {
  id: number;
  code: string;
  name: string;
}
