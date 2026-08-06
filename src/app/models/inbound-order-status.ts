export interface InboundOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface InboundOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateInboundOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateInboundOrderStatusDto extends CreateInboundOrderStatusDto {
  id: number;
}
