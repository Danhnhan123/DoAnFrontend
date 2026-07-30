export interface MillingOrderStatusAdvancedRow {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface MillingOrderStatusDetailDto {
  id: number;
  code?: string;
  name: string;
  color: string;
  createdDate: string;
}

export interface CreateMillingOrderStatusDto {
  code?: string;
  name: string;
  color: string;
}

export interface UpdateMillingOrderStatusDto extends CreateMillingOrderStatusDto {
  id: number;
}
