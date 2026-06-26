import { DTParameters } from './search';

/**
 * Một dòng danh mục sản phẩm hiển thị trên bảng.
 * Trùng cấu trúc với ProductCategoryAggregate / ProductCategoryDetailDto của backend.
 */
export interface ProductCategoryRow {
  id: number;
  name: string;
  description?: string | null;
  /** Id danh mục cha (null nếu là danh mục gốc). */
  parentCategoryId?: number | null;
  /** Tên danh mục cha (chỉ có ở dữ liệu trả về). */
  parentName?: string | null;
  /** Đường dẫn cây (materialized path) các id tổ tiên, vd "/1/5/". */
  treeIds: string;
  sortOrder: number;
  /** Số lượng sản phẩm thuộc danh mục. */
  productCount: number;
  createdDate: string;
}

export interface ProductCategoryDetailDto extends ProductCategoryRow {}

export interface CreateProductCategoryDto {
  name: string;
  description?: string | null;
  parentCategoryId?: number | null;
  treeIds: string;
  sortOrder: number;
}

export interface UpdateProductCategoryDto extends CreateProductCategoryDto {
  id: number;
}

export interface ProductCategoryPagedAdvancedRequest extends DTParameters {}
