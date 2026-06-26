import { DTParameters } from './search';

export interface ProductVariantRow {
  id: number;
  name: string;
  description?: string | null;

  productId: number;
  productName?: string | null;

  unitOfMeasureId: number;
  unitOfMeasureName?: string | null;

  sku: string;
  qrCode?: string | null;

  costPrice: number;
  salePrice: number;
  weight: number;

  attributeValues?: string | null;

  imageId?: number | null;
  imageUrl?: string | null;

  isActive: boolean;
  minStockLevel?: number | null;

  createdDate: string;
}

export interface ProductVariantDetailDto extends ProductVariantRow {}

export interface CreateProductVariantDto {
  name: string;
  description?: string | null;

  productId: number;
  unitOfMeasureId: number;

  sku: string;
  qrCode?: string | null;

  costPrice: number;
  salePrice: number;
  weight: number;

  attributeValues?: string | null;
  imageId?: number | null;

  isActive: boolean;
  minStockLevel?: number | null;
}

export interface UpdateProductVariantDto extends CreateProductVariantDto {
  id: number;
}

export interface ProductVariantPagedAdvancedRequest extends DTParameters {
  productId?: number | null;
}

export interface ProductVariantSearchParams {
  pageIndex: number;
  pageSize: number;
  keyword?: string;
  orderBy?: string;
  sortType?: 'asc' | 'desc';
  productId?: number | null;
  isActive?: boolean | null;
}

export interface ProductOption {
  id: number;
  name: string;
}