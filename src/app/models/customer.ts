import { DTParameters } from './search';

/** Một dòng khách hàng hiển thị trên bảng (trùng SupplierAggregate/DetailDto BE). */
export interface CustomerRow {
  id: number;
  organizationId?: number | null;
  code: string;
  name: string;
  customerType?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxCode?: string | null;
  isActive: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface CustomerDetailDto extends CustomerRow {}

export interface CreateCustomerDto {
  organizationId?: number | null;
  code: string;
  name: string;
  customerType?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxCode?: string | null;
  isActive: boolean;
}

export interface UpdateCustomerDto extends CreateCustomerDto {
  id: number;
}

export interface CustomerPagedAdvancedRequest extends DTParameters {}
