import { DTParameters } from './search';

/**
 * Một dòng nhà cung cấp hiển thị trên bảng.
 * Trùng cấu trúc với SupplierAggregate / SupplierDetailDto của backend.
 */
export interface SupplierRow {
  id: number;
  name: string;
  code: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxCode?: string | null;
  isActive: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface SupplierDetailDto extends SupplierRow {}

export interface CreateSupplierDto {
  name: string;
  code: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxCode?: string | null;
  isActive: boolean;
}

export interface UpdateSupplierDto extends CreateSupplierDto {
  id: number;
}

export interface SupplierPagedAdvancedRequest extends DTParameters {}
