import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
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
export class PartyDebtService extends ApiService {

  getPaged(
    request: PartyDebtPagedRequest
  ): Observable<ApiResponse<PartyDebtPage>> {
    return this.apiPost<PartyDebtPage>(
      '/party-debts/paged-advanced',
      request
    );
  }

  getSummary(): Observable<ApiResponse<PartyDebtSummary>> {
    return this.apiGet<PartyDebtSummary>(
      '/party-debts/summary'
    );
  }

  getDocuments(
    request: DebtDocumentPagedRequest
  ): Observable<ApiResponse<DebtDocumentPage>> {
    return this.apiPost<DebtDocumentPage>(
      '/party-debts/documents/paged',
      request
    );
  }

  getAllTransactions(
    request: DebtTransactionPagedRequest
  ): Observable<ApiResponse<DebtTransactionPage>> {
    return this.apiPost<DebtTransactionPage>(
      '/party-debts/transactions/paged-advanced',
      request
    );
  }

  getTransactions(
    partyDebtId: number,
    request: DTParameters
  ): Observable<ApiResponse<DebtTransactionPage>> {
    return this.apiPost<DebtTransactionPage>(
      `/party-debts/${partyDebtId}/transactions/paged`,
      request
    );
  }

  recordPayment(
    request: RecordDebtPaymentRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/party-debts/payment',
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
    const columns = ['partyCode', 'partyName', 'currentBalance', 'overdueAmount', 'creditLimit', 'lastModifiedDate'];

    return buildDataTablesRequest(
      {
        page,
        pageSize,
        search: keyword,
        sortField: 'overdueAmount',
        sortDir: 'desc',
      },
      columns,
      {},
      {
        direction,
        overdueOnly,
      }
    ) as PartyDebtPagedRequest;
  }

  buildTransactionRequest(
    page: number,
    pageSize: number
  ): DTParameters {
    const columns = ['transactionDate', 'transactionType', 'amount', 'balanceAfter'];

    return buildDataTablesRequest(
      {
        page,
        pageSize,
        search: '',
        sortField: 'transactionDate',
        sortDir: 'desc',
      },
      columns
    ) as DTParameters;
  }

  buildDocumentRequest(
    page: number,
    pageSize: number,
    keyword: string,
    direction?: 'PAYABLE' | 'RECEIVABLE' | null,
    overdueOnly = false
  ): DebtDocumentPagedRequest {
    const columns = ['partyName', 'documentCode', 'totalAmount', 'paidAmount', 'outstandingAmount', 'dueDate', 'status', 'transactionDate'];

    const sortField = overdueOnly ? 'dueDate' : 'transactionDate';
    const sortDir = overdueOnly ? 'asc' : 'desc';

    return buildDataTablesRequest(
      {
        page,
        pageSize,
        search: keyword,
        sortField,
        sortDir,
      },
      columns,
      {},
      {
        direction,
        overdueOnly,
        status: null,
      }
    ) as DebtDocumentPagedRequest;
  }

  buildAllTransactionRequest(
    page: number,
    pageSize: number,
    keyword: string
  ): DebtTransactionPagedRequest {
    const columns = ['transactionDate', 'transactionType', 'amount', 'balanceAfter'];

    return buildDataTablesRequest(
      {
        page,
        pageSize,
        search: keyword,
        sortField: 'transactionDate',
        sortDir: 'desc',
      },
      columns,
      {},
      {
        direction: null,
        transactionType: null,
        dateFrom: null,
        dateTo: null,
      }
    ) as DebtTransactionPagedRequest;
  }
}
