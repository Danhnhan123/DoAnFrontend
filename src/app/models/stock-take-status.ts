export interface StockTakeStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface StockTakeStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateStockTakeStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateStockTakeStatusDto extends CreateStockTakeStatusDto {
  id: number;
}
