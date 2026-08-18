export interface PurchaseOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface PurchaseOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreatePurchaseOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdatePurchaseOrderStatusDto extends CreatePurchaseOrderStatusDto {
  id: number;
}
