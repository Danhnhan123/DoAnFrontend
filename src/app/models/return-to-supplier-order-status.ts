export interface ReturnToSupplierOrderStatusAdvancedRow {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface ReturnToSupplierOrderStatusDetailDto {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateReturnToSupplierOrderStatusDto {
  name: string;
  color: string;
}

export interface UpdateReturnToSupplierOrderStatusDto extends CreateReturnToSupplierOrderStatusDto {
  id: number;
}
