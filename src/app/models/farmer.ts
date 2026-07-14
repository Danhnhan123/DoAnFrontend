import { DTParameters } from './search';

/** Một dòng nông dân hiển thị trên bảng. */
export interface FarmerRow {
  id: number;
  organizationId?: number | null;
  code: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  region?: string | null;
  reputationNote?: string | null;
  isActive: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface FarmerDetailDto extends FarmerRow {}

export interface CreateFarmerDto {
  organizationId?: number | null;
  code: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  region?: string | null;
  reputationNote?: string | null;
  isActive: boolean;
}

export interface UpdateFarmerDto extends CreateFarmerDto {
  id: number;
}

export interface FarmerPagedAdvancedRequest extends DTParameters {}
