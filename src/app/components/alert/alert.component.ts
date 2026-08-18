import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
  keepPreviousData,
} from '@tanstack/angular-query-experimental';

import { AlertRow, AlertRule, AlertSummaryDto } from '../../models';
import { AlertService } from '../../services/alert.service';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

const DEFAULT_RULES: AlertRule[] = [
  { code: 'LOW_STOCK', title: 'Tồn kho thấp', description: 'Khi tồn kho < ngưỡng cảnh báo', enabled: true },
  { code: 'WAREHOUSE_CAPACITY', title: 'Kho gần đầy', description: 'Khi sức chứa đạt ≥ 85%', enabled: true },
  { code: 'EXPIRY_SOON', title: 'Hàng sắp hết hạn', description: 'Cảnh báo trước 7 ngày hết hạn', enabled: true },
];

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [HasPermissionDirective, CommonModule],
  templateUrl: './alert.component.html',
  styleUrls: ['../supplier/supplier.component.css', './alert.component.css'],
})
export class AlertComponent {
  private service = inject(AlertService);
  private router = inject(Router);
  private queryClient = injectQueryClient();

  // ── Quy tắc cảnh báo (bật/tắt) — quản lý bằng signal, có fallback mặc định ──
  rules = signal<AlertRule[]>(DEFAULT_RULES);

  // ── Phân trang danh sách cảnh báo (10/trang, server-side) ──
  page = signal(1);
  readonly pageSize = 10;

