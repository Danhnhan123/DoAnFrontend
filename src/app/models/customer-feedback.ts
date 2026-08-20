export const FEEDBACK_TYPES = ['QUALITY', 'WRONG_PRODUCT', 'WEIGHT', 'PACKAGING', 'DELIVERY', 'OTHER'] as const;
export const FEEDBACK_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED'] as const;

export interface CustomerFeedback {
  id: number; salesOrderId: number; salesOrderCode: string; outboundOrderId: number;
  outboundOrderCode: string; outboundOrderItemId?: number | null; productVariantId?: number | null;
  productVariantName?: string | null; sku?: string | null; paddyLotBagAllocationId?: number | null;
  feedbackType: string; description: string; severity?: string | null; resolutionStatus: string;
  resolvedAt?: string | null; resolvedByName?: string | null; resolutionNote?: string | null;
  createdDate: string; createdByName: string; customerReturnOrderId?: number | null; customerReturnOrderCode?: string | null;
}

export interface CreateCustomerFeedback {
  salesOrderId: number; outboundOrderId: number; outboundOrderItemId?: number | null;
  productVariantId?: number | null; paddyLotBagAllocationId?: number | null;
  feedbackType: string; description: string; severity?: string | null;
}

export interface FeedbackPage { data: CustomerFeedback[]; recordsTotal: number; recordsFiltered: number; }
