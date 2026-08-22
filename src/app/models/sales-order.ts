import { ProductVariantRow } from './product-variant';

export type SalesOrderChannel = 'DIRECT' | 'WHOLESALE';

export const SALES_ORDER_STATUS = {
  NEW: 1,
  PENDING_CONFIRM: 2,
  RESERVED: 3,
  AWAITING_MILLING: 4,
  PREPARING: 5,
  DELIVERING: 6,
  COMPLETED: 7,
  CANCELLED: 8,
} as const;

export interface SalesOrderPagedRequest {
  keyword?: string | null;
  statusId?: number | null;
  channel?: SalesOrderChannel | null;
  customerId?: number | null;
  warehouseId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  page: number;
  pageSize: number;
}

export interface SalesOrderPage {
  total: number;
  items: SalesOrderRow[];
}

export interface SalesOrderRow {
  id: number;
  soCode: string;
  customerId: number;
  customerName: string;
  statusId: number;
  statusName: string;
  statusCode: string;
  statusColor: string;
  channel: SalesOrderChannel;
  warehouseId?: number | null;
  warehouseName?: string | null;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  requiresMilling: boolean;
  totalAmount: number;
  depositAmount?: number | null;
  note?: string | null;
  /** Lý do hủy — chỉ có giá trị khi đơn đã bị hủy. */
  cancelReason?: string | null;
  createdDate?: string | null;
  feedbackCount: number;
}

export interface SalesOrderDetail extends SalesOrderRow {
  customerPhone?: string | null;
  remainingAmount: number;
  shippingAddress?: string | null;
  items: SalesOrderItem[];
  outboundOrders: SalesOrderOutboundSummary[];
  outboundCount: number;
  feedbackCount: number;
  feedbacks: CustomerFeedbackSummary[];
}

export interface SalesOrderItem {
  id: number;
  productVariantId: number;
  productVariantName: string;
  sku?: string | null;
  quantityOrdered: number;
  unitSalePrice: number;
  discountAmount: number;
  lineAmount: number;
  note?: string | null;
}

export interface SalesOrderOutboundSummary {
  id: number;
  outboundStatusId: number;
  outboundStatusName: string;
  outboundStatusCode: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  totalDispatchedValue: number;
  totalDispatchedSaleValue: number;
  completedDate?: string | null;
  feedbackCount: number;
}

export interface CustomerFeedbackSummary {
  id: number;
  salesOrderId: number;
  outboundOrderId?: number | null;
  outboundOrderItemId?: number | null;
  productVariantId?: number | null;
  productVariantName?: string | null;
  paddyLotBagAllocationId?: number | null;
  bagId?: number | null;
  bagNo?: number | null;
  paddyLotId?: number | null;
  paddyLotCode?: string | null;
  feedbackType: string;
  description: string;
  severity?: string | null;
  resolutionStatus: string;
  createdDate?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  customerReturnOrderId?: number | null;
  customerReturnOrderCode?: string | null;
}

export interface CreateSalesOrderItem {
  productVariantId: number;
  quantityOrdered: number;
  unitSalePrice: number;
  discountAmount: number;
  note?: string | null;
}

export interface CreateSalesOrderPayload {
  customerId: number;
  warehouseId: number;
  channel: SalesOrderChannel;
  expectedDeliveryDate?: string | null;
  requiresMilling: boolean;
  depositAmount?: number | null;
  shippingAddress?: string | null;
  note?: string | null;
  items: CreateSalesOrderItem[];
}

export interface UpdateSalesOrderItem extends CreateSalesOrderItem {
  id?: number | null;
}

export interface UpdateSalesOrderPayload {
  expectedDeliveryDate?: string | null;
  shippingAddress?: string | null;
  depositAmount?: number | null;
  note?: string | null;
  items: UpdateSalesOrderItem[];
}

export interface CreateOutboundItem {
  productVariantId: number;
  quantityToDispatch: number;
}

export interface CreateOutboundPayload {
  items: CreateOutboundItem[];
}

export interface CustomerSalesOption {
  id: number;
  code?: string | null;
  name: string;
  customerType?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface WarehouseSalesOption {
  id: number;
  code?: string | null;
  name: string;
  isActive?: boolean;
}

export interface ProductVariantSalesOption extends ProductVariantRow {}

