import { DTResponse } from './common';
import { DTParameters } from './search';

export type DebtDirection = 'PAYABLE' | 'RECEIVABLE';
export type DebtPartyType = 'FARMER' | 'CUSTOMER';

export interface PartyDebtRow {
  id: number;
  organizationId?: number | null;
  partyType: DebtPartyType;
  partyId: number;
  partyCode: string;
  partyName: string;
  direction: DebtDirection;
  openingBalance: number;
  currentBalance: number;
  creditLimit?: number | null;
  isActive: boolean;
  createdDate: string;
  lastModifiedDate?: string | null;
  dueSoonAmount: number;
  dueTodayAmount: number;
  overdueAmount: number;
  oldestOverdueDate?: string | null;
  maxDaysOverdue: number;
}

export interface PartyDebtSummary {
  totalPayable: number;
  totalReceivable: number;
  totalOverduePayable: number;
  totalOverdueReceivable: number;
  overLimitCustomerCount: number;
  activeDebtCount: number;
  openDocumentCount: number;
  overdueDocumentCount: number;
  netProjectedCashFlow: number;
}

export type DebtDocumentStatus = 'UNPAID' | 'PARTIAL' | 'OVERDUE' | 'PAID';

export interface DebtDocumentRow {
  partyDebtId: number;
  chargeTransactionId: number;
  partyType: DebtPartyType;
  partyId: number;
  partyCode: string;
  partyName: string;
  partyPhone?: string | null;
  direction: DebtDirection;
  refType?: string | null;
  refId?: number | null;
  documentCode: string;
  documentUrl?: string | null;
  transactionDate: string;
  dueDate?: string | null;
  note?: string | null;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: DebtDocumentStatus;
  daysOverdue: number;
}

export interface DebtTransactionRow {
  id: number;
  partyDebtId: number;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  refType?: string | null;
  refId?: number | null;
  transactionDate: string;
  dueDate?: string | null;
  note?: string | null;
  createdDate: string;
  partyType?: DebtPartyType;
  partyId?: number;
  partyCode?: string;
  partyName?: string;
  direction?: DebtDirection;
  documentCode?: string;
  createdByName?: string | null;
}

export interface PartyDebtPagedRequest extends DTParameters {
  direction: DebtDirection;
  overdueOnly: boolean;
}

export interface PartyDebtPage extends DTResponse<PartyDebtRow> {}
export interface DebtTransactionPage extends DTResponse<DebtTransactionRow> {}
export interface DebtDocumentPage extends DTResponse<DebtDocumentRow> {}

export interface DebtDocumentPagedRequest extends DTParameters {
  direction?: DebtDirection | null;
  overdueOnly: boolean;
  status?: DebtDocumentStatus | null;
}

export interface DebtTransactionPagedRequest extends DTParameters {
  direction?: DebtDirection | null;
  transactionType?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface RecordDebtPaymentRequest {
  partyDebtId: number;
  transactionType: 'PAYMENT';
  amount: number;
  transactionDate: string;
  note?: string | null;
  refType: string;
  refId?: number | null;
  requestId: string;
}
