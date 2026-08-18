import { DTParameters } from './search';

/** Một dòng giống lúa hiển thị trên bảng. */
export interface RiceVarietyRow {
  id: number;
  organizationId?: number | null;
  code: string;
  name: string;
  season?: string | null;
  defaultYieldRate?: number | null;
  note?: string | null;
  isActive: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface RiceVarietyDetailDto extends RiceVarietyRow {}

export interface CreateRiceVarietyDto {
  organizationId?: number | null;
  code: string;
  name: string;
  season?: string | null;
  defaultYieldRate?: number | null;
  note?: string | null;
  isActive: boolean;
}

export interface UpdateRiceVarietyDto extends CreateRiceVarietyDto {
  id: number;
}

export interface RiceVarietyPagedAdvancedRequest extends DTParameters {}
