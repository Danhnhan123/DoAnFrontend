import { DTParameters } from './search';

/** Một dòng doanh nghiệp/tenant hiển thị trên bảng. */
export interface OrganizationRow {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  taxCode?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoFileId?: number | null;
  subscriptionPlan?: string | null;
  subscriptionExpiry?: string | null;
  isActive: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface OrganizationDetailDto extends OrganizationRow {}

export interface CreateOrganizationDto {
  code: string;
  name: string;
  description?: string | null;
  taxCode?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoFileId?: number | null;
  subscriptionPlan?: string | null;
  subscriptionExpiry?: string | null;
  isActive: boolean;
}

export interface UpdateOrganizationDto extends CreateOrganizationDto {
  id: number;
}

export interface OrganizationPagedAdvancedRequest extends DTParameters {}
