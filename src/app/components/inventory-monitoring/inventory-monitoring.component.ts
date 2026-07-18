import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';

import {
  InventoryRow,
  InventoryStockSummary,
  InventoryTransactionRow,
  AlertRow,
} from '../../models';
import { InventoryService } from '../../services/inventory.service';
import { InventoryTransactionService } from '../../services/inventory-transaction.service';
import { AlertService } from '../../services/alert.service';
import { WarehouseService } from '../../services/warehouse.service';
import { ProductCategoryService } from '../../services/product-category.service';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

interface CategoryTab {
  id: number | null;
  name: string;
}

interface WarehouseOption {
  id: number;
  name: string;
  code?: string;
}

/**
 * Màn "Tồn kho lúa/gạo" (Giám sát tồn kho — SCR).
 * - 5 thẻ KPI theo trạng thái (Tồn thực tế / Khả dụng / Đã giữ / Đang xử lý / Cách ly)
 * - Bảng tồn theo lô/cột/khu (+ tab lọc Lúa/Gạo/Tấm/Cám/Trấu)
 * - Panel Cảnh báo tồn kho + Lịch sử InventoryTransaction
 *
 * Realtime: dữ liệu lấy qua TanStack Query. Khi server (SignalR) báo Inventory/
 * InventoryTransaction/Alert thay đổi, RealtimeService invalidate các queryKey
 * ['inventories'|'inventory-summary'|'inventory-transactions'|'alerts'] -> tự refetch.
 */