  constructor() {
    this.loadRules();
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  summaryQuery = injectQuery(() => ({
    queryKey: ['alerts-summary'],
    queryFn: () => lastValueFrom(this.service.getSummary()),
  }));

  listQuery = injectQuery(() => ({
    queryKey: ['alerts', this.page()],
    queryFn: () =>
      lastValueFrom(
        this.service.getPagedAdvanced(
          this.service.buildListBody(
            this.pageSize,
            (this.page() - 1) * this.pageSize
          )
        )
      ),
    // Giữ dữ liệu trang trước khi đổi trang -> không nháy skeleton cả màn.
    placeholderData: keepPreviousData,
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

  rows = computed<AlertRow[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });

  total = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });
  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize))
  );

  loading = computed(
    () => this.listQuery.isPending() || this.summaryQuery.isPending()
  );
  isError = computed(
    () => this.listQuery.isError() || this.summaryQuery.isError()
  );
  isEmpty = computed(() => this.rows().length === 0);
  /** Có cảnh báo nhưng không còn cái nào đang mở -> "Tất cả đã được đọc và xử lý". */
  allHandled = computed(() => this.rows().length > 0 && this.summary().totalOpen === 0);

  // ── Mutations ────────────────────────────────────────────────────────────────
  private refresh(): void {
    this.queryClient.invalidateQueries({ queryKey: ['alerts'] });
    this.queryClient.invalidateQueries({ queryKey: ['alerts-summary'] });
  }

  markReadMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.acknowledge(id)),
    onSuccess: () => this.refresh(),
  }));

  markAllReadMutation = injectMutation(() => ({
    mutationFn: () => lastValueFrom(this.service.markAllRead()),
    onSuccess: () => this.refresh(),
  }));

  dismissMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.dismiss(id)),
    onSuccess: () => this.refresh(),
    onError: () => this.refresh(),
  }));

  // ── Actions ─────────────────────────────────────────────────────────────────
  retry(): void {
    this.summaryQuery.refetch();
    this.listQuery.refetch();
    this.loadRules();
  }

  setPage(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.page()) return;
    this.page.set(p);
  }

  /** Dải số trang hiển thị quanh trang hiện tại (±2). */
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

  markRead(row: AlertRow): void {
    if (this.isUnread(row) && !this.markReadMutation.isPending()) {
      this.markReadMutation.mutate(row.id);
    }
  }

  markAllRead(): void {
    if (this.summary().totalOpen > 0 && !this.markAllReadMutation.isPending()) {
      this.markAllReadMutation.mutate();
    }
  }

  dismiss(row: AlertRow, event: Event): void {
    event.stopPropagation();
    this.dismissMutation.mutate(row.id);
  }

  goAddRule(): void {
    this.router.navigate(['/admin/stock-alert-configs']);
  }

  private loadRules(): void {
    this.service.getRules().subscribe({
      next: (res: any) => {
        const list = res?.resources ?? res?.data;
        if (Array.isArray(list) && list.length) this.rules.set(list);
      },
      error: () => {
        /* giữ nguyên rule mặc định nếu API chưa sẵn sàng */
      },
    });
  }

  toggleRule(rule: AlertRule): void {
    const target = !rule.enabled;
    // Cập nhật ngay trên UI (optimistic)
    this.rules.update((list) =>
      list.map((r) => (r.code === rule.code ? { ...r, enabled: target } : r))
    );
    this.service.toggleRule(rule.code, target).subscribe({
      error: () => {
        // Khôi phục nếu lỗi
        this.rules.update((list) =>
          list.map((r) => (r.code === rule.code ? { ...r, enabled: rule.enabled } : r))
        );
      },
    });
  }

  ruleIcon(code: string): 'stock' | 'warehouse' | 'expiry' {
    if (code === 'WAREHOUSE_CAPACITY') return 'warehouse';
    if (code === 'EXPIRY_SOON') return 'expiry';
    return 'stock';
  }

  // ── Helpers hiển thị 1 dòng cảnh báo ─────────────────────────────────────────
  isUnread(row: AlertRow): boolean {
    return row.status === 'OPEN';
  }

  /** Phân loại cảnh báo dựa trên alertType (khoan dung nhiều biến thể tên). */
  badgeKind(alertType: string | null | undefined): string {
    const a = (alertType || '').toUpperCase();
    if (a.includes('SYSTEM') || a.includes('STOCKTAKE') || a.includes('AUDIT') || a.includes('MILLING'))
      return 'system';
    if (a.includes('INBOUND') || a.includes('INTAKE') || a.includes('RECEIPT') || a.includes('PURCHASE') || a.includes('BOTTLENECK'))
      return 'inbound';
    if (a.includes('OUTBOUND') || a.includes('SALES') || a.includes('DELIVERY') || a.includes('SHIP'))
      return 'outbound';
    if (a.includes('CAPACITY') || a.includes('WAREHOUSE') || a.includes('OCCUP') || a.includes('FULL'))
      return 'warehouse';
    if (a.includes('STOCK') || a.includes('EXPIR') || a.includes('LOT') || a.includes('QUALITY'))
      return 'stock';
    return 'other';
  }

  badgeLabel(row: AlertRow): string {
    switch (this.badgeKind(row.alertType)) {
      case 'stock': return 'Tồn kho';
      case 'warehouse': return 'Kho hàng';
      case 'inbound': return 'Nhập kho';
      case 'outbound': return 'Xuất kho';
      case 'system': return 'Hệ thống';
      default: return 'Khác';
    }
  }

  badgeClass(row: AlertRow): string {
    return 'b-' + this.badgeKind(row.alertType);
  }

  /** Loại icon tròn bên trái dòng. */
  iconKind(row: AlertRow): 'alert' | 'bell' | 'box' | 'check' | 'info' {
    const bk = this.badgeKind(row.alertType);
    if (row.severity === 'CRITICAL') return 'alert';
    if (bk === 'system') return 'check';
    if (bk === 'inbound' || bk === 'outbound') return 'box';
    if (row.severity === 'WARNING') return 'bell';
    return 'info';
  }

  iconClass(row: AlertRow): string {
    const k = this.iconKind(row);
    if (k === 'alert') return 'i-red';
    if (k === 'bell') return 'i-amber';
    if (k === 'check') return 'i-green';
    return 'i-blue';
  }

  /** Tiêu đề (dòng đậm) — suy ra từ loại + mức độ. */
  alertTitle(row: AlertRow): string {
    const bk = this.badgeKind(row.alertType);
    const a = (row.alertType || '').toUpperCase();
    switch (bk) {
      case 'stock':
        if (a.includes('EXPIR')) return 'Hàng sắp hết hạn';
        return row.severity === 'CRITICAL' ? 'Hết hàng sắp xảy ra' : 'Tồn kho thấp';
      case 'warehouse':
        return row.warehouseName ? `${row.warehouseName} gần đầy` : 'Kho gần đầy';
      case 'inbound': return 'Phiếu nhập chờ duyệt';
      case 'outbound': return 'Phiếu xuất chờ duyệt';
      case 'system': return 'Cập nhật hệ thống';
      default:
        return row.severity === 'CRITICAL'
          ? 'Cảnh báo nghiêm trọng'
          : row.severity === 'WARNING'
          ? 'Cảnh báo'
          : 'Thông tin';
    }
  }

  alertSubtitle(row: AlertRow): string {
    return row.message || '';
  }

  relativeTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    const diff = Date.now() - then;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} ngày trước`;
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
}
