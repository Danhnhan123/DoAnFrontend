export interface SalesOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface SalesOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateSalesOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateSalesOrderStatusDto extends CreateSalesOrderStatusDto {
  id: number;
}
