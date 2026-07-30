export interface PurchaseOrderStatusAdvancedRow {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface PurchaseOrderStatusDetailDto {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreatePurchaseOrderStatusDto {
  name: string;
  color: string;
}

export interface UpdatePurchaseOrderStatusDto extends CreatePurchaseOrderStatusDto {
  id: number;
}
