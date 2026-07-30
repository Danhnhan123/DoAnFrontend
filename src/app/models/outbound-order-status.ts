export interface OutboundOrderStatusAdvancedRow {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface OutboundOrderStatusDetailDto {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateOutboundOrderStatusDto {
  name: string;
  color: string;
}

export interface UpdateOutboundOrderStatusDto extends CreateOutboundOrderStatusDto {
  id: number;
}
