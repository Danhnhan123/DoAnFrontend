import { DTParameters } from './search';

export interface ProductVariantRow {
  id: number;
  name: string;
  description?: string | null;

  productId: number;
  productName?: string | null;
  productCategoryId?: number | null;
  productCategoryName?: string | null;

  unitOfMeasureId: number;
  unitOfMeasureName?: string | null;

  sku: string;
  qrCode?: string | null;

  costPrice: number;
  salePrice: number;
  /** Khối lượng của một bao chuẩn, tính theo kg. */
  weight: number;

  attributeValues?: string | null;

  riceVarietyId?: number | null;
  isByproduct?: boolean;

  imageId?: number | null;
  imageUrl?: string | null;

  isActive: boolean;
  minStockLevel?: number | null;

  createdDate: string;
}

/** Một cặp thuộc tính đã parse mà backend trả về trong detail (attributeValuesJson). */
export interface AttributeValueEntry {
  attributeId: number;
  attributeName?: string | null;
  value: string;
}

/**
 * Chi tiết biến thể — khớp đúng ProductVariantDetailDto của backend.
 * Lưu ý: detail KHÔNG trả về chuỗi attributeValues, mà trả về:
 *  - attributeValuesJson: danh sách đã parse (khi AttributeValues là JSON hợp lệ)
 *  - legacyAttributeValues: chuỗi thô (khi là dữ liệu cũ dạng text)
 */
export interface ProductVariantDetailDto {
  id: number;
  name: string;
  description?: string | null;

  productId: number;
  productName?: string | null;
  productIsActive?: boolean;
  productCategoryId?: number | null;
  productCategoryName?: string | null;

  unitOfMeasureId: number;
  unitOfMeasureName?: string | null;

  sku: string;
  qrCode?: string | null;

  costPrice: number;
  salePrice: number;
  /** Khối lượng của một bao chuẩn, tính theo kg. */
  weight: number;

  imageId?: number | null;
  imageUrl?: string | null;

  isActive: boolean;
  isDeleted?: boolean;
  minStockLevel?: number | null;

  riceVarietyId?: number | null;
  isByproduct?: boolean;

  attributeValuesJson?: AttributeValueEntry[] | null;
  legacyAttributeValues?: string | null;

  effectiveActiveStatus?: boolean;

  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface CreateProductVariantDto {
  name: string;
  description?: string | null;

  productId: number;
  unitOfMeasureId: number;

  sku: string;
  qrCode?: string | null;

  costPrice: number;
  salePrice: number;
  /** Khối lượng của một bao chuẩn, tính theo kg; 0 nghĩa là không áp dụng/chưa cấu hình. */
  weight: number;

  /** Chuỗi JSON dạng [{ "attributeId": number, "value": string }]. */
  attributeValues?: string | null;

  riceVarietyId?: number | null;
  isByproduct: boolean;

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

/** Option chung dùng cho dropdown đơn vị tính / giống lúa / thuộc tính. */
export interface LookupOption {
  id: number;
  name: string;
}
