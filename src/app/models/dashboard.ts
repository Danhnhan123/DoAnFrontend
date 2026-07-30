// ── Dashboard (màn Tổng quan vận hành) ─────────────────────────────────────
// Khớp với các DTO backend: DashboardSummaryDto, DashboardTaskDto,
// ChartDataPointDto, EfficiencyMetricsDto, AlertItemDto.

export interface DashboardInventorySummary {
  onHandKg: number;
  sellableOnHandKg: number;
  reservedKg: number;
  quarantinedKg: number;
  otherBlockedKg: number;
  availableKg: number;
  paddyKg: number;
  paddyDeltaTodayKg: number;
  riceKg: number;
  riceDeltaTodayKg: number;
  byproductKg: number;
}

export interface DashboardDebtSummary {
  farmerPayable: number;
  customerReceivable: number;
  overduePayable: number;
  overdueReceivable: number;
  totalDebt: number;
}

export interface DashboardMillingSummary {
  paddyConsumedKg: number;
  riceOutputKg: number;
  actualYieldRate: number;
  lossKg: number;
}

export interface DashboardSalesSummary {
  grossRevenue: number;
  amountCollected: number;
  outstandingAmount: number;
  completedOrderCount: number;
  pendingDeliveryCount: number;
  pendingDeliveryActionRequiredCount: number;
}

export interface DashboardAlertsSummary {
  openCount: number;
  criticalCount: number;
  quarantinedLotCount: number;
  inspectionOverdueLotCount: number;
}

export interface DashboardEfficiencyMetrics {
  onTimeDeliveryRate: number;
  onTimeDeliveryTarget: number;
  debtRecoveryRate: number;
  warehouseLossRate: number;
  warehouseLossTarget: number;
}

export interface DashboardAlertItem {
  id: number;
  message: string;
  severity: string; // "Warning" | "Critical"
  timeAgo: string; // "30p trước"
  createdAt: string;
}

export interface DashboardSummary {
  inventory: DashboardInventorySummary;
  debt: DashboardDebtSummary;
  milling: DashboardMillingSummary;
  sales: DashboardSalesSummary;
  alerts: DashboardAlertsSummary;
  efficiency: DashboardEfficiencyMetrics;
  recentAlerts: DashboardAlertItem[];
}

export interface DashboardTask {
  time: string; // "08:00"
  type: string; // "PURCHASE" | "DELIVERY" | "INSPECTION"
  title: string;
  description: string;
  status: string; // "Đã xác nhận" | "Chờ xử lý"
}

export interface DashboardChartPoint {
  dayOfWeek: string; // nhãn cột: "T2".."CN" | "Tuần 1".."Tuần 4" | "T1".."T12"
  volumeTons: number;
  averagePrice: number;
}

/** Tham số lọc chung cho các endpoint dashboard. */
export interface DashboardQueryParams {
  fromDate?: string | null;
  toDate?: string | null;
  warehouseId?: number | null;
  period?: string | null;
}
