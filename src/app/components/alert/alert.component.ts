import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';

import { AlertRow, AlertDetailDto, AlertSummaryDto } from '../../models';
import { AlertService } from '../../services/alert.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './alert.component.html',
  styleUrls: ['../supplier/supplier.component.css'],
  styles: [
    `
      .sev-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .sev-critical { background: #fee2e2; color: #b91c1c; }
      .sev-warning { background: #fef3c7; color: #b45309; }
      .sev-info { background: #dbeafe; color: #1e40af; }
      .status-pill.pending { background: #fef3c7; color: #b45309; }
      .stat-icon-wrap.red { background: #fee2e2; color: #b91c1c; }
      .detail-grid {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 8px 14px;
        align-items: start;
      }
      .detail-grid .k { color: #6b7280; font-size: 0.85rem; }
      .detail-grid .v { font-size: 0.9rem; word-break: break-word; }
      .msg-box {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        margin-top: 6px;
        line-height: 1.5;
      }
    `,
  ],
})
export class AlertComponent {
  private service = inject(AlertService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterAlertType = signal<string | null>(null);
  filterSeverity = signal<string | null>(null);
  filterStatus = signal<string | null>(null);
  filterWarehouseId = signal<number | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  readonly typeOptions = [
    { id: 'LOW_STOCK', name: 'Tồn thấp' },
    { id: 'INTAKE_BOTTLENECK', name: 'Nghẽn nhập kho' },
    { id: 'LOT_QUALITY', name: 'Chất lượng lô' },
    { id: 'DEBT_OVERDUE', name: 'Công nợ quá hạn' },
  ];
  readonly severityOptions = [
    { id: 'INFO', name: 'Thông tin' },
    { id: 'WARNING', name: 'Cảnh báo' },
    { id: 'CRITICAL', name: 'Nghiêm trọng' },
  ];
  readonly statusOptions = [
    { id: 'OPEN', name: 'Đang mở' },
    { id: 'ACKNOWLEDGED', name: 'Đã ghi nhận' },
    { id: 'RESOLVED', name: 'Đã xử lý' },
  ];

  showDetail = signal(false);
  selectedItem = signal<AlertRow | null>(null);

  private readonly colMap: Record<string, number> = {
    id: 0,
    alertType: 1,
    severity: 2,
    status: 3,
    warehouseId: 4,
    createdDate: 6,
  };

  summaryQuery = injectQuery(() => ({
    queryKey: ['alerts-summary'],
    queryFn: () => lastValueFrom(this.service.getSummary()),
  }));

  summary = computed<AlertSummaryDto>(() => {
    const res = this.summaryQuery.data();
    const s = (res as any)?.resources ?? (res as any)?.data;
    return (
      s ?? {
        totalOpen: 0,
        totalAcknowledged: 0,
        totalResolved: 0,
        openCritical: 0,
        openWarning: 0,
        openInfo: 0,
      }
    );
  });

  warehouseQuery = injectQuery(() => ({
    queryKey: ['warehouse-options'],
    queryFn: () => lastValueFrom(this.service.getWarehouseOptions()),
    staleTime: 5 * 60 * 1000,
  }));

  warehouseSelectOptions = computed(() => {
    const res = this.warehouseQuery.data();
    const list = (res as any)?.resources ?? (res as any)?.data ?? [];
    return (list as any[]).map((w) => ({
      id: w.id,
      name: `${w.code} — ${w.name}`,
    }));
  });

  listQuery = injectQuery(() => ({
    queryKey: [
      'alerts',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterAlertType(),
      this.filterSeverity(),
      this.filterStatus(),
      this.filterWarehouseId(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () => {
      const body = this.service.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterAlertType: this.filterAlertType(),
        filterSeverity: this.filterSeverity(),
        filterStatus: this.filterStatus(),
        filterWarehouseId: this.filterWarehouseId(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      return lastValueFrom(this.service.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['alert-detail', this.selectedItem()?.id],
    enabled: !!this.selectedItem()?.id && this.showDetail(),
    queryFn: () => lastValueFrom(this.service.getById(this.selectedItem()!.id)),
  }));

  detail = computed<AlertDetailDto | null>(() => {
    const d = this.detailQuery.data();
    return (d as any)?.resources ?? (d as any)?.data ?? null;
  });

  rows = computed<AlertRow[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });

  totalRecords = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  private refresh(): void {
    this.queryClient.invalidateQueries({ queryKey: ['alerts'] });
    this.queryClient.invalidateQueries({ queryKey: ['alerts-summary'] });
  }

  acknowledgeMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.acknowledge(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.refresh();
        this.showAlert('Đã ghi nhận cảnh báo.');
      } else {
        this.showAlert(res.message || 'Ghi nhận thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  resolveMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.resolve(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.refresh();
        this.closeDetail();
        this.showAlert('Đã xử lý cảnh báo.');
      } else {
        this.showAlert(res.message || 'Xử lý thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.refresh();
        this.showAlert('Đã xóa cảnh báo.');
      } else {
        this.showAlert(res.message || 'Xóa thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi xóa', false),
  }));

  acting = computed(
    () =>
      this.acknowledgeMutation.isPending() ||
      this.resolveMutation.isPending() ||
      this.deleteMutation.isPending()
  );

  typeLabel(t: string): string {
    return this.typeOptions.find((x) => x.id === t)?.name ?? t;
  }
  severityLabel(s: string): string {
    return this.severityOptions.find((x) => x.id === s)?.name ?? s;
  }
  statusLabel(s: string): string {
    return this.statusOptions.find((x) => x.id === s)?.name ?? s;
  }
  severityClass(s: string): string {
    if (s === 'CRITICAL') return 'sev-critical';
    if (s === 'WARNING') return 'sev-warning';
    return 'sev-info';
  }
  statusClass(s: string): string {
    if (s === 'RESOLVED') return 'active';
    if (s === 'ACKNOWLEDGED') return 'pending';
    return 'inactive';
  }
  canAct(row: AlertRow): boolean {
    return row.status !== 'RESOLVED';
  }

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }
  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterAlertType.set(null);
    this.filterSeverity.set(null);
    this.filterStatus.set(null);
    this.filterWarehouseId.set(null);
    this.dateFrom.set(null);
    this.dateTo.set(null);
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
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
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

  openDetail(row: AlertRow): void {
    this.selectedItem.set(row);
    this.showDetail.set(true);
  }
  closeDetail(): void {
    this.showDetail.set(false);
    this.selectedItem.set(null);
  }

  acknowledge(row: AlertRow): void {
    Swal.fire({
      title: 'Ghi nhận cảnh báo?',
      text: 'Đánh dấu bạn đã tiếp nhận cảnh báo này.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ghi nhận',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((r) => {
      if (r.isConfirmed) this.acknowledgeMutation.mutate(row.id);
    });
  }

  resolve(row: AlertRow): void {
    Swal.fire({
      title: 'Xử lý xong cảnh báo?',
      text: 'Đánh dấu cảnh báo đã được xử lý (resolved).',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đã xử lý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((r) => {
      if (r.isConfirmed) this.resolveMutation.mutate(row.id);
    });
  }

  delete(row: AlertRow): void {
    Swal.fire({
      title: 'Xóa cảnh báo?',
      text: 'Bạn có chắc muốn xóa cảnh báo này khỏi danh sách?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then((r) => {
      if (r.isConfirmed) this.deleteMutation.mutate(row.id);
    });
  }

  private showAlert(message: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: message,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#15803d',
    });
  }
}
