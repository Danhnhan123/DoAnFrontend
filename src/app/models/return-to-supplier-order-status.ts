export interface ReturnToSupplierOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface ReturnToSupplierOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateReturnToSupplierOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateReturnToSupplierOrderStatusDto extends CreateReturnToSupplierOrderStatusDto {
  id: number;
}
