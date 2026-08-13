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
  /** Lý do hủy — chỉ có giá trị khi phiếu đã bị hủy. */
  cancelReason?: string | null;
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
  /** Lý do hủy — chỉ có giá trị khi phiếu đã bị hủy. */
  cancelReason?: string | null;
  /** Tên cân điện tử đã dùng khi đóng gói; null = nhập tay. */
  packingScaleDevice?: string | null;
  packedDate?: string | null;
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
  /** Khối lượng đóng gói thực tế đã ghi ở bước đóng gói. */
  actualWeightKg?: number | null;
  actualWeightSource?: PackingWeightSource | null;
  allocations: OutboundOrderAllocation[];
  allocationGroups?: OutboundOrderAllocationGroup[];
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

/** Nhóm các dòng bao cùng lô, vị trí và trọng lượng để hiển thị gọn trên UI. */
export interface OutboundOrderAllocationGroup {
  groupKey: string;
  allocationIds: number[];
  inventoryId: number;
  paddyLotId?: number | null;
  paddyLotCode?: string | null;
  locationId: number;
  locationCode?: string | null;
  bagCount: number;
  weightPerBagKg: number;
  totalAllocatedKg: number;
  totalPickedKg: number;
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

/** Nguồn của số khối lượng đóng gói — cần cho việc truy xuất khi đối chiếu. */
export type PackingWeightSource = 'SCALE' | 'MANUAL';

export interface ConfirmPackingItemPayload {
  outboundOrderItemId: number;
  actualWeightKg?: number | null;
  source?: PackingWeightSource | null;
}

export interface ConfirmPackingPayload {
  qrCode: string;
  /** Tổng khối lượng — backend tính lại từ `items` khi có. */
  actualWeightKg?: number | null;
  /** Chỉ gửi khi thật sự có số từ cân điện tử; nhập tay thì để null. */
  scaleDevice?: string | null;
  items?: ConfirmPackingItemPayload[];
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
