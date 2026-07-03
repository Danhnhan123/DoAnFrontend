import { DTParameters } from './search';

/**
 * Một dòng thuộc tính sản phẩm hiển thị trên bảng.
 * Trùng cấu trúc với ProductAttributeDetailDto của backend.
 */
export interface ProductAttributeRow {
  id: number;
  name: string;
  description?: string | null;
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface ProductAttributeDetailDto extends ProductAttributeRow {}

export interface CreateProductAttributeDto {
  name: string;
  description?: string | null;
}

export interface UpdateProductAttributeDto extends CreateProductAttributeDto {
  id: number;
}

export interface ProductAttributePagedAdvancedRequest extends DTParameters {}
