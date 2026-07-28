import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  DebtDirection,
  DebtDocumentRow,
  DebtTransactionRow,
  PartyDebtSummary,
  RecordDebtPaymentRequest,
} from '../../models';
import { PartyDebtService } from '../../services/party-debt.service';

type DebtTab =
  | 'OVERVIEW'
  | 'PAYABLE'
  | 'RECEIVABLE'
  | 'HISTORY'
  | 'OVERDUE'
  | 'REPORT';

const EMPTY_SUMMARY: PartyDebtSummary = {
  totalPayable: 0,
  totalReceivable: 0,
  totalOverduePayable: 0,
  totalOverdueReceivable: 0,
  overLimitCustomerCount: 0,
  activeDebtCount: 0,
  openDocumentCount: 0,
  overdueDocumentCount: 0,
  netProjectedCashFlow: 0,
};

@Component({
  selector: 'app-party-debt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './party-debt.component.html',
  styleUrl: './party-debt.component.css',
})
export class PartyDebtComponent implements OnInit {
  readonly Math = Math;
  private readonly service = inject(PartyDebtService);
  private readonly router = inject(Router);

  activeTab = signal<DebtTab>('OVERVIEW');
  summary = signal<PartyDebtSummary>(EMPTY_SUMMARY);
  summaryLoading = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  keywordDraft = signal('');
  keyword = signal('');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  documents = signal<DebtDocumentRow[]>([]);
  transactions = signal<DebtTransactionRow[]>([]);
  payableTop = signal<DebtDocumentRow[]>([]);
  receivableTop = signal<DebtDocumentRow[]>([]);

