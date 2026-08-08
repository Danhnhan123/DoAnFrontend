import { DTParameters } from './search';

export interface InboundOrderListDto {
  id: number;
  poCode: string;
  warehouseId: number;
  warehouseName: string;
  supplierId?: number | null;
  supplierName?: string | null;
  inboundOrderStatusId: number;
  inboundOrderStatusName: string;
  /** Mã code trạng thái (DRAFT/SUBMITTED/APPROVED/...) - dùng cho logic, không phụ thuộc tên hiển thị. */
  inboundOrderStatusCode: string;
  totalAssetValue: number;
  expectedDate?: string | null;
  completedDate?: string | null;
  note?: string | null;
  sourceType?: string | null;
  paddyPurchaseReceiptId?: number | null;
  paddyPurchaseReceiptCode?: string | null;
  createdDate: string;
}

export interface InboundOrderItemDto {
  id: number;
  inboundOrderId: number;
  productVariantId?: number | null;
  paddyLotId?: number | null;
  paddyLotCode?: string | null;
  paddyQualityStatus?: string | null;
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

/** Chứng từ giao hàng (ảnh + thông tin OCR) gắn với phiếu nhập. */
export interface DeliveryNoteDto {
  id: number;
  inboundOrderId: number;
  trackingCode?: string | null;
  carrierName?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverAddress?: string | null;
  declaredWeight?: number | null;
  codAmount?: number | null;
  rawOcrText?: string | null;
  originalImageFileId?: number | null;
  /** URL ảnh chứng từ để hiển thị/xem lại. */
  imageUrl?: string | null;
  isConfirmed: boolean;
  createdDate: string;
}

export interface InboundOrderDetailDto extends InboundOrderListDto {
  items: InboundOrderItemDto[];
  /** Chứng từ giao hàng, null nếu phiếu chưa có. */
  deliveryNote?: DeliveryNoteDto | null;
}

export interface InboundOrderPagingData {
  currentPage: number;
  pageSize: number;
  dataSource: InboundOrderListDto[];
  total: number;
  totalFiltered: number;
}

/** Body DataTables gửi lên API paged-advanced. */
export interface InboundOrderPagedAdvancedRequest extends DTParameters {}

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

export interface PutawaySuggestionDto {
  locationId: number;
  zoneName?: string | null;
  shelfRow?: string | null;
  shelfLevel?: string | null;
  slotCode?: string | null;
  score: number;
  availableCapacity: number;
  currentOccupancy: number;
  priority: number;
  categoryMatch: boolean;
  recommendedWeightKg: number;
  canFitWhole: boolean;
  isQuarantine: boolean;
  scoreBreakdown: Record<string, number>;
}

export interface SelectInboundPutawayDto {
  locationId: number;
  isOverride: boolean;
  overrideReason?: string | null;
  weightKg?: number | null;
}
