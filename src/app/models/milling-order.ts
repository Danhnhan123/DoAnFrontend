import { DTParameters } from './search';

export type MillingOrderStatusCode =
  | 'DRAFT'
  | 'RESERVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type MillingOutputType = 'RICE' | 'BROKEN' | 'BRAN' | 'HUSK';

export interface MillingOrderInputDetail {
  id: number;
  paddyLotId: number;
  lotCode?: string | null;
  locationId?: number | null;
  locationCode?: string | null;
  consumedWeightKg: number;
  reservedWeightKg?: number | null;
  note?: string | null;
  bags?: Array<{ bagId: number; bagNo: number; weightKg: number; stackOrder: number; status: string }>;
}

export interface MillingOrderOutputDetail {
  id: number;
  productVariantId: number;
  sku?: string | null;
  outputLotId?: number | null;
  locationId?: number | null;
  outputType?: MillingOutputType | string | null;
  outputWeightKg: number;
  bagCount?: number | null;
  isByproduct: boolean;
  unitCost?: number | null;
}

/** Dữ liệu list/detail của lệnh xay. Các field future là optional để tương thích BE hiện tại. */
export interface MillingOrderRow {
  id: number;
  organizationId?: number | null;
  millingCode: string;
  statusId: number;
  statusCode?: MillingOrderStatusCode | string | null;
  statusName?: string | null;
  warehouseId: number;
  warehouseName?: string | null;
  reason?: string | null;
  sourceType?: 'SALES_ORDER' | 'PRODUCTION_PLAN' | string | null;
  salesOrderId?: number | null;
  salesOrderCode?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  moisturePercent?: number | null;
  yieldRateUsed: number;
  configuredYieldRate?: number | null;
  totalRiceOutputKg: number;
  targetRiceKg?: number | null;
  computedPaddyKg: number;
  actualPaddyInputKg?: number | null;
  actualYieldRate?: number | null;
  byproductKg?: number | null;
  lossKg?: number | null;
  machineRef?: string | null;
  operatorId?: number | null;
  expectedCompletionDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  millingCost?: number | null;
  incidentalCost?: number | null;
  totalCost?: number | null;
  inputs?: MillingOrderInputDetail[];
  outputs?: MillingOrderOutputDetail[];
  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface MillingOrderDetailDto extends MillingOrderRow {
  inputs: MillingOrderInputDetail[];
  outputs: MillingOrderOutputDetail[];
}

export interface CreateMillingOrderPayload {
  organizationId?: number | null;
  warehouseId: number;
  reason?: string | null;
  salesOrderId?: number | null;
  riceVarietyId?: number | null;
  moisturePercent?: number | null;
  expectedYield: number;
  targetRiceKg: number;
  millingCost?: number | null;
  incidentalCost?: number | null;
  expectedCompletionDate?: string | null;
}

export interface UpdateMillingOrderPayload extends CreateMillingOrderPayload {
  id: number;
}

export interface MillingOrderInputPayload {
  paddyLotId: number;
  locationId?: number | null;
  consumedWeightKg: number;
  reservedWeightKg?: number | null;
  note?: string | null;
}

export interface ReserveMillingOrderPayload {
  columns: Array<{ locationId: number; bagIds: number[] }>;
}

export interface MillingSourceSuggestion {
  paddyLotId: number;
  lotCode: string;
  locationId: number;
  locationCode?: string | null;
  suggestedWeightKg: number;
  immediatelyRetrievableKg: number;
  bagIds: number[];
}

export interface MillingSourceSuggestionResult {
  requiredWeightKg: number;
  suggestedWeightKg: number;
  missingWeightKg: number;
  isComplete: boolean;
  inputs: MillingSourceSuggestion[];
  columns: Array<{
    locationId: number;
    locationCode?: string | null;
    suggestedWeightKg: number;
    bagIds: number[];
  }>;
}

export interface MillingOrderOutputPayload {
  productVariantId: number;
  locationId?: number | null;
  outputType: MillingOutputType;
  outputWeightKg: number;
  bagCount?: number | null;
  isByproduct: boolean;
  unitCost?: number | null;
}

export interface CompleteMillingOrderPayload {
  outputs: MillingOrderOutputPayload[];
  lossKg?: number | null;
  byproductKg?: number | null;
  /** Client cũ có thể còn gửi; backend mới không tin/không ghi đè yield đã đóng dấu. */
  actualYieldRate?: number | null;
  millingCost?: number | null;
  incidentalCost?: number | null;
  machineRef?: string | null;
  operatorId?: number | null;
  note?: string | null;
}

export interface MillingOrderPagedRequest extends DTParameters {}

export interface MillingWarehouseOption {
  id: number;
  code?: string | null;
  name: string;
  isActive?: boolean;
}

export interface MillingLocationOption {
  id: number;
  warehouseId: number;
  warehouseName?: string | null;
  zoneName?: string | null;
  shelfRow?: string | null;
  shelfLevel?: string | null;
  slotCode?: string | null;
  maxCapacity?: number | null;
  currentOccupancy?: number | null;
  isQuarantine?: boolean;
  isActive?: boolean;
  allowedCategoryId?: number | null;
  priority?: number;
  currentProductVariantId?: number | null;
}

export interface MillingPaddyLotOption {
  id: number;
  lotCode: string;
  lotType: string;
  productVariantId: number;
  productVariantName?: string | null;
  sku?: string | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  statusId: number;
  statusCode?: string | null;
  statusName?: string | null;
  isSellable?: boolean | null;
  warehouseId: number;
  warehouseName?: string | null;
  locationId?: number | null;
  remainingWeightKg: number;
  qualityStatus?: string | null;
  inboundDate?: string | null;
}

export interface MillingProductVariantOption {
  id: number;
  name: string;
  sku?: string | null;
  productName?: string | null;
  productCategoryId?: number | null;
  riceVarietyId?: number | null;
  riceVarietyName?: string | null;
  weight?: number | null;
  isByproduct?: boolean;
  isActive?: boolean;
}

export interface MillingYieldOption {
  id: number;
  riceVarietyId?: number | null;
  riceVarietyCode?: string | null;
  riceVarietyName?: string | null;
  moistureFrom?: number | null;
  moistureTo?: number | null;
  yieldRate: number;
  brokenRiceRate?: number | null;
  branRate?: number | null;
  huskRate?: number | null;
  effectiveFrom?: string | null;
  isActive: boolean;
}

export interface MillingSalesOrderOption {
  id: number;
  soCode: string;
  customerName?: string | null;
  warehouseId?: number | null;
  warehouseName?: string | null;
  expectedDeliveryDate?: string | null;
  requiresMilling?: boolean;
  riceVarietyId?: number | null;
  riceVarietyCode?: string | null;
  riceVarietyName?: string | null;
  riceVarietyDisplayName?: string | null;
  riceVarietyCount?: number;
  hasUnconfiguredRiceVariety?: boolean;
  totalRiceRequiredKg?: number;
  allocatedMillingRiceKg?: number;
  remainingMillingRiceKg?: number;
  statusName?: string | null;
  statusCode?: string | null;
}

export interface MillingSalesOrderPage {
  total: number;
  items: MillingSalesOrderOption[];
}
