export interface LotStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  isSellable?: boolean;
  createdDate: string;
}

export interface LotStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  isSellable?: boolean;
  createdDate: string;
}

export interface CreateLotStatusDto {
  code?: string;
  name: string;
  color: string;
  isSellable?: boolean;
}

export interface UpdateLotStatusDto extends CreateLotStatusDto {
  id: number;
}
