export type QrLabelType = "PADDY_LOT" | "BAG" | "LOCATION" | "SKU";
export type QrLabelFormat = "PDF" | "PNG";
export type QrLabelTemplate = "SMALL" | "MEDIUM" | "LARGE";

export interface QrLabelTemplateInfo {
  code: QrLabelTemplate;
  name: string;
  widthMm: number;
  heightMm: number;
}

export interface QrLabelPreviewData {
  labelType: QrLabelType;
  subjectId: number;
  template: QrLabelTemplate;
  qrPayload: string;
  qrImageDataUrl?: string | null;
  displayCode: string;
  productName?: string | null;
  sku?: string | null;
  riceVarietyName?: string | null;
  weightKg?: number | null;
  packageWeightKg?: number | null;
  inboundDate?: string | null;
  warehouseName?: string | null;
  locationName?: string | null;
  isQuarantined: boolean;
}

export interface QrLabelPreview {
  templates: QrLabelTemplateInfo[];
  formats: QrLabelFormat[];
  labelTypes: QrLabelType[];
  label?: QrLabelPreviewData | null;
}

export interface QrLabelSummary {
  totalLabelsThisMonth: number;
  totalJobsThisMonth: number;
  printMode: string;
}

export interface QrLabelHistoryItem {
  id: number;
  jobCode: string;
  labelType: QrLabelType;
  targetIds: string;
  content: string;
  quantity: number;
  printedBy: string;
  format: string;
  template: string;
  status: string;
  createdDate: string;
}

export interface QrLabelHistoryQuery {
  page: number;
  pageSize: number;
  search?: string;
  labelType?: QrLabelType | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface QrLabelHistoryResult {
  items: QrLabelHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BatchQrLabelPrintRequest {
  ids: number[];
  format: QrLabelFormat;
  template: QrLabelTemplate;
  copiesPerLabel: number;
}
