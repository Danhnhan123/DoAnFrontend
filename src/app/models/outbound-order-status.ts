export interface OutboundOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface OutboundOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateOutboundOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateOutboundOrderStatusDto extends CreateOutboundOrderStatusDto {
  id: number;
}