@Component({
  selector: 'app-inventory-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './inventory-monitoring.component.html',
  styleUrl: './inventory-monitoring.component.css',
})
export class InventoryMonitoringComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly txService = inject(InventoryTransactionService);
  private readonly alertService = inject(AlertService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly categoryService = inject(ProductCategoryService);

  // ----- Bộ lọc / phân trang -----
  warehouseId = signal<number | null>(null);
  activeCategoryId = signal<number | null>(null); // null = Tất cả
  searchInput = signal(''); // giá trị gõ trực tiếp (binding ô tìm)
  search = signal(''); // giá trị đã debounce (dùng trong queryKey)
  page = signal(1);
  pageSize = signal(10);
  sortField = signal('id');
  sortDir = signal<'asc' | 'desc'>('desc');

  private searchTimer: any = null;

  private readonly colMap: Record<string, number> = {
    lotCode: 0,
    categoryName: 1,
    warehouseName: 2,
    bags: 3,
    quantityOnHand: 4,
    quantityAvailable: 5,
    quantityReserved: 6,
    costPrice: 7,
    id: 8,
  };

  // ========== TanStack Queries (realtime qua invalidateQueries) ==========

  /** Danh sách kho (dropdown) — realtime theo key 'warehouse-options'. */
  private warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouse-options'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
    staleTime: 60_000,
  }));

  /** Danh mục (tab lọc) — realtime theo key 'product-category-options'. */
  private categoriesQuery = injectQuery(() => ({
    queryKey: ['product-category-options'],
    queryFn: () => lastValueFrom(this.categoryService.getAll()),
    staleTime: 60_000,
  }));

  /** 5 thẻ KPI — realtime theo key 'inventory-summary'. */
  private summaryQuery = injectQuery(() => ({
    queryKey: [
      'inventory-summary',
      this.warehouseId(),
      this.activeCategoryId(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.inventoryService.getSummary({
          warehouseId: this.warehouseId(),
          productCategoryId: this.activeCategoryId(),
          lotType: null,
        })
      ),
  }));

  /** Bảng tồn theo lô — realtime theo key 'inventories'. */
  private listQuery = injectQuery(() => ({
    queryKey: [
      'inventories',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.warehouseId(),
      this.activeCategoryId(),
    ],
    queryFn: () => {
      const body = this.inventoryService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        warehouseId: this.warehouseId(),
        productCategoryId: this.activeCategoryId(),
      });
      return lastValueFrom(this.inventoryService.getPagedAdvanced(body));
    },
  }));

  /** Cảnh báo tồn kho — realtime theo key 'alerts'. */
  private alertsQuery = injectQuery(() => ({
    queryKey: ['alerts', 'inventory-monitoring'],
    queryFn: () =>
      lastValueFrom(
        this.alertService.getPagedAdvanced(this.alertService.buildListBody(15))
      ),
  }));

  /** Lịch sử InventoryTransaction — realtime theo key 'inventory-transactions'. */
  private txQuery = injectQuery(() => ({
    queryKey: ['inventory-transactions', this.warehouseId()],
    queryFn: () =>
      lastValueFrom(
        this.txService.getPagedAdvanced(
          this.txService.buildListBody({
            length: 15,
            warehouseId: this.warehouseId(),
          })
        )
      ),
  }));

  // ========== Dữ liệu suy ra từ query ==========

  warehouses = computed<WarehouseOption[]>(
    () => (this.warehousesQuery.data() as any)?.resources ?? []
  );

  categories = computed<CategoryTab[]>(() =>
    ((this.categoriesQuery.data() as any)?.resources ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
    }))
  );

  summary = computed<InventoryStockSummary | null>(
    () => (this.summaryQuery.data() as any)?.resources ?? null
  );

  rows = computed<InventoryRow[]>(() => {
    const r = (this.listQuery.data() as any)?.resources;
    return r?.data ?? [];
  });

  total = computed<number>(() => {
    const r = (this.listQuery.data() as any)?.resources;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  alerts = computed<AlertRow[]>(
    () => (this.alertsQuery.data() as any)?.resources?.data ?? []
  );

  transactions = computed<InventoryTransactionRow[]>(
    () => (this.txQuery.data() as any)?.resources?.data ?? []
  );

  // ----- Trạng thái tải -----
  loadingRows = computed(
    () => this.listQuery.isPending() || this.listQuery.isFetching()
  );
  loadingSummary = computed(() => this.summaryQuery.isPending());
  loadingAlerts = computed(() => this.alertsQuery.isPending());
  loadingTx = computed(() => this.txQuery.isPending());
  errorMsg = computed(() =>
    this.listQuery.isError() ? 'Không tải được danh sách tồn kho.' : null
  );

  // ----- Tabs / options -----
  readonly tabs = computed<CategoryTab[]>(() => [
    { id: null, name: 'Tất cả' },
    ...this.categories(),
  ]);

  readonly warehouseOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({ id: w.id, name: w.name }))
  );

  readonly pageSizeOptions: FilterSelectOption[] = [
    { id: 5, name: '5 / trang' },
    { id: 10, name: '10 / trang' },
    { id: 20, name: '20 / trang' },
    { id: 50, name: '50 / trang' },
  ];

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );

  // ---------- Tương tác (chỉ set signal -> query tự refetch) ----------

  onWarehouseChange(value: number | null): void {
    this.warehouseId.set(value != null ? Number(value) : null);
    this.page.set(1);
  }

  selectTab(id: number | null): void {
    if (this.activeCategoryId() === id) return;
    this.activeCategoryId.set(id);
    this.page.set(1);
  }

  onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.search.set(value.trim());
    }, 350);
  }

  setPage(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.page()) return;
    this.page.set(p);
  }

  setPageSize(value: string | number): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
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

  sort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
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

  // ---------- Định dạng / hiển thị ----------

  /** Giá trị thẻ KPI: ưu tiên tấn (từ khối lượng kg); nếu chưa cấu hình KL thì hiện số lượng. */
  kpiValue(weightKg: number, qty: number): string {
    if (weightKg && weightKg > 0) {
      const t = weightKg / 1000;
      return t >= 100 ? this.fmtNum(t, 0) : this.fmtNum(t, 1);
    }
    return this.fmtNum(qty ?? 0, 0);
  }

  kpiUnit(weightKg: number): string {
    return weightKg && weightKg > 0 ? 't' : 'đv';
  }

  fmtNum(n: number | null | undefined, digits = 0): string {
    const v = Number(n ?? 0);
    return v.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  fmtMoney(n: number | null | undefined): string {
    return `${this.fmtNum(n, 0)}đ`;
  }

  fmtDate(d: string | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const pad = (x: number) => `${x}`.padStart(2, '0');
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  /** Đơn vị hiển thị cho số lượng của 1 dòng. */
  unitOf(row: InventoryRow): string {
    return row.unitName?.trim() || 'đv';
  }

  /** Nhãn loại theo lô hoặc danh mục. */
  typeLabel(row: InventoryRow): string {
    return row.categoryName?.trim() || this.lotTypeLabel(row.lotType);
  }

  lotTypeLabel(lotType: string | null | undefined): string {
    switch ((lotType || '').toUpperCase()) {
      case 'PADDY':
        return 'Lúa';
      case 'RICE':
        return 'Gạo';
      case 'BYPRODUCT':
        return 'Phụ phẩm';
      case 'PURCHASED_GOOD':
        return 'Hàng mua ngoài';
      default:
        return '—';
    }
  }

  /** Màu badge trạng thái lô (fallback theo tồn khả dụng/giữ). */
  statusColor(row: InventoryRow): string {
    if (row.lotStatusColor) return row.lotStatusColor;
    if (row.quantityQuarantine > 0) return '#EF4444';
    if (row.quantityProcessing > 0) return '#F59E0B';
    if (row.quantityReserved > 0) return '#F59E0B';
    return '#10B981';
  }

  statusLabel(row: InventoryRow): string {
    if (row.lotStatusName) return row.lotStatusName;
    if (row.quantityQuarantine > 0) return 'Cách ly';
    if (row.quantityProcessing > 0) return 'Đang xử lý';
    if (row.quantityReserved > 0) return 'Đã giữ';
    return 'Khả dụng';
  }

  // ----- Cảnh báo -----
  alertSeverityClass(sev: string | null | undefined): string {
    switch ((sev || '').toUpperCase()) {
      case 'CRITICAL':
        return 'sev-critical';
      case 'WARNING':
        return 'sev-warning';
      default:
        return 'sev-info';
    }
  }

  alertTypeLabel(type: string | null | undefined): string {
    switch ((type || '').toUpperCase()) {
      case 'LOW_STOCK':
        return 'Sắp hết hàng';
      case 'BOTTLENECK':
        return 'Nghẽn xử lý';
      default:
        return type || 'Cảnh báo';
    }
  }

  // ----- Giao dịch -----
  txLabel(type: string | null | undefined): string {
    switch ((type || '').toUpperCase()) {
      case 'IMPORT':
        return 'Nhập kho';
      case 'EXPORT':
        return 'Xuất giao';
      case 'STOCKTAKE_ADJUST':
        return 'Điều chỉnh kiểm kê';
      case 'MANUAL_ADJUST':
        return 'Điều chỉnh thủ công';
      case 'RESERVE':
        return 'Giữ hàng';
      case 'RELEASE_RESERVE':
        return 'Bỏ giữ hàng';
      default:
        return type || 'Giao dịch';
    }
  }

  txSign(row: InventoryTransactionRow): string {
    const q = Number(row.quantity ?? 0);
    if (q > 0) return `+${this.fmtNum(q, 2)}`;
    return this.fmtNum(q, 2);
  }

  txDirClass(row: InventoryTransactionRow): string {
    const t = (row.transactionType || '').toUpperCase();
    if (t === 'IMPORT') return 'tx-in';
    if (t === 'EXPORT') return 'tx-out';
    if (Number(row.quantity ?? 0) >= 0) return 'tx-in';
    return 'tx-out';
  }

  trackRow = (_: number, r: InventoryRow) => r.id;
  trackAlert = (_: number, a: AlertRow) => a.id;
  trackTx = (_: number, t: InventoryTransactionRow) => t.id;
}
