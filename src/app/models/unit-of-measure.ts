import { DTParameters } from './search';

/**
 * Một dòng đơn vị tính hiển thị trên bảng.
 * Trùng cấu trúc với UnitOfMeasureAggregate / UnitOfMeasureDetailDto của backend.
 */
export interface UnitOfMeasureRow {
  id: number;
  name: string;
  symbol: string;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface UnitOfMeasureDetailDto extends UnitOfMeasureRow {}

export interface CreateUnitOfMeasureDto {
  name: string;
  symbol: string;
}

export interface UpdateUnitOfMeasureDto extends CreateUnitOfMeasureDto {
  id: number;
}

export interface UnitOfMeasurePagedAdvancedRequest extends DTParameters {}
