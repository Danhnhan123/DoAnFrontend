import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiResponse,
  DebtDocumentPage,
  DebtDocumentPagedRequest,
  DebtTransactionPage,
  DebtTransactionPagedRequest,
  PartyDebtPage,
  PartyDebtPagedRequest,
  PartyDebtSummary,
  RecordDebtPaymentRequest,
} from '../models';
import { DTParameters } from '../models/search';

@Injectable({ providedIn: 'root' })
export class PartyDebtService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPaged(
    request: PartyDebtPagedRequest
  ): Observable<ApiResponse<PartyDebtPage>> {
    return this.http.post<ApiResponse<PartyDebtPage>>(
      `${this.base}/party-debts/paged-advanced`,
      request
    );
  }

  getSummary(): Observable<ApiResponse<PartyDebtSummary>> {
    return this.http.get<ApiResponse<PartyDebtSummary>>(
      `${this.base}/party-debts/summary`
    );
  }

  getDocuments(
    request: DebtDocumentPagedRequest
  ): Observable<ApiResponse<DebtDocumentPage>> {
    return this.http.post<ApiResponse<DebtDocumentPage>>(
      `${this.base}/party-debts/documents/paged`,
      request
    );
  }

  getAllTransactions(
    request: DebtTransactionPagedRequest
  ): Observable<ApiResponse<DebtTransactionPage>> {
    return this.http.post<ApiResponse<DebtTransactionPage>>(
      `${this.base}/party-debts/transactions/paged-advanced`,
      request
    );
  }

  getTransactions(
    partyDebtId: number,
    request: DTParameters
  ): Observable<ApiResponse<DebtTransactionPage>> {
    return this.http.post<ApiResponse<DebtTransactionPage>>(
      `${this.base}/party-debts/${partyDebtId}/transactions/paged`,
      request
    );
  }

  recordPayment(
    request: RecordDebtPaymentRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/party-debts/payment`,
      request
    );
  }

  buildListRequest(
    page: number,
    pageSize: number,
    keyword: string,
    direction: 'PAYABLE' | 'RECEIVABLE',
    overdueOnly: boolean
  ): PartyDebtPagedRequest {
    const columns = [
      this.column('partyCode', true),
      this.column('partyName', true),
      this.column('currentBalance', true),
      this.column('overdueAmount', true),
      this.column('creditLimit', true),
      this.column('lastModifiedDate', true),
    ];

    return {
      draw: page,
      columns,
      order: [{ column: 3, dir: 'desc', name: '' }],
      start: (page - 1) * pageSize,
      length: pageSize,
      search: { value: keyword.trim(), regex: false, fixed: [] },
      direction,
      overdueOnly,
    };
  }

  buildTransactionRequest(
    page: number,
    pageSize: number
  ): DTParameters {
    return {
      draw: page,
      columns: [
        this.column('transactionDate', true),
        this.column('transactionType', true),
        this.column('amount', true),
        this.column('balanceAfter', true),
      ],
      order: [{ column: 0, dir: 'desc', name: '' }],
      start: (page - 1) * pageSize,
      length: pageSize,
      search: { value: '', regex: false, fixed: [] },
    };
  }

  buildDocumentRequest(
    page: number,
    pageSize: number,
    keyword: string,
    direction?: 'PAYABLE' | 'RECEIVABLE' | null,
    overdueOnly = false
  ): DebtDocumentPagedRequest {
    return {
      draw: page,
      columns: [
        this.column('partyName', true),
        this.column('documentCode', true),
        this.column('totalAmount', true),
        this.column('paidAmount', true),
        this.column('outstandingAmount', true),
        this.column('dueDate', true),
        this.column('status', true),
      ],
      order: [{ column: 5, dir: overdueOnly ? 'asc' : 'desc', name: '' }],
      start: (page - 1) * pageSize,
      length: pageSize,
      search: { value: keyword.trim(), regex: false, fixed: [] },
      direction,
      overdueOnly,
      status: null,
    };
  }

  buildAllTransactionRequest(
    page: number,
    pageSize: number,
    keyword: string
  ): DebtTransactionPagedRequest {
    return {
      ...this.buildTransactionRequest(page, pageSize),
      search: { value: keyword.trim(), regex: false, fixed: [] },
      direction: null,
      transactionType: null,
      dateFrom: null,
      dateTo: null,
    };
  }

  private column(data: string, orderable: boolean) {
    return {
      data,
      name: '',
      searchable: true,
      orderable,
      search: { value: '', regex: false, fixed: [] },
    };
  }
}
