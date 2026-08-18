export interface CustomerReturnOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CustomerReturnOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateCustomerReturnOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateCustomerReturnOrderStatusDto extends CreateCustomerReturnOrderStatusDto {
  id: number;
}