  paymentOpen = signal(false);
  selectedDocument = signal<DebtDocumentRow | null>(null);
  paymentAmount = signal<number | null>(null);
  paymentDate = signal(this.todayInputValue());
  paymentNote = signal('');
  paymentError = signal('');
  paymentSaving = signal(false);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );

  readonly documentTab = computed(() =>
    ['PAYABLE', 'RECEIVABLE', 'OVERDUE'].includes(this.activeTab())
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loadSummary();
    this.loadCurrentTab();
  }

  selectTab(tab: DebtTab): void {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.page.set(1);
    this.keyword.set('');
    this.keywordDraft.set('');
    this.errorMessage.set('');
    this.loadCurrentTab();
  }

  loadCurrentTab(): void {
    if (this.activeTab() === 'OVERVIEW') {
      this.loadOverview();
    } else if (this.documentTab()) {
      this.loadDocuments();
    } else if (this.activeTab() === 'HISTORY') {
      this.loadTransactions();
    }
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.service.getSummary().subscribe({
      next: (response) => {
        this.summary.set(response?.resources ?? EMPTY_SUMMARY);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summary.set(EMPTY_SUMMARY);
        this.summaryLoading.set(false);
      },
    });
  }

  loadOverview(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    forkJoin({
      payable: this.service.getDocuments(
        this.service.buildDocumentRequest(1, 5, '', 'PAYABLE')
      ),
      receivable: this.service.getDocuments(
        this.service.buildDocumentRequest(1, 5, '', 'RECEIVABLE')
      ),
    }).subscribe({
      next: ({ payable, receivable }) => {
        this.payableTop.set(payable?.resources?.data ?? []);
        this.receivableTop.set(receivable?.resources?.data ?? []);
        this.loading.set(false);
      },
      error: (error) => {
        this.payableTop.set([]);
        this.receivableTop.set([]);
        this.errorMessage.set(this.apiError(error, 'Không tải được dữ liệu tổng quan.'));
        this.loading.set(false);
      },
    });
  }

  loadDocuments(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    const direction: DebtDirection | null =
      this.activeTab() === 'PAYABLE'
        ? 'PAYABLE'
        : this.activeTab() === 'RECEIVABLE'
          ? 'RECEIVABLE'
          : null;
    const request = this.service.buildDocumentRequest(
      this.page(),
      this.pageSize(),
      this.keyword(),
      direction,
      this.activeTab() === 'OVERDUE'
    );
    this.service.getDocuments(request).subscribe({
      next: (response) => {
        const resource = response?.resources;
        this.documents.set(resource?.data ?? []);
        this.total.set(resource?.recordsFiltered ?? resource?.recordsTotal ?? 0);
        this.loading.set(false);
      },
      error: (error) => {
        this.documents.set([]);
        this.total.set(0);
        this.errorMessage.set(this.apiError(error, 'Không tải được danh sách chứng từ.'));
        this.loading.set(false);
      },
    });
  }

  loadTransactions(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.service
      .getAllTransactions(
        this.service.buildAllTransactionRequest(
          this.page(),
          this.pageSize(),
          this.keyword()
        )
      )
      .subscribe({
        next: (response) => {
          const resource = response?.resources;
          this.transactions.set(resource?.data ?? []);
          this.total.set(resource?.recordsFiltered ?? resource?.recordsTotal ?? 0);
          this.loading.set(false);
        },
        error: (error) => {
          this.transactions.set([]);
          this.total.set(0);
          this.errorMessage.set(this.apiError(error, 'Không tải được lịch sử giao dịch.'));
          this.loading.set(false);
        },
      });
  }

  applySearch(): void {
    this.keyword.set(this.keywordDraft().trim());
    this.page.set(1);
    this.loadCurrentTab();
  }

  clearSearch(): void {
    this.keywordDraft.set('');
    this.keyword.set('');
    this.page.set(1);
    this.loadCurrentTab();
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.loadCurrentTab();
  }

  visiblePages(): number[] {
    const from = Math.max(1, this.page() - 2);
    const to = Math.min(this.totalPages(), this.page() + 2);
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }

  openPayment(document: DebtDocumentRow): void {
    if (document.outstandingAmount <= 0) return;
    this.selectedDocument.set(document);
    this.paymentAmount.set(null);
    this.paymentDate.set(this.todayInputValue());
    this.paymentNote.set('');
    this.paymentError.set('');
    this.paymentOpen.set(true);
  }

  closePayment(): void {
    if (this.paymentSaving()) return;
    this.paymentOpen.set(false);
  }

  savePayment(): void {
    const document = this.selectedDocument();
    const amount = Number(this.paymentAmount());
    if (!document) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      this.paymentError.set('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }
    if (amount > document.outstandingAmount) {
      this.paymentError.set('Số tiền không được vượt quá số còn phải thanh toán của chứng từ.');
      return;
    }
    if (!this.paymentDate()) {
      this.paymentError.set('Vui lòng chọn ngày thanh toán.');
      return;
    }
    if (this.paymentNote().trim().length > 500) {
      this.paymentError.set('Ghi chú không được vượt quá 500 ký tự.');
      return;
    }

    const payload: RecordDebtPaymentRequest = {
      partyDebtId: document.partyDebtId,
      transactionType: 'PAYMENT',
      amount,
      transactionDate: new Date(`${this.paymentDate()}T12:00:00`).toISOString(),
      note: this.paymentNote().trim() || null,
      refType: document.refType || 'MANUAL_PAYMENT',
      refId: document.refId,
      requestId: this.newRequestId(),
    };

    this.paymentSaving.set(true);
    this.paymentError.set('');
    this.service.recordPayment(payload).subscribe({
      next: () => {
        this.paymentSaving.set(false);
        this.paymentOpen.set(false);
        this.successMessage.set(`Đã thanh toán cho chứng từ ${document.documentCode}.`);
        window.setTimeout(() => this.successMessage.set(''), 4000);
        this.reload();
      },
      error: (error) => {
        this.paymentSaving.set(false);
        this.paymentError.set(this.apiError(error, 'Không thể lưu thanh toán.'));
      },
    });
  }

  openDocument(document: DebtDocumentRow): void {
    if (document.documentUrl) this.router.navigateByUrl(document.documentUrl);
  }

  statusLabel(status: string): string {
    return (
      {
        PAID: 'Đã thanh toán',
        PARTIAL: 'Thanh toán một phần',
        OVERDUE: 'Quá hạn',
        UNPAID: 'Chưa thanh toán',
      }[status] ?? status
    );
  }

  directionLabel(direction?: DebtDirection): string {
    return direction === 'PAYABLE' ? 'Phải trả' : 'Phải thu';
  }

  transactionLabel(type: string): string {
    const normalized = (type || '').toUpperCase();
    if (normalized === 'PAYMENT') return 'Thanh toán';
    if (normalized === 'RETURN_CREDIT') return 'Giảm nợ trả hàng';
    if (normalized === 'REFUND_PAYABLE') return 'Khoản phải hoàn khách';
    return normalized.includes('CHARGE') ? 'Phát sinh nợ' : type;
  }

  formatMoney(value: number | null | undefined): string {
    return `${Number(value ?? 0).toLocaleString('vi-VN')} ₫`;
  }

  private apiError(error: any, fallback: string): string {
    return (
      error?.error?.message ||
      error?.error?.errors?.[0]?.message ||
      error?.message ||
      fallback
    );
  }

  private todayInputValue(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  private newRequestId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
