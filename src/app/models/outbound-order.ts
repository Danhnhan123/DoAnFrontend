/**
 * Phiếu xuất kho / giao hàng (OutboundOrder).
 * Vòng đời: DRAFT → PICKING → PACKED → DISPATCHED → COMPLETED
 *           (DELIVERY_FAILED / CANCELLED là nhánh kết thúc thay thế)
 * Khớp OutboundOrderStatusSeed phía backend.
 */
export const OUTBOUND_STATUS = {
  DRAFT: 1,
  PICKING: 2,
  PACKED: 3,
  DISPATCHED: 4,
  COMPLETED: 5,
  CANCELLED: 6,
  DELIVERY_FAILED: 7,
} as const;

export type OutboundStatusId =
  (typeof OUTBOUND_STATUS)[keyof typeof OUTBOUND_STATUS];

export interface OutboundOrderPagedRequest {
  keyword?: string | null;
  page: number;
  pageSize: number;
}

export interface OutboundOrderPage {
  total: number;
  items: OutboundOrderRow[];
}

/** Một dòng trong danh sách phiếu xuất (OutboundOrderListDto). */
export interface OutboundOrderRow {
  id: number;
  salesOrderId: number;
  soCode: string;
  customerName: string;
  outboundStatusId: number;
  outboundStatusName: string;
  outboundStatusCode: string;
  outboundStatusColor: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  totalDispatchedValue: number;
  totalDispatchedSaleValue: number;
  completedDate?: string | null;
  note?: string | null;
  createdDate?: string | null;
}

/** Chi tiết phiếu xuất (OutboundOrderDetailDto). */
export interface OutboundOrderDetail {
  id: number;
  salesOrderId: number;
  soCode: string;
  customerId: number;
  customerName: string;
  outboundStatusId: number;
  outboundStatusName: string;
  outboundStatusCode: string;
  outboundStatusColor: string;
  warehouseId: number;
  warehouseName: string;
  totalDispatchedValue: number;
  totalDispatchedSaleValue: number;
  completedDate?: string | null;
  note?: string | null;
  createdDate?: string | null;
  items: OutboundOrderItem[];
}

export interface OutboundOrderItem {
  id: number;
  productVariantId: number;
  productVariantName: string;
  sku?: string | null;
  quantityOrdered: number;
  quantityPicked: number;
  unitCostPrice: number;
  salesOrderItemId?: number | null;
  note?: string | null;
  allocations: OutboundOrderAllocation[];
}

export interface OutboundOrderAllocation {
  id: number;
  inventoryId: number;
  paddyLotId?: number | null;
  paddyLotCode?: string | null;
  locationId: number;
  locationCode?: string | null;
  quantityAllocated: number;
  quantityPicked: number;
  unitCostPrice: number;
}

// ── Command payloads ─────────────────────────────────────────────────

export interface AllocateItemLotPayload {
  inventoryId: number;
  quantityAllocated: number;
}

export interface AllocateItemPayload {
  outboundOrderItemId: number;
  lots: AllocateItemLotPayload[];
}

export interface AllocateOutboundPayload {
  allocations: AllocateItemPayload[];
}

export interface PickAllocationPayload {
  allocationId: number;
  quantityPicked: number;
}

export interface PickOutboundPayload {
  picks: PickAllocationPayload[];
}

export interface ConfirmPackingPayload {
  qrCode: string;
  actualWeightKg?: number | null;
  scaleDevice?: string | null;
}

export interface ConfirmDispatchPayload {
  /** Hạn thanh toán — bắt buộc khi phiếu phát sinh công nợ phải thu. */
  dueDate?: string | null;
  note?: string | null;
}

export interface CompleteDeliveryPayload {
  receiverName: string;
  /** Số tiền khách thanh toán thêm khi nhận hàng (số thuần, mặc định 0). */
  paymentAmount: number;
  deliveryNote?: string | null;
  proofImageUrl?: string | null;
}

/** Kết quả trả về của complete-delivery. */
export interface CompleteDeliveryResult {
  paymentAmount: number;
  remainingDebt: number | null;
}

export interface FailDeliveryPayload {
  reason: string;
}
