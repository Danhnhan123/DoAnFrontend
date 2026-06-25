export interface InboundOrderListDto {
  id: number;
  poCode: string;
  warehouseId: number;
  warehouseName: string;
  supplierId?: number | null;
  supplierName?: string | null;
  inboundOrderStatusId: number;
  inboundOrderStatusName: string;
  totalAssetValue: number;
  expectedDate?: string | null;
  completedDate?: string | null;
  note?: string | null;
  createdDate: string;
}

export interface InboundOrderItemDto {
  id: number;
  inboundOrderId: number;
  productVariantId?: number | null;
  productVariantName?: string | null;
  sku?: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCostPrice: number;
  expectedWeightKg?: number | null;
  actualWeightKg?: number | null;
  qrScanned: boolean;
  note?: string | null;
  receiptStatus: string;
  overReceiveReason?: string | null;
  weightDiscrepancyReason?: string | null;
  exceptionDecision?: string | null;
  exceptionReason?: string | null;
  confirmedLocationId?: number | null;
  confirmedLocationCode?: string | null;
  putawayOverrideReason?: string | null;
  iotWeightLogId?: number | null;
  quantityEntered?: number | null;
}

export interface InboundOrderDetailDto extends InboundOrderListDto {
  items: InboundOrderItemDto[];
}

export interface InboundOrderPagingData {
  currentPage: number;
  pageSize: number;
  dataSource: InboundOrderListDto[];
  total: number;
  totalFiltered: number;
}

export interface InboundOrderListQuery {
  pageIndex: number;
  pageSize: number;
  keyword: string;
  sortType?: 'asc' | 'desc';
  orderBy?: string;
}

export interface CreateInboundOrderItemDto {
  productVariantId: number;
  quantityOrdered: number;
  unitCostPrice: number;
  note?: string | null;
}

export interface CreateInboundOrderDto {
  warehouseId: number;
  supplierId?: number | null;
  expectedDate?: string | null;
  note?: string | null;
  items: CreateInboundOrderItemDto[];
}

export interface WarehouseOption {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ProductVariantOption {
  id: number;
  name: string;
  sku: string;
  costPrice: number;
  isActive: boolean;
}