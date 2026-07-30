import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';

import { ApiResponse } from '../../models';
import {
  InboundOrderDetailDto,
  InboundOrderListDto,
} from '../../models/inbound-order';
import { InboundOrderService } from '../../services/inbound-order.service';
import { AuthService } from '../../services/auth.service';
import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

@Component({
  selector: 'app-inbound-order',
  standalone: true,
  imports: [HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './inbound-order.component.html',
  styleUrl: './inbound-order.component.css',
})
export class InboundOrderComponent {
  private readonly inboundOrderService = inject(InboundOrderService);
  private readonly queryClient = injectQueryClient();
  private readonly authService = inject(AuthService);

  // Quyền: chỉ Manager/Admin mới được duyệt/từ chối/hủy.
  private userRoles = computed(() =>
    (this.authService.currentUser()?.roles ?? []).map((r) =>
      r.name.toLowerCase()
    )
  );
  isManagerOrAdmin = computed(() =>
    this.userRoles().some((r) => r.includes('admin') || r.includes('manager'))
  );

  // 1. State bảng
  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterStatus = signal<string | null>(null);
  expectedFrom = signal<string | null>(null);
  expectedTo = signal<string | null>(null);

  readonly statusOptions = [
    { id: 'Draft', name: 'Nháp' },
    { id: 'Submitted', name: 'Chờ duyệt' },
    { id: 'Approved', name: 'Đã duyệt' },
    { id: 'Rejected', name: 'Đã từ chối' },
    { id: 'Receiving', name: 'Đang nhận' },
    { id: 'Partially Received', name: 'Nhận một phần' },
    { id: 'Confirmed', name: 'Hoàn tất' },
    { id: 'Cancelled', name: 'Đã hủy' },
  ];

  private readonly statusLabels: Record<string, string> = {
    draft: 'Nháp',
    submitted: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Đã từ chối',
    receiving: 'Đang nhận',
    'partially received': 'Nhận một phần',
    confirmed: 'Hoàn tất',
    cancelled: 'Đã hủy',
  };

  private readonly colMap: Record<string, number> = {
    poCode: 0,
    supplierName: 1,
    warehouseName: 2,
    inboundOrderStatusName: 3,
    expectedDate: 4,
    totalAssetValue: 5,
    createdDate: 6,
  };

  // 2. State modal chi tiết
  showDetail = signal(false);
  selectedOrderId = signal<number | null>(null);

  // 3. Queries
  listQuery = injectQuery(() => ({
    queryKey: [
      'inbound-orders',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterStatus(),
      this.expectedFrom(),
      this.expectedTo(),
    ],
    queryFn: () => {
      const body = this.inboundOrderService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterStatus: this.filterStatus(),
        expectedFrom: this.expectedFrom(),
        expectedTo: this.expectedTo(),
      });
      return lastValueFrom(this.inboundOrderService.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['inbound-order-detail', this.selectedOrderId()],
    enabled: this.selectedOrderId() !== null && this.showDetail(),
    queryFn: () =>
      lastValueFrom(this.inboundOrderService.getById(this.selectedOrderId()!)),
  }));

  // 4. Computed
  rows = computed<InboundOrderListDto[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });

  totalRecords = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  detail = computed<InboundOrderDetailDto | null>(() => {
    const res = this.detailQuery.data();
    return (res as any)?.resources ?? (res as any)?.data ?? null;
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(
    () => this.detailQuery.isPending() || this.detailQuery.isFetching()
  );

  submittedCount = computed(
    () => this.rows().filter((x) => this.normalizedStatus(x) === 'submitted').length
  );

  // 5. Mutations
  approveMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.inboundOrderService.approve(id)),
    onSuccess: (res: any) =>
      this.handleAction(res, 'Đã phê duyệt phiếu nhập.'),
    onError: (err: any) => this.showApiError(err, 'Không thể phê duyệt phiếu.'),
  }));

  rejectMutation = injectMutation(() => ({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      lastValueFrom(this.inboundOrderService.reject(id, reason)),
    onSuccess: (res: any) => this.handleAction(res, 'Đã từ chối phiếu nhập.'),
    onError: (err: any) => this.showApiError(err, 'Không thể từ chối phiếu.'),
  }));

  cancelMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.inboundOrderService.cancel(id)),
    onSuccess: (res: any) => this.handleAction(res, 'Đã hủy phiếu nhập.'),
    onError: (err: any) => this.showApiError(err, 'Không thể hủy phiếu.'),
  }));

  actionPending = computed(
    () =>
      this.approveMutation.isPending() ||
      this.rejectMutation.isPending() ||
      this.cancelMutation.isPending()
  );

  // 6. Table helpers
  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }
  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterStatus.set(null);
    this.expectedFrom.set(null);
    this.expectedTo.set(null);
    this.applyFilter();
  }
  onSearch(): void {
    this.page.set(1);
  }

  sort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }
  sortIcon(field: string): string {
    if (this.sortField() !== field) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  setPageSize(value: string | number): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
  }
  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRecords() / this.pageSize()));
  }
  visiblePages(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const d = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) {
      pages.push(i);
    }
    return pages;
  }

  // 7. Modal chi tiết
  openDetail(order: InboundOrderListDto): void {
    this.selectedOrderId.set(order.id);
    this.showDetail.set(true);
  }
  closeDetail(): void {
    this.showDetail.set(false);
    this.selectedOrderId.set(null);
  }

  openImage(url: string | null | undefined): void {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  // 8. Actions
  approve(order: InboundOrderListDto | InboundOrderDetailDto): void {
    this.confirmThen(
      'Phê duyệt phiếu nhập?',
      `${order.poCode} sẽ chuyển sang trạng thái Đã duyệt.`,
      () => this.approveMutation.mutate(order.id)
    );
  }

  reject(order: InboundOrderListDto | InboundOrderDetailDto): void {
    Swal.fire({
      title: 'Từ chối phiếu nhập',
      text: `Nhập lý do từ chối ${order.poCode}.`,
      input: 'textarea',
      inputPlaceholder: 'Ví dụ: Thiếu thông tin nhà cung cấp hoặc SKU...',
      inputAttributes: { 'aria-label': 'Lý do từ chối' },
      showCancelButton: true,
      confirmButtonText: 'Từ chối phiếu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#ef4444',
      preConfirm: (value) => {
        if (!String(value ?? '').trim()) {
          Swal.showValidationMessage('Vui lòng nhập lý do từ chối.');
          return false;
        }
        return String(value).trim();
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.rejectMutation.mutate({ id: order.id, reason: result.value });
      }
    });
  }

  cancel(order: InboundOrderListDto | InboundOrderDetailDto): void {
    this.confirmThen(
      'Hủy phiếu nhập?',
      `${order.poCode} sẽ bị hủy và không thể tiếp tục xử lý.`,
      () => this.cancelMutation.mutate(order.id),
      'warning'
    );
  }

  /** Web admin chỉ thao tác trên phiếu ở trạng thái Submitted (theo tài liệu). */
  canAct(order: InboundOrderListDto | InboundOrderDetailDto): boolean {
    return (
      this.isManagerOrAdmin() && this.normalizedStatus(order) === 'submitted'
    );
  }

  // 9. Hiển thị
  statusLabel(name: string): string {
    return this.statusLabels[(name || '').trim().toLowerCase()] ?? name;
  }

  statusClass(status: string): string {
    const normalized = (status || '').trim().toLowerCase().replaceAll(' ', '-');
    const classMap: Record<string, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      approved: 'status-approved',
      receiving: 'status-receiving',
      'partially-received': 'status-partial',
      'fully-received': 'status-complete',
      confirmed: 'status-confirmed',
      rejected: 'status-rejected',
      cancelled: 'status-cancelled',
    };
    return classMap[normalized] ?? 'status-neutral';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(value ?? 0));
  }

  private normalizedStatus(
    order: InboundOrderListDto | InboundOrderDetailDto
  ): string {
    return (order.inboundOrderStatusName || '').trim().toLowerCase();
  }

  private handleAction(res: ApiResponse<unknown>, successMessage: string): void {
    if (res?.isSucceeded === false) {
      this.showMessage(
        'Thao tác thất bại',
        res.message || 'Máy chủ không thể xử lý yêu cầu.',
        'error'
      );
      return;
    }
    this.closeDetail();
    this.queryClient.invalidateQueries({ queryKey: ['inbound-orders'] });
    this.queryClient.invalidateQueries({ queryKey: ['inbound-order-detail'] });
    this.showMessage('Thành công', successMessage, 'success');
  }

  private confirmThen(
    title: string,
    text: string,
    onConfirm: () => void,
    icon: 'question' | 'warning' = 'question'
  ): void {
    Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: icon === 'warning' ? '#ef4444' : '#15803d',
    }).then((result) => {
      if (result.isConfirmed) onConfirm();
    });
  }

  private showApiError(error: unknown, fallback: string): void {
    const apiError = error as {
      error?: { message?: string };
      message?: string;
    };
    this.showMessage(
      'Thao tác thất bại',
      apiError?.error?.message || apiError?.message || fallback,
      'error'
    );
  }

  private showMessage(
    title: string,
    text: string,
    icon: 'success' | 'error' | 'warning'
  ): void {
    Swal.fire({
      title,
      text,
      icon,
      confirmButtonText: 'Đóng',
      confirmButtonColor: icon === 'error' ? '#ef4444' : '#15803d',
    });
  }
}