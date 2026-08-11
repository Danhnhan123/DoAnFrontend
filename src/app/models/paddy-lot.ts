import { DTParameters } from "./search";

/** Dữ liệu một lô lúa/gạo trả về từ PaddyLotAggregate/PaddyLotDetailDto. */
export interface PaddyLotRow {
  id: number;
  organizationId?: number | null;
  lotCode: string;
  lotType: string;
  productVariantId: number;
  sku?: string | null;
  productVariantName?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  statusId: number;
  statusName?: string | null;
  statusCode?: string | null;
  sourceReceiptId?: number | null;
  sourceMillingOrderId?: number | null;
  warehouseId: number;
  warehouseName?: string | null;
  locationId?: number | null;
  inboundDate: string;
  initialWeightKg: number;
  remainingWeightKg: number;
  costPricePerKg: number;
  qualityStatus?: string | null;
  createdDate: string;
  lastModifiedDate?: string | null;
  bags?: PaddyLotBagOption[];
}

export interface PaddyLotBagOption {
  id: number;
  bagNo: number;
  weightKg: number;
  status: string;
  locationId?: number | null;
}

export interface PaddyLotDetailDto extends PaddyLotRow {}

/** Body DataTables của POST /paddy-lots/paged-advanced. */
export interface PaddyLotPagedRequest extends DTParameters {}

export interface PaddyLotStatusOption {
  id: number;
  name: string;
  color: string;
  isSellable: boolean;
}

export interface PaddyLotSummary {
  totalLots: number;
  totalPaddyKg: number;
  totalRiceKg: number;
  attentionLots: number;
}

/** Chuỗi truy vết đầy đủ trả về từ GET /paddy-lots/{id}/traceability. */
export interface PaddyLotTraceabilityDto {
  requestedLotId: number;
  requestedLotCode: string;
  isTruncated: boolean;
  relatedLots: TraceabilityLotDto[];
  purchases: TraceabilityPurchaseDto[];
  qualityInspections: TraceabilityInspectionDto[];
  millingOrders: TraceabilityMillingDto[];
  outboundSales: TraceabilityOutboundDto[];
  timeline: TraceabilityEventDto[];
  summary: TraceabilitySummaryDto;
}

export interface TraceabilityLotDto {
  id: number;
  lotCode: string;
  lotType: string;
  relationRole: string;
  productVariantId: number;
  sku?: string | null;
  productVariantName?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  statusId: number;
  statusName?: string | null;
  statusCode?: string | null;
  isSellable: boolean;
  isQuarantined: boolean;
  warehouseId: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  locationId?: number | null;
  locationCode?: string | null;
  inboundDate: string;
  initialWeightKg: number;
  remainingWeightKg: number;
  qualityStatus?: string | null;
  sourceReceiptId?: number | null;
  sourceMillingOrderId?: number | null;
}

export interface TraceabilityPurchaseDto {
  receiptId: number;
  receiptCode: string;
  paddyLotId?: number | null;
  paddyLotCode?: string | null;
  scheduleId?: number | null;
  farmerId: number;
  farmerCode?: string | null;
  farmerName?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  warehouseId: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  receiptDate: string;
  actualWeightKg: number;
  bagCount?: number | null;
  qualityJson?: string | null;
  initialQuality?: unknown;
}

export interface TraceabilityInspectionDto {
  inspectionId: number;
  paddyLotId: number;
  paddyLotCode?: string | null;
  inspectedAt: string;
  moisturePercent?: number | null;
  impurityPercent?: number | null;
  moldLevel?: string | null;
  pestLevel?: string | null;
  packagingStatus?: string | null;
  handling?: string | null;
  passedInspection: boolean;
  resultName?: string | null;
  inspectorId?: number | null;
  inspectorName?: string | null;
  note?: string | null;
}

export interface TraceabilityMillingDto {
  millingOrderId: number;
  millingCode: string;
  statusId: number;
  statusName?: string | null;
  statusCode?: string | null;
  warehouseId: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  salesOrderId?: number | null;
  yieldRateUsed: number;
  computedPaddyKg: number;
  totalRiceOutputKg: number;
  byproductKg?: number | null;
  lossKg?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  inputs: TraceabilityMillingInputDto[];
  outputs: TraceabilityMillingOutputDto[];
}

export interface TraceabilityMillingInputDto {
  millingOrderInputId: number;
  paddyLotId: number;
  paddyLotCode?: string | null;
  lotType?: string | null;
  productVariantId: number;
  sku?: string | null;
  locationId?: number | null;
  locationCode?: string | null;
  reservedWeightKg?: number | null;
  consumedWeightKg: number;
  note?: string | null;
}

export interface TraceabilityMillingOutputDto {
  millingOrderOutputId: number;
  outputLotId?: number | null;
  outputLotCode?: string | null;
  productVariantId: number;
  sku?: string | null;
  productVariantName?: string | null;
  outputType: string;
  outputWeightKg: number;
  bagCount?: number | null;
  isByproduct: boolean;
  locationId?: number | null;
  locationCode?: string | null;
}

export interface TraceabilityOutboundDto {
  outboundOrderId: number;
  outboundStatusId: number;
  outboundStatusName?: string | null;
  outboundStatusCode?: string | null;
  completedDate?: string | null;
  warehouseId: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  salesOrderId: number;
  salesOrderCode?: string | null;
  salesOrderStatusId?: number | null;
  salesOrderStatusName?: string | null;
  salesOrderStatusCode?: string | null;
  channel?: string | null;
  salesOrderDate?: string | null;
  customerId?: number | null;
  customerCode?: string | null;
  customerName?: string | null;
  allocations: TraceabilityOutboundAllocationDto[];
}

export interface TraceabilityOutboundAllocationDto {
  allocationId: number;
  outboundOrderItemId: number;
  paddyLotId?: number | null;
  paddyLotCode?: string | null;
  productVariantId: number;
  sku?: string | null;
  productVariantName?: string | null;
  locationId: number;
  locationCode?: string | null;
  quantityAllocatedKg: number;
  quantityPickedKg: number;
}

export interface TraceabilityEventDto {
  eventAt: string;
  eventType: string;
  referenceType: string;
  referenceId: number;
  referenceCode?: string | null;
  paddyLotIds: number[];
  title: string;
  description: string;
  quantityKg?: number | null;
  status?: string | null;
  sequence: number;
}

export interface TraceabilitySummaryDto {
  relatedLotCount: number;
  purchaseReceiptCount: number;
  inspectionCount: number;
  millingOrderCount: number;
  outboundOrderCount: number;
  purchasedWeightKg: number;
  millingInputWeightKg: number;
  millingRiceOutputWeightKg: number;
  millingByproductWeightKg: number;
  millingLossWeightKg: number;
  allocatedOutboundWeightKg: number;
  dispatchedWeightKg: number;
  currentRemainingWeightKg: number;
}
