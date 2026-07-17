import { DTParameters } from './search';

/** Một dòng cảnh báo hiển thị trên bảng. */
export interface AlertRow {
  id: number;
  alertType: string;
  severity: string;
  warehouseId: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  productVariantId?: number | null;
  productVariantSku?: string | null;
  productName?: string | null;
  locationId?: number | null;
  locationName?: string | null;
  message: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  status: string;
  acknowledgedBy?: number | null;
  acknowledgedByName?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdDate: string;
}

export interface AlertDetailDto extends AlertRow {}

export interface AlertSummaryDto {
  totalOpen: number;
  totalAcknowledged: number;
  totalResolved: number;
  openCritical: number;
  openWarning: number;
  openInfo: number;
}

/** Một quy tắc cảnh báo (bật/tắt) trong khối "Quy tắc cảnh báo". */
export interface AlertRule {
  code: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface AlertPagedAdvancedRequest extends DTParameters {}
