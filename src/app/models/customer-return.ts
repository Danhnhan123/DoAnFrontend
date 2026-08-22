export const CUSTOMER_RETURN_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  RECEIVED: "RECEIVED",
  INSPECTED: "INSPECTED",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
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
  salesOrderId?: number | null;
  salesOrderCode?: string | null;
  customerFeedbackId?: number | null;
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
  feedback?: CustomerReturnFeedbackSummary | null;
  items: CustomerReturnItemDetail[];
}

export interface CustomerReturnFeedbackSummary {
  id: number;
  feedbackType: string;
  severity?: string | null;
  description: string;
  resolutionStatus: string;
  resolutionNote?: string | null;
  createdDate?: string | null;
}

export interface CustomerReturnItemDetail {
  id: number;
  productVariantId?: number | null;
  productVariantName?: string | null;
  sku?: string | null;
  standardBagWeightKg: number;
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
  quantityReceived: number;
  quantityGood: number;
  quantityDamaged: number;
  quantityRejected: number;
  creditQuantity: number;
  restockLocationId?: number | null;
  restockLocationCode?: string | null;
  quarantineLocationId?: number | null;
  quarantineLocationCode?: string | null;
  disposition: "PENDING_INSPECTION" | "RESTOCK" | "QUARANTINE" | "RETURN_TO_CUSTOMER" | "MIXED";
  rejectedLocationId?: number | null;
  rejectionReason?: string | null;
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
  outboundOrderId: number | null;
  customerFeedbackId?: number | null;
  returnReason?: string | null;
  note?: string | null;
  items: CreateCustomerReturnItemPayload[];
}

export interface CreateCustomerReturnItemPayload {
  outboundOrderItemId: number | null;
  productVariantId: number;
  quantityReturned: number;
  allocations: CreateCustomerReturnAllocationPayload[];
}

export interface CreateCustomerReturnAllocationPayload {
  outboundOrderItemAllocationId: number | null;
  paddyLotId?: number | null;
  originalLocationId?: number | null;
  quantityReturned: number;
}

export interface InspectCustomerReturnPayload {
  id: number;
  items: InspectCustomerReturnItemPayload[];
}

export interface InspectCustomerReturnItemPayload {
  customerReturnOrderItemId: number;
  qualityStatus: "GOOD" | "DAMAGED" | "EXPIRED" | "MIXED";
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
  rejectedLocationId?: number | null;
  rejectionReason?: string | null;
  note?: string | null;
  bags: CustomerReturnBag[];
}

export interface CustomerReturnSourceQuery {
  keyword?: string | null;
  page: number;
  pageSize: number;
}

export interface CustomerReturnSourceOrder {
  outboundOrderId: number;
  outboundOrderCode: string;
  salesOrderId: number;
  salesOrderCode: string;
  customerId: number;
  customerCode: string;
  customerName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  deliveredAt?: string | null;
  returnableQuantity: number;
}

export interface CustomerReturnSourceDetail extends CustomerReturnSourceOrder {
  items: CustomerReturnSourceItem[];
}

export interface CustomerReturnSourceItem {
  outboundOrderItemId: number;
  productVariantId: number;
  productVariantName: string;
  sku: string;
  quantityDelivered: number;
  quantityReturnable: number;
  allocations: CustomerReturnSourceAllocation[];
}

export interface CustomerReturnSourceAllocation {
  outboundOrderItemAllocationId: number;
  paddyLotId: number;
  paddyLotCode: string;
  originalLocationId: number;
  originalLocationCode: string;
  quantityDelivered: number;
  quantityAlreadyReturned: number;
  quantityReturnable: number;
}

export interface UpdateCustomerReturnPayload {
  id: number;
  returnReason: string;
  note?: string | null;
  items: CreateCustomerReturnItemPayload[];
}

export interface ReceiveCustomerReturnPayload {
  id: number;
  carrierReference?: string | null;
  note?: string | null;
  allocations: Array<{
    returnAllocationId: number;
    quantityReceived: number;
    note?: string | null;
  }>;
}

export interface RegisterCustomerReturnRefundPayload {
  amount: number;
  paymentReference: string;
  note?: string | null;
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
