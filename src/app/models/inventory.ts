import { DTParameters } from './search';

/**
 * Một dòng tồn kho theo lô/cột/khu (màn Giám sát tồn kho).
 * Nguồn: InventoryAggregate (join Inventory + PaddyLot + ProductVariant + Category).
 */
export interface InventoryRow {
  id: number;
  warehouseId: number;
  warehouseName: string;
  locationId?: number | null;
  locationCode?: string | null;

  productVariantId: number;
  sku: string;
  productVariantName: string;
  productId: number;
  productName: string;
  productCategoryId?: number | null;
  categoryName?: string | null;
  isByproduct: boolean;
  unitName?: string | null;
  unitWeightKg: number;

  costPrice: number;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityQuarantine: number;
  quantityProcessing: number;
  totalWeightKg: number;
  bags: number;
  hasPhysicalBagData?: boolean;
  openBags?: number;

  minStockLevel?: number | null;
  isLowStock: boolean;

  // Thông tin lô lúa/gạo
  paddyLotId?: number | null;
  lotCode?: string | null;
  lotType?: string | null;
  lotInboundDate?: string | null;
  lotQualityStatus?: string | null;
  lotCostPricePerKg?: number | null;
  lotStatusId?: number | null;
  lotStatusName?: string | null;
  lotStatusCode?: string | null;
  lotStatusColor?: string | null;
  lotIsSellable?: boolean | null;

  lastStockTakeDate?: string | null;
  createdDate?: string | null;
}

/** Tổng hợp KPI 5 thẻ: Tồn thực tế / Khả dụng / Đã giữ / Đang xử lý / Cách ly. */
export interface InventoryStockSummary {
  totalOnHand: number;
  totalAvailable: number;
  totalReserved: number;
  totalProcessing: number;
  totalQuarantine: number;

  totalOnHandWeightKg: number;
  totalAvailableWeightKg: number;
  totalReservedWeightKg: number;
  totalProcessingWeightKg: number;
  totalQuarantineWeightKg: number;

  lineCount: number;
  quarantineLotCount: number;
  lowStockCount: number;
}

/** Body DataTables cho POST /inventories/advanced. */
export interface InventoryAdvancedRequest extends DTParameters {
  warehouseId?: number | null;
  locationId?: number | null;
  productVariantId?: number | null;
  productCategoryId?: number | null;
  lotType?: string | null;
  lotStatusId?: number | null;
  withLotOnly?: boolean | null;
  lowStockOnly?: boolean | null;
  /** true = chỉ hàng đang cách ly; false = chỉ hàng KHÔNG cách ly. */
  isQuarantined?: boolean | null;
}

/**
 * Bộ lọc cho POST /inventories/summary — cùng bộ trường với
 * [InventoryAdvancedRequest] để 5 thẻ KPI và bảng luôn nói một chuyện.
 */
export interface InventorySummaryRequest {
  search?: string | null;
  warehouseId?: number | null;
  locationId?: number | null;
  productVariantId?: number | null;
  productCategoryId?: number | null;
  lotType?: string | null;
  lotStatusId?: number | null;
  withLotOnly?: boolean | null;
  lowStockOnly?: boolean | null;
  isQuarantined?: boolean | null;
}

/** Một dòng lịch sử InventoryTransaction. */
export interface InventoryTransactionRow {
  id: number;
  inventoryId: number;
  warehouseId: number;
  warehouseName: string;
  locationId?: number | null;
  locationCode?: string | null;
  productVariantId?: number | null;
  sku?: string | null;
  productVariantName?: string | null;
  productName?: string | null;
  transactionType: string;
  referenceType?: string | null;
  referenceId?: number | null;
  referenceItemId?: number | null;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  weightKg?: number | null;
  note?: string | null;
  createdDate: string;
  createdBy?: number | null;
}

/** Body DataTables cho POST /inventory-transactions/advanced. */
export interface InventoryTransactionAdvancedRequest extends DTParameters {
  warehouseId?: number | null;
  locationId?: number | null;
  productVariantId?: number | null;
  transactionType?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
}

/** Tuỳ chọn cho các tab lọc theo loại (Lúa/Gạo/Tấm/Cám/Trấu). */
export interface InventoryCategoryTab {
  id: number | null;
  name: string;
}
