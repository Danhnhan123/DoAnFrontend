export interface StockTransferStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface StockTransferStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateStockTransferStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateStockTransferStatusDto extends CreateStockTransferStatusDto {
  id: number;
}
