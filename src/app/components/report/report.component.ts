import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  ReportColumn,
  ReportFilterOptions,
  ReportOverview,
  ReportPage,
  ReportQueryParams,
  ReportTab,
} from '../../models';
import { ReportService } from '../../services/report.service';

interface ReportTabConfig {
  id: ReportTab;
  label: string;
  title: string;
  columns: ReportColumn[];
}

interface ReportFilters {
  fromDate: string;
  toDate: string;
  warehouseId: number | null;
  riceVarietyId: number | null;
  productVariantId: number | null;
  paddyLotId: number | null;
  locationId: number | null;
  farmerId: number | null;
  customerId: number | null;
  productType: string | null;
  channel: string | null;
  status: string | null;
}

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent, HasPermissionDirective],
  templateUrl: './report.component.html',
  styleUrl: './report.component.css',
})
export class ReportComponent {
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);

  readonly tabs: ReportTabConfig[] = [
    { id: 'overview', label: 'Tổng quan', title: 'Tổng quan báo cáo', columns: [] },
    {
      id: 'stock',
      label: 'Tồn kho',
      title: 'Báo cáo tồn kho lúa/gạo',
      columns: [
        { key: 'lotCode', label: 'Mã lô', strong: true },
        { key: 'sku', label: 'SKU' },
        { key: 'productVariant', label: 'Loại hàng' },
        { key: 'warehouse', label: 'Kho' },
        { key: 'locations', label: 'Khu/cột' },
        { key: 'bagCount', label: 'Số bao', kind: 'number' },
        { key: 'onHandKg', label: 'Tồn', kind: 'weight', strong: true },
        { key: 'availableKg', label: 'Khả dụng', kind: 'weight' },
        { key: 'reservedKg', label: 'Đã giữ', kind: 'weight' },
        { key: 'quarantinedKg', label: 'Cách ly', kind: 'weight' },
        { key: 'lotStatus', label: 'Chất lượng', kind: 'status' },
      ],
    },
    {
      id: 'purchase',
      label: 'Thu mua',
      title: 'Báo cáo thu mua lúa',
      columns: [
        { key: 'receiptDate', label: 'Ngày', kind: 'date' },
        { key: 'receiptCode', label: 'Mã phiếu', strong: true },
        { key: 'farmerName', label: 'Nông dân' },
        { key: 'riceVarietyName', label: 'Giống' },
        { key: 'weightKg', label: 'Khối lượng cân', kind: 'weight' },
        { key: 'acceptedWeightKg', label: 'Thực nhận', kind: 'weight', strong: true },
        { key: 'rejectedWeightKg', label: 'Trả lại', kind: 'weight' },
        { key: 'unitPrice', label: 'Đơn giá', kind: 'money' },
        { key: 'totalAmount', label: 'Tổng tiền', kind: 'money' },
        { key: 'paidAmount', label: 'Đã trả', kind: 'money' },
        { key: 'debtAmount', label: 'Còn nợ', kind: 'money' },
        { key: 'refundReceivableAmount', label: 'Phải thu lại', kind: 'money' },
        { key: 'debtDueDate', label: 'Hạn thanh toán', kind: 'date' },
        { key: 'qcFinalizedAt', label: 'QC chốt lúc', kind: 'date' },
        { key: 'qualitySummary', label: 'Chất lượng' },
      ],
    },
    {
      id: 'milling-loss',
      label: 'Xay xát & hao hụt',
      title: 'Báo cáo xay xát và hao hụt',
      columns: [
        { key: 'completedAt', label: 'Hoàn tất', kind: 'date' },
        { key: 'millingCode', label: 'Mã lệnh xay', strong: true },
        { key: 'warehouseName', label: 'Kho' },
        { key: 'computedPaddyKg', label: 'Lúa vào', kind: 'weight' },
        { key: 'totalRiceOutputKg', label: 'Gạo ra', kind: 'weight', strong: true },
        { key: 'byproductKg', label: 'Phụ phẩm', kind: 'weight' },
        { key: 'lossKg', label: 'Hao hụt', kind: 'weight' },
        { key: 'actualYieldRate', label: 'Tỷ lệ thu hồi', kind: 'percent' },
        { key: 'totalCost', label: 'Tổng giá vốn', kind: 'money' },
      ],
    },
    {
      id: 'sales',
      label: 'Bán hàng',
      title: 'Báo cáo bán hàng offline',
      columns: [
        { key: 'orderDate', label: 'Ngày', kind: 'date' },
        { key: 'soCode', label: 'Mã đơn', strong: true },
        { key: 'customerName', label: 'Khách hàng' },
        { key: 'channel', label: 'Kênh', kind: 'status' },
        { key: 'itemSummary', label: 'SKU' },
        { key: 'totalWeightKg', label: 'Khối lượng', kind: 'weight' },
        { key: 'totalAmount', label: 'Doanh thu', kind: 'money', strong: true },
        { key: 'amountCollected', label: 'Đã thu', kind: 'money' },
        { key: 'outstandingAmount', label: 'Còn nợ', kind: 'money' },
      ],
    },
    {
      id: 'two-way-debt',
      label: 'Công nợ',
      title: 'Báo cáo công nợ hai chiều',
      columns: [
        { key: 'direction', label: 'Loại', kind: 'status' },
        { key: 'partyName', label: 'Đối tượng', strong: true },
        { key: 'documentCode', label: 'Chứng từ' },
        { key: 'totalAmount', label: 'Tổng tiền', kind: 'money' },
        { key: 'paidAmount', label: 'Đã thanh toán', kind: 'money' },
        { key: 'outstandingAmount', label: 'Còn nợ', kind: 'money', strong: true },
        { key: 'dueDate', label: 'Hạn thanh toán', kind: 'date' },
        { key: 'status', label: 'Trạng thái', kind: 'status' },
      ],
    },
    {
      id: 'quality',
      label: 'Chất lượng',
      title: 'Báo cáo chất lượng và cách ly',
      columns: [
        { key: 'lotCode', label: 'Mã lô', strong: true },
        { key: 'productVariantName', label: 'Loại hàng' },
        { key: 'warehouseName', label: 'Kho' },
        { key: 'location', label: 'Vị trí' },
        { key: 'affectedWeightKg', label: 'Tồn ảnh hưởng', kind: 'weight' },
        { key: 'riskSummary', label: 'Rủi ro chính' },
        { key: 'severity', label: 'Mức độ', kind: 'status' },
        { key: 'qualityStatus', label: 'Trạng thái', kind: 'status' },
        { key: 'recommendation', label: 'Đề xuất' },
      ],
    },
    {
      id: 'relative-profit',
      label: 'Lãi/lỗ tương đối',
      title: 'Báo cáo lãi/lỗ tương đối',
      columns: [
        { key: 'periodLabel', label: 'Kỳ báo cáo', strong: true },
        { key: 'revenue', label: 'Doanh thu', kind: 'money' },
        { key: 'paddyCost', label: 'Giá vốn lúa', kind: 'money' },
        { key: 'millingCost', label: 'Chi phí xay', kind: 'money' },
        { key: 'relativeProfit', label: 'Lợi nhuận tương đối', kind: 'money', strong: true },
        { key: 'marginPercent', label: 'Tỷ suất', kind: 'percent' },
      ],
    },
    {
      id: 'source-effectiveness',
      label: 'Nguồn mua',
      title: 'Phân tích hiệu quả nguồn mua',
      columns: [
        { key: 'farmerName', label: 'Nông dân/nguồn', strong: true },
        { key: 'purchasedKg', label: 'Tổng kg mua', kind: 'weight' },
        { key: 'averagePurchasePrice', label: 'Giá mua TB', kind: 'money' },
        { key: 'riskLotCount', label: 'Số lô rủi ro', kind: 'number' },
        { key: 'relatedRevenue', label: 'Doanh thu liên quan', kind: 'money' },
        { key: 'relativeProfit', label: 'Lợi nhuận tương đối', kind: 'money' },
        { key: 'assessment', label: 'Đánh giá', kind: 'status' },
      ],
    },
  ];

  activeTab = signal<ReportTab>('overview');
  page = signal(1);
  pageSize = signal(20);
  chartExpanded = signal(true);
  exporting = signal(false);

  filters = signal<ReportFilters>({
    fromDate: this.firstDayOfMonth(),
    toDate: this.today(),
    warehouseId: null,
    riceVarietyId: null,
    productVariantId: null,
    paddyLotId: null,
    locationId: null,
    farmerId: null,
    customerId: null,
    productType: null,
    channel: null,
    status: null,
  });

  readonly productTypes = [
    { id: 'PADDY', name: 'Lúa' },
    { id: 'RICE', name: 'Gạo' },
    { id: 'BYPRODUCT', name: 'Tấm/cám/phụ phẩm' },
  ];
  readonly channels = [
    { id: 'DIRECT', name: 'Trực tiếp' },
    { id: 'WHOLESALE', name: 'Nhà buôn' },
  ];
  readonly debtStatuses = [
    { id: 'UNPAID', name: 'Chưa thanh toán' },
    { id: 'PARTIAL', name: 'Thanh toán một phần' },
    { id: 'OVERDUE', name: 'Quá hạn' },
    { id: 'PAID', name: 'Đã thanh toán' },
  ];

  dateError = computed(() =>
    this.filters().fromDate > this.filters().toDate
      ? 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'
      : ''
  );

  private queryParams = computed<ReportQueryParams>(() => ({
    ...this.filters(),
    pageIndex: this.page(),
    pageSize: this.pageSize(),
    sortDirection: 'desc',
  }));

  optionsQuery = injectQuery(() => ({
    queryKey: ['report-filter-options'],
    queryFn: () => lastValueFrom(this.reportService.getFilterOptions()),
    staleTime: 5 * 60_000,
  }));

  overviewQuery = injectQuery(() => ({
    queryKey: ['reports', 'overview', this.queryParams()],
    enabled: this.activeTab() === 'overview' && !this.dateError(),
    queryFn: () => lastValueFrom(this.reportService.getOverview(this.queryParams())),
  }));

  reportQuery = injectQuery(() => ({
    queryKey: ['reports', this.activeTab(), this.queryParams()],
    enabled: this.activeTab() !== 'overview' && !this.dateError(),
    queryFn: () => {
      const type = this.activeTab();
      if (type === 'overview') throw new Error('Tab tổng quan không dùng API bảng.');
      return lastValueFrom(this.reportService.getReport(type, this.queryParams()));
    },
  }));

  options = computed<ReportFilterOptions>(() =>
    (this.optionsQuery.data() as any)?.resources ?? {
      warehouses: [],
      riceVarieties: [],
      productVariants: [],
      paddyLots: [],
      locations: [],
      farmers: [],
      customers: [],
    }
  );

  overview = computed<ReportOverview | null>(
    () => (this.overviewQuery.data() as any)?.resources ?? null
  );

  reportPage = computed<ReportPage>(() =>
    (this.reportQuery.data() as any)?.resources ?? {
      dataSource: [],
      total: 0,
      totalFiltered: 0,
      currentPage: 1,
      pageSize: this.pageSize(),
      totalPages: 0,
      chart: [],
    }
  );

  currentTab = computed(
    () => this.tabs.find((tab) => tab.id === this.activeTab()) ?? this.tabs[0]
  );
  rows = computed(() => this.reportPage().dataSource ?? []);
  loading = computed(() =>
    this.activeTab() === 'overview'
      ? this.overviewQuery.isPending()
      : this.reportQuery.isPending()
  );
  loadError = computed(() =>
    this.activeTab() === 'overview'
      ? this.overviewQuery.isError()
      : this.reportQuery.isError()
  );

  chartBars = computed(() => {
    const points = this.reportPage().chart ?? [];
    const max = Math.max(...points.map((x) => Math.abs(x.value ?? 0)), 1);
    return points.slice(0, 12).map((x) => ({
      ...x,
      width: Math.max(3, Math.round((Math.abs(x.value ?? 0) / max) * 100)),
    }));
  });

  overviewCards = computed(() => {
    const o = this.overview();
    if (!o) return [];
    return [
      { label: 'Tồn lúa hiện tại', value: this.formatWeight(o.paddyOnHandKg), tone: 'green' },
      { label: 'Tồn gạo thành phẩm', value: this.formatWeight(o.riceOnHandKg), tone: 'amber' },
      { label: 'Tồn cách ly', value: this.formatWeight(o.quarantinedKg), tone: 'red' },
      { label: 'Đơn chờ giao', value: `${o.pendingDeliveryCount} đơn`, tone: 'blue' },
      { label: 'Lợi nhuận tương đối', value: this.formatMoney(o.relativeProfit), tone: 'purple' },
      { label: 'Doanh thu trong kỳ', value: this.formatMoney(o.revenue), tone: 'green' },
      { label: 'Phải thu khách', value: this.formatMoney(o.customerReceivable), tone: 'green' },
      { label: 'Phải trả nông dân', value: this.formatMoney(o.farmerPayable), tone: 'red' },
      { label: 'Cảnh báo chất lượng', value: `${o.qualityAlertCount} lô`, tone: 'amber' },
      { label: 'Nguồn mua không rủi ro', value: `${o.goodSourceCount}/${o.totalSourceCount}`, tone: 'green' },
    ];
  });

  selectTab(tab: ReportTab): void {
    this.activeTab.set(tab);
    this.page.set(1);
  }

  setFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
    this.page.set(1);
  }

  clearFilters(): void {
    this.filters.set({
      fromDate: this.firstDayOfMonth(),
      toDate: this.today(),
      warehouseId: null,
      riceVarietyId: null,
      productVariantId: null,
      paddyLotId: null,
      locationId: null,
      farmerId: null,
      customerId: null,
      productType: null,
      channel: null,
      status: null,
    });
    this.page.set(1);
  }

  setPage(value: number): void {
    const max = Math.max(1, this.reportPage().totalPages || 1);
    this.page.set(Math.min(Math.max(1, value), max));
  }

  retry(): void {
    if (this.activeTab() === 'overview') this.overviewQuery.refetch();
    else this.reportQuery.refetch();
  }

  async export(format: 'xlsx' | 'csv'): Promise<void> {
    const type = this.activeTab();
    if (type === 'overview') {
      await Swal.fire('Chọn báo cáo chi tiết', 'Hãy mở một tab báo cáo trước khi xuất file.', 'info');
      return;
    }
    if (this.dateError()) return;

    this.exporting.set(true);
    try {
      const blob = await lastValueFrom(
        this.reportService.exportReport(type, format, this.queryParams())
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bao-cao-${type}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      await Swal.fire({
        icon: 'success',
        title: 'Đã tải xuống báo cáo xuất dữ liệu.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error: any) {
      await Swal.fire('Không thể xuất báo cáo', error?.error?.message || 'Vui lòng thử lại.', 'error');
    } finally {
      this.exporting.set(false);
    }
  }

  openSource(row: Record<string, any>): void {
    const tab = this.activeTab();
    if (tab === 'stock' && row['lotId'])
      this.router.navigate(['/admin/paddy-lots'], { queryParams: { lotId: row['lotId'] } });
    else if (tab === 'purchase' && row['receiptId'])
      this.router.navigate(['/admin/rice-purchase'], { queryParams: { receiptId: row['receiptId'] } });
    else if (tab === 'milling-loss' && row['millingOrderId'])
      this.router.navigate(['/admin/milling-orders'], { queryParams: { id: row['millingOrderId'] } });
    else if (tab === 'sales' && row['salesOrderId'])
      this.router.navigate(['/admin/sales-orders'], { queryParams: { id: row['salesOrderId'] } });
    else if (tab === 'quality' && row['lotId'])
      this.router.navigate(['/admin/quality-inspections'], { queryParams: { lotId: row['lotId'] } });
    else if (tab === 'two-way-debt' && row['refId'])
      this.router.navigate(['/admin/party-debts'], { queryParams: { refType: row['refType'], refId: row['refId'] } });
  }

  isRowClickable(row: Record<string, any>): boolean {
    return !!(
      row['lotId'] ||
      row['receiptId'] ||
      row['millingOrderId'] ||
      row['salesOrderId'] ||
      row['refId']
    );
  }

  displayCell(row: Record<string, any>, column: ReportColumn): string {
    const value = row[column.key];
    if (value === null || value === undefined || value === '') return '—';
    switch (column.kind) {
      case 'date':
        return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
      case 'weight':
        return this.formatWeight(Number(value));
      case 'money':
        return this.formatMoney(Number(value));
      case 'percent': {
        const number = Number(value);
        const normalized = Math.abs(number) <= 1 ? number * 100 : number;
        return `${this.formatNumber(normalized)}%`;
      }
      case 'number':
        return this.formatNumber(Number(value), 0);
      case 'status':
        return this.statusLabel(String(value));
      default:
        return String(value);
    }
  }

  statusClass(value: unknown): string {
    const normalized = String(value ?? '').toUpperCase();
    if (/OVERDUE|HIGH|QUARANTINE|CÁCH LY|PAYABLE|CÓ RỦI RO/.test(normalized)) return 'danger';
    if (/PARTIAL|MEDIUM|UNPAID|WARNING|CHỜ/.test(normalized)) return 'warning';
    if (/PAID|LOW|COMPLETED|RECEIVABLE|KHÔNG GHI NHẬN/.test(normalized)) return 'success';
    return 'neutral';
  }

  private statusLabel(value: string): string {
    const labels: Record<string, string> = {
      DIRECT: 'Trực tiếp',
      WHOLESALE: 'Nhà buôn',
      PAYABLE: 'Phải trả',
      RECEIVABLE: 'Phải thu',
      PAID: 'Đã thanh toán',
      PARTIAL: 'Thanh toán một phần',
      UNPAID: 'Chưa thanh toán',
      OVERDUE: 'Quá hạn',
      HIGH: 'Cao',
      MEDIUM: 'Trung bình',
      LOW: 'Thấp',
    };
    return labels[value.toUpperCase()] ?? value;
  }

  private formatWeight(value: number): string {
    if (Math.abs(value) >= 1000) return `${this.formatNumber(value / 1000)} t`;
    return `${this.formatNumber(value)} kg`;
  }

  private formatMoney(value: number): string {
    if (Math.abs(value) >= 1_000_000)
      return `${this.formatNumber(value / 1_000_000)} tr`;
    return `${new Intl.NumberFormat('vi-VN').format(value || 0)} đ`;
  }

  private formatNumber(value: number, digits = 1): string {
    return new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(value || 0);
  }

  private today(): string {
    return this.localDate(new Date());
  }

  private firstDayOfMonth(): string {
    const now = new Date();
    return this.localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  private localDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
