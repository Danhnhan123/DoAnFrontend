export type ReportTab =
  | 'overview'
  | 'stock'
  | 'purchase'
  | 'milling-loss'
  | 'sales'
  | 'two-way-debt'
  | 'quality'
  | 'relative-profit'
  | 'source-effectiveness';

export interface ReportQueryParams {
  fromDate: string;
  toDate: string;
  warehouseId?: number | null;
  riceVarietyId?: number | null;
  productVariantId?: number | null;
  paddyLotId?: number | null;
  locationId?: number | null;
  farmerId?: number | null;
  customerId?: number | null;
  productType?: string | null;
  channel?: string | null;
  status?: string | null;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc';
}

export interface ReportChartPoint {
  label: string;
  value: number;
  secondaryValue?: number | null;
}

export interface ReportPage<T = Record<string, any>> {
  dataSource: T[];
  total: number;
  totalFiltered: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  summary?: any;
  chart: ReportChartPoint[];
}

export interface ReportOption {
  id: number;
  name: string;
  code?: string | null;
}

export interface ReportFilterOptions {
  warehouses: ReportOption[];
  riceVarieties: ReportOption[];
  productVariants: ReportOption[];
  paddyLots: ReportOption[];
  locations: ReportOption[];
  farmers: ReportOption[];
  customers: ReportOption[];
}

export interface ReportOverview {
  paddyOnHandKg: number;
  riceOnHandKg: number;
  quarantinedKg: number;
  pendingDeliveryCount: number;
  revenue: number;
  customerReceivable: number;
  farmerPayable: number;
  relativeProfit: number;
  qualityAlertCount: number;
  goodSourceCount: number;
  totalSourceCount: number;
  topOverdueDebts: string[];
  operationalAlerts: string[];
}

export type ReportColumnKind =
  | 'text'
  | 'date'
  | 'weight'
  | 'money'
  | 'percent'
  | 'status'
  | 'number';

export interface ReportColumn {
  key: string;
  label: string;
  kind?: ReportColumnKind;
  strong?: boolean;
}
