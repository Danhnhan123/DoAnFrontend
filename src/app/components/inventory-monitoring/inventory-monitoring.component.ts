import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';

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
 * Tất cả dữ liệu lấy từ API backend đã có/bổ sung.
 */
@Component({
  selector: 'app-inventory-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-monitoring.component.html',
  styleUrl: './inventory-monitoring.component.css',
})
export class InventoryMonitoringComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly txService = inject(InventoryTransactionService);
  private readonly alertService = inject(AlertService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly categoryService = inject(ProductCategoryService);

  // ----- Dữ liệu -----
  summary = signal<InventoryStockSummary | null>(null);
  rows = signal<InventoryRow[]>([]);
  alerts = signal<AlertRow[]>([]);
  transactions = signal<InventoryTransactionRow[]>([]);
  warehouses = signal<WarehouseOption[]>([]);
  categories = signal<CategoryTab[]>([]);

  // ----- Trạng thái tải -----
  loadingRows = signal(false);
  loadingSummary = signal(false);
  loadingAlerts = signal(false);
  loadingTx = signal(false);
  errorMsg = signal<string | null>(null);

  // ----- Bộ lọc / phân trang -----
  warehouseId = signal<number | null>(null);
  activeCategoryId = signal<number | null>(null); // null = Tất cả
  search = signal('');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  sortField = signal('id');
  sortDir = signal<'asc' | 'desc'>('desc');

  private searchTimer: any = null;

  readonly tabs = computed<CategoryTab[]>(() => [
    { id: null, name: 'Tất cả' },
    ...this.categories(),
  ]);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );

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

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadWarehouses(), this.loadCategories()]);
    await this.reloadAll();
  }

  // ---------- Loaders ----------

  private async loadWarehouses(): Promise<void> {
    try {
      const res = await lastValueFrom(this.warehouseService.getAll());
      this.warehouses.set((res?.resources as WarehouseOption[]) ?? []);
    } catch {
      this.warehouses.set([]);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const res = await lastValueFrom(this.categoryService.getAll());
      const list = (res?.resources as any[]) ?? [];
      this.categories.set(list.map((c) => ({ id: c.id, name: c.name })));
    } catch {
      this.categories.set([]);
    }
  }

  async loadSummary(): Promise<void> {
    this.loadingSummary.set(true);
    try {
      const res = await lastValueFrom(
        this.inventoryService.getSummary({
          warehouseId: this.warehouseId(),
          productCategoryId: this.activeCategoryId(),
          lotType: null,
        })
      );
      this.summary.set(res?.resources ?? null);
    } catch {
      this.summary.set(null);
    } finally {
      this.loadingSummary.set(false);
    }
  }

  async loadRows(): Promise<void> {
    this.loadingRows.set(true);
    this.errorMsg.set(null);
    try {
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
      const res = await lastValueFrom(
        this.inventoryService.getPagedAdvanced(body)
      );
      const r = res?.resources as any;
      this.rows.set(r?.data ?? []);
      this.total.set(r?.recordsFiltered ?? r?.recordsTotal ?? 0);
    } catch (e) {
      this.rows.set([]);
      this.total.set(0);
      this.errorMsg.set('Không tải được danh sách tồn kho.');
    } finally {
      this.loadingRows.set(false);
    }
  }

  async loadAlerts(): Promise<void> {
    this.loadingAlerts.set(true);
    try {
      const body = this.alertService.buildListBody(15);
      const res = await lastValueFrom(this.alertService.getPagedAdvanced(body));
      const r = res?.resources as any;
      this.alerts.set(r?.data ?? []);
    } catch {
      this.alerts.set([]);
    } finally {
      this.loadingAlerts.set(false);
    }
  }

  async loadTransactions(): Promise<void> {
    this.loadingTx.set(true);
    try {
      const body = this.txService.buildListBody({
        length: 15,
        warehouseId: this.warehouseId(),
      });
      const res = await lastValueFrom(this.txService.getPagedAdvanced(body));
      const r = res?.resources as any;
      this.transactions.set(r?.data ?? []);
    } catch {
      this.transactions.set([]);
    } finally {
      this.loadingTx.set(false);
    }
  }

  async reloadAll(): Promise<void> {
    await Promise.all([
      this.loadSummary(),
      this.loadRows(),
      this.loadAlerts(),
      this.loadTransactions(),
    ]);
  }

  // ---------- Tương tác ----------

  onWarehouseChange(value: string): void {
    this.warehouseId.set(value ? Number(value) : null);
    this.page.set(1);
    void this.reloadAll();
  }

  selectTab(id: number | null): void {
    if (this.activeCategoryId() === id) return;
    this.activeCategoryId.set(id);
    this.page.set(1);
    void this.loadSummary();
    void this.loadRows();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      void this.loadRows();
    }, 350);
  }

  changePage(delta: number): void {
    const next = this.page() + delta;
    if (next < 1 || next > this.totalPages()) return;
    this.page.set(next);
    void this.loadRows();
  }

  sortBy(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    void this.loadRows();
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
