export interface InboundOrderStatusAdvancedRow {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface InboundOrderStatusDetailDto {
  id: number;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateInboundOrderStatusDto {
  name: string;
  color: string;
}

export interface UpdateInboundOrderStatusDto extends CreateInboundOrderStatusDto {
  id: number;
}
