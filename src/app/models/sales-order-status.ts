export interface SalesOrderStatusAdvancedRow {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface SalesOrderStatusDetailDto {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateSalesOrderStatusDto {
  name: string;
  color: string;
}

export interface UpdateSalesOrderStatusDto extends CreateSalesOrderStatusDto {
  id: number;
}
