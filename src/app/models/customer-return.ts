export const CUSTOMER_RETURN_STATUS = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  INSPECTED: "INSPECTED",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
} as const;

export type CustomerReturnStatusCode =
  (typeof CUSTOMER_RETURN_STATUS)[keyof typeof CUSTOMER_RETURN_STATUS];

export interface CustomerReturnPagedQuery {
  keyword?: string | null;
  statusId?: number | null;
  statusCode?: string | null;
  customerId?: number | null;
  warehouseId?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page: number;
  pageSize: number;
}

export interface CustomerReturnPage {
  dataSource: CustomerReturnRow[];
  total: number;
  totalFiltered: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

export interface CustomerReturnRow {
  id: number;
  returnCode: string;
  returnReason?: string | null;
  note?: string | null;
  statusId: number;
  statusCode: string;
  statusName: string;
  outboundOrderId?: number | null;
  outboundOrderCode?: string | null;
  salesOrderCode?: string | null;
  customerId?: number | null;
  customerCode?: string | null;
  customerName?: string | null;
  warehouseId: number;
  warehouseName: string;
  approvedCreditAmount: number;
  debtReductionAmount: number;
  refundPendingAmount: number;
  approvedDate?: string | null;
  approvedByName?: string | null;
  confirmedAt?: string | null;
  confirmedByName?: string | null;
  completedDate?: string | null;
  createdDate: string;
  itemCount: number;
  totalQuantityReturned: number;
  totalQuantityGood: number;
  totalQuantityDamaged: number;
  totalQuantityRejected: number;
  primaryProductVariantName?: string | null;
  primarySKU?: string | null;
  primaryLotCode?: string | null;
}

export interface CustomerReturnDetail extends CustomerReturnRow {
  items: CustomerReturnItemDetail[];
}

export interface CustomerReturnItemDetail {
  id: number;
  productVariantId?: number | null;
  productVariantName?: string | null;
  sku?: string | null;
  quantityReturned: number;
  quantityGood: number;
  quantityDamaged: number;
  qualityStatus: string;
  damageReason?: string | null;
  note?: string | null;
  allocations: CustomerReturnAllocationDetail[];
}

export interface CustomerReturnAllocationDetail {
  id: number;
  outboundOrderItemAllocationId?: number | null;
  paddyLotId: number;
  paddyLotCode: string;
  productVariantId: number;
  sku: string;
  originalLocationId?: number | null;
  originalLocationCode?: string | null;
  quantityReturned: number;
  quantityGood: number;
  quantityDamaged: number;
  quantityRejected: number;
  creditQuantity: number;
  restockLocationId?: number | null;
  restockLocationCode?: string | null;
  quarantineLocationId?: number | null;
  quarantineLocationCode?: string | null;
  unitCreditPrice: number;
  creditAmount: number;
  note?: string | null;
  bags?: CustomerReturnBag[];
}

export interface CustomerReturnBag {
  weightKg: number;
  condition: "GOOD" | "DAMAGED";
}

export interface CreateCustomerReturnPayload {
  warehouseId: number;
  customerId: number;
  outboundOrderId: number;
  customerFeedbackId?: number | null;
  returnReason?: string | null;
  note?: string | null;
  items: CreateCustomerReturnItemPayload[];
}

export interface CreateCustomerReturnItemPayload {
  outboundOrderItemId: number;
  productVariantId: number;
  quantityReturned: number;
  allocations: CreateCustomerReturnAllocationPayload[];
}

export interface CreateCustomerReturnAllocationPayload {
  outboundOrderItemAllocationId: number;
  quantityReturned: number;
}

export interface InspectCustomerReturnPayload {
  id: number;
  items: InspectCustomerReturnItemPayload[];
}

export interface InspectCustomerReturnItemPayload {
  customerReturnOrderItemId: number;
  qualityStatus: "GOOD" | "DAMAGED" | "EXPIRED";
  damageReason?: string | null;
  allocations: InspectCustomerReturnAllocationPayload[];
}

export interface InspectCustomerReturnAllocationPayload {
  returnAllocationId: number;
  quantityGood: number;
  quantityDamaged: number;
  quantityRejected: number;
  creditQuantity: number;
  restockLocationId?: number | null;
  quarantineLocationId?: number | null;
  note?: string | null;
  bags: CustomerReturnBag[];
}

export interface CustomerReturnImpactPreview {
  customerReturnOrderId: number;
  approvedCreditAmount: number;
  currentReceivableBalance: number;
  debtReductionAmount: number;
  refundPendingAmount: number;
  inventoryImpact: CustomerReturnInventoryImpact[];
}

export interface CustomerReturnInventoryImpact {
  paddyLotId: number;
  paddyLotCode: string;
  productVariantId: number;
  sku: string;
  goodQuantityKg: number;
  damagedQuantityKg: number;
  rejectedQuantityKg: number;
  restockLocationId?: number | null;
  quarantineLocationId?: number | null;
}
