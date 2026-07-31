export interface PaddyPurchaseScheduleStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface PaddyPurchaseScheduleStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreatePaddyPurchaseScheduleStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdatePaddyPurchaseScheduleStatusDto extends CreatePaddyPurchaseScheduleStatusDto {
  id: number;
}
