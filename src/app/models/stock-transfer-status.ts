export interface StockTransferStatusAdvancedRow {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface StockTransferStatusDetailDto {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateStockTransferStatusDto {
  name: string;
  color: string;
}

export interface UpdateStockTransferStatusDto extends CreateStockTransferStatusDto {
  id: number;
}
