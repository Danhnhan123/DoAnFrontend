import { DTParameters } from './search';

export interface ProductVariantRow {
  id: number;
  name: string;
  description?: string;

  productId: number;
  productName?: string;

  unitOfMeasureId: number;
  unitOfMeasureName?: string;

  sku: string;
  barcode?: string;
  qrCode?: string;

  costPrice: number;
  salePrice: number;
  weight: number;

  attributeValues?: string;

  imageId?: number | null;
  imageUrl?: string | null;

  isActive: boolean;
  minStockLevel?: number | null;

  createdDate: string;
}

export interface ProductVariantDetailDto extends ProductVariantRow {}

export interface CreateProductVariantDto {
  name: string;
  description?: string;

  productId: number;
  unitOfMeasureId: number;

  sku: string;
  barcode?: string;
  qrCode?: string;

  costPrice: number;
  salePrice: number;
  weight: number;

  attributeValues?: string;
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

export interface ProductOption {
  id: number;
  name: string;
}