import { DTParameters } from './search';

export interface ProductAdvancedRow {
  id: number;
  name: string;
  description?: string;
  productCategoryId: number;
  productCategoryName?: string;
  isActive: boolean;
  createdDate: string;
}

export interface ProductDetailDto extends ProductAdvancedRow {}

export interface ProductCategoryOption {
  id: number;
  name: string;
  description?: string;
  createdDate?: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  productCategoryId: number;
  isActive: boolean;
}

export interface UpdateProductDto extends CreateProductDto {
  id: number;
}

export interface ProductPagedAdvancedRequest extends DTParameters {
  additionalValues: string[];
  categoryIds: number[];
}