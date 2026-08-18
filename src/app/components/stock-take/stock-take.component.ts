import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectQuery, injectQueryClient, keepPreviousData } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  ApiResponse,
  CreateStockTakePayload,
  InventoryRow,
  LocationRow,
  STOCK_TAKE_STATUS,
  StockTakeDetail,
  StockTakeItem,
  StockTakeRow,
  StockTakeScopeType,
  StockTakeStatusAdvancedRow,
  StockTakeSummary,
  StockTakeThresholds,
  WarehouseRow,
} from '../../models';
import { InventoryService } from '../../services/inventory.service';
import { LocationService } from '../../services/location.service';
import { PermissionService } from '../../services/permission.service';
import { StockTakeStatusService } from '../../services/stock-take-status.service';
import { StockTakeService } from '../../services/stock-take.service';
import { WarehouseService } from '../../services/warehouse.service';
import { FilterSelectComponent, FilterSelectOption } from '../shared/filter-select.component';

interface CountLine {
  id: number;
  actualQuantity: number | null;
  note: string;
  qrScanned: boolean;
  recountConfirmed: boolean;
}

interface CreateForm {
  warehouseId: number | null;
  scopeType: StockTakeScopeType;
  scopeValue: string | number | null;
  note: string;
}

@Component({
  selector: 'app-stock-take',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent, HasPermissionDirective],
  templateUrl: './stock-take.component.html',
  styleUrl: './stock-take.component.css',
})
export class StockTakeComponent implements OnDestroy {
  private readonly service = inject(StockTakeService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly locationService = inject(LocationService);
  private readonly inventoryService = inject(InventoryService);
  private readonly statusService = inject(StockTakeStatusService);
  private readonly queryClient = injectQueryClient();
  readonly perm = inject(PermissionService);
  readonly status = STOCK_TAKE_STATUS;

  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly warehouseFilter = signal<number | null>(null);
  readonly statusFilter = signal<number | null>(null);
  readonly selectedId = signal<number | null>(null);
  readonly showCreate = signal(false);
  readonly saving = signal(false);
  readonly actionLoading = signal(false);
  readonly countLines = signal<CountLine[]>([]);
  readonly createForm = signal<CreateForm>({ warehouseId: null, scopeType: 'WAREHOUSE', scopeValue: null, note: '' });
  private searchTimer?: ReturnType<typeof setTimeout>;

  private readonly warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouse-options', 'stock-take'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
    staleTime: 60_000,
  }));

  private readonly locationsQuery = injectQuery(() => ({
    queryKey: ['location-options', 'stock-take'],
    queryFn: () => lastValueFrom(this.locationService.getAll()),
    staleTime: 60_000,
  }));

  private readonly statusesQuery = injectQuery(() => ({
    queryKey: ['stock-take-status', 'stock-take-options'],
    queryFn: () => lastValueFrom(this.statusService.getPagedAdvanced(
      this.statusService.buildPagedBody({
        page: 1, pageSize: 20, search: '', sortField: 'createdDate', sortDir: 'asc',
        colMap: { code: 1, name: 2, color: 3, createdDate: 4 },
        filterName: '', filterDateFrom: '', filterDateTo: '',
      })
    )),
    staleTime: 60_000,
  }));

  private readonly listQuery = injectQuery(() => ({
    queryKey: ['stock-takes', 'list', this.page(), this.pageSize(), this.search(), this.warehouseFilter(), this.statusFilter()],
    queryFn: () => lastValueFrom(this.service.getPagedAdvanced(this.service.buildPagedBody({
      page: this.page(), pageSize: this.pageSize(), search: this.search(),
      warehouseId: this.warehouseFilter(), statusId: this.statusFilter(),
    }))),
    placeholderData: keepPreviousData,
  }));

  private readonly summaryQuery = injectQuery(() => ({
    queryKey: ['stock-takes', 'summary'],
    queryFn: () => lastValueFrom(this.service.getSummary()),
  }));

  private readonly thresholdsQuery = injectQuery(() => ({
    queryKey: ['stock-takes', 'thresholds'],
    queryFn: () => lastValueFrom(this.service.getThresholds()),
    staleTime: 60_000,
  }));

  private readonly detailQuery = injectQuery(() => ({
    queryKey: ['stock-takes', 'detail', this.selectedId()],
    enabled: this.selectedId() != null,
    queryFn: async () => {
      const id = this.selectedId();
      if (id == null) throw new Error('Chưa chọn phiếu kiểm kê.');
      return lastValueFrom(this.service.getById(id));
    },
  }));

  private readonly scopeInventoriesQuery = injectQuery(() => ({
    queryKey: ['stock-take-scope-inventories', this.createForm().warehouseId],
    enabled: this.showCreate() && !!this.createForm().warehouseId,
    queryFn: () => lastValueFrom(this.inventoryService.getPagedAdvanced(
      this.inventoryService.buildPagedBody({
        page: 1, pageSize: 500, search: '', sortField: 'id', sortDir: 'asc',
        colMap: { lotCode: 0, categoryName: 1, warehouseName: 2, bags: 3, quantityOnHand: 4,
          quantityAvailable: 5, quantityReserved: 6, costPrice: 7, id: 8 },
        warehouseId: this.createForm().warehouseId,
      })
    )),
  }));

  readonly warehouses = computed<WarehouseRow[]>(() => this.resourceArray<WarehouseRow>(this.warehousesQuery.data()).filter(x => x.isActive));
  readonly locations = computed<LocationRow[]>(() => this.resourceArray<LocationRow>(this.locationsQuery.data()).filter(x => x.isActive));
  readonly inventories = computed<InventoryRow[]>(() => (this.scopeInventoriesQuery.data() as ApiResponse<any> | undefined)?.resources?.data ?? []);
  readonly warehouseOptions = computed<FilterSelectOption[]>(() => this.warehouses().map(x => ({ id: x.id, name: `${x.code} — ${x.name}` })));
  readonly statusOptions = computed<FilterSelectOption[]>(() => {
    const response = this.statusesQuery.data() as ApiResponse<any> | undefined;
    const rows: StockTakeStatusAdvancedRow[] = response?.resources?.data ?? [];
    const canonicalOrder = [
      this.status.DRAFT,
      this.status.SUBMITTED,
      this.status.APPROVED,
      this.status.REJECTED,
    ];
    return rows
      .filter(x => canonicalOrder.includes(String(x.code || '').toUpperCase() as typeof canonicalOrder[number]))
      .sort((a, b) =>
        canonicalOrder.indexOf(String(a.code || '').toUpperCase() as typeof canonicalOrder[number]) -
        canonicalOrder.indexOf(String(b.code || '').toUpperCase() as typeof canonicalOrder[number])
      )
      .map(x => ({ id: x.id, name: x.name }));
  });
  readonly scopeTypeOptions: FilterSelectOption[] = [
    { id: 'WAREHOUSE', name: 'Toàn kho' }, { id: 'ZONE', name: 'Theo khu' },
    { id: 'COLUMN', name: 'Theo cột/vị trí' }, { id: 'LOT', name: 'Theo lô' },
    { id: 'SKU', name: 'Theo SKU' },
  ];
  readonly pageSizeOptions: FilterSelectOption[] = [
    { id: 10, name: '10 / trang' }, { id: 20, name: '20 / trang' }, { id: 50, name: '50 / trang' },
  ];

  readonly scopeOptions = computed<FilterSelectOption[]>(() => {
    const warehouseId = this.createForm().warehouseId;
    switch (this.createForm().scopeType) {
      case 'ZONE':
        return [...new Set(this.locations().filter(x => x.warehouseId === warehouseId).map(x => x.zoneName).filter(Boolean))]
          .map(x => ({ id: x, name: x }));
      case 'COLUMN':
        return this.locations().filter(x => x.warehouseId === warehouseId)
          .map(x => ({
            id: x.id,
            name: `${x.isOutboundStaging ? 'Chờ xuất' : x.zoneName} / ${x.slotCode || [x.shelfRow, x.shelfLevel].filter(Boolean).join('-') || `#${x.id}`}`,
          }));
      case 'LOT': {
        const seen = new Set<number>();
        return this.inventories().filter(x => x.paddyLotId && !seen.has(x.paddyLotId) && seen.add(x.paddyLotId))
          .map(x => ({ id: x.paddyLotId, name: x.lotCode || `Lô #${x.paddyLotId}` }));
      }
      case 'SKU': {
        const seen = new Set<number>();
        return this.inventories().filter(x => !seen.has(x.productVariantId) && seen.add(x.productVariantId))
          .map(x => ({ id: x.productVariantId, name: `${x.sku} — ${x.productVariantName}` }));
      }
      default: return [];
    }
  });

  readonly rows = computed<StockTakeRow[]>(() => (this.listQuery.data() as ApiResponse<any> | undefined)?.resources?.data ?? []);
  readonly total = computed(() => Number((this.listQuery.data() as ApiResponse<any> | undefined)?.resources?.recordsFiltered ?? 0));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly summary = computed<StockTakeSummary>(() => (this.summaryQuery.data() as ApiResponse<StockTakeSummary> | undefined)?.resources ?? ({ draftCount: 0, submittedCount: 0, varianceLineCount: 0, netAdjustmentKg: 0 }));
  readonly thresholds = computed<StockTakeThresholds>(() => (this.thresholdsQuery.data() as ApiResponse<StockTakeThresholds> | undefined)?.resources ?? ({ smallVariancePercent: 0.5, mediumVariancePercent: 2, smallVarianceKg: 5, mediumVarianceKg: 20 }));
  readonly detail = computed<StockTakeDetail | null>(() => (this.detailQuery.data() as ApiResponse<StockTakeDetail> | undefined)?.resources ?? null);
  readonly listLoading = computed(() => this.listQuery.isPending() || this.listQuery.isFetching());
  readonly detailLoading = computed(() => this.detailQuery.isPending() || this.detailQuery.isFetching());
  readonly isReadOnlyUser = computed(() => !this.perm.canCreate('STOCKTAKE') && !this.perm.canUpdate('STOCKTAKE') && !this.perm.canApprove('STOCKTAKE'));
  readonly canEditDetail = computed(() =>
    this.isStatus(this.detail()?.stockTakeStatusCode, this.status.DRAFT) &&
    this.perm.canUpdate('STOCKTAKE')
  );

  constructor() {
    effect(() => {
      const current = this.detail();
      if (!current || current.id !== this.selectedId()) return;
      this.countLines.set(current.stockTakeItems.map(item => ({
        id: item.id,
        actualQuantity: item.actualQuantity == null ? null : Number(item.actualQuantity),
        note: item.note || '',
        qrScanned: item.qrScanned,
        recountConfirmed: item.recountConfirmed,
      })));
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void { if (this.searchTimer) clearTimeout(this.searchTimer); }

  onSearch(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.search.set(value.trim()); this.page.set(1); }, 350);
  }
  setWarehouseFilter(value: number | null): void { this.warehouseFilter.set(value); this.page.set(1); }
  setStatusFilter(value: number | null): void { this.statusFilter.set(value); this.page.set(1); }
  changePage(next: number): void { if (next >= 1 && next <= this.totalPages()) this.page.set(next); }
  changePageSize(value: number): void { this.pageSize.set(Number(value) || 10); this.page.set(1); }
  openDetail(id: number): void { this.selectedId.set(id); }
  closeDetail(): void { if (!this.actionLoading()) this.selectedId.set(null); }

  openCreateForm(): void {
    this.createForm.set({ warehouseId: null, scopeType: 'WAREHOUSE', scopeValue: null, note: '' });
    this.showCreate.set(true);
  }
  closeCreateForm(): void { if (!this.saving()) this.showCreate.set(false); }
  setCreateWarehouse(value: number | null): void { this.createForm.update(x => ({ ...x, warehouseId: value, scopeValue: null })); }
  setScopeType(value: StockTakeScopeType | null): void { this.createForm.update(x => ({ ...x, scopeType: value || 'WAREHOUSE', scopeValue: null })); }
  setScopeValue(value: string | number | null): void { this.createForm.update(x => ({ ...x, scopeValue: value })); }
  setCreateNote(value: string): void { this.createForm.update(x => ({ ...x, note: value })); }

  async createStockTake(): Promise<void> {
    const form = this.createForm();
    if (!form.warehouseId) return this.alert('Vui lòng chọn kho.', false);
    if (form.scopeType !== 'WAREHOUSE' && (form.scopeValue == null || form.scopeValue === ''))
      return this.alert('Vui lòng chọn giá trị phạm vi kiểm kê.', false);
    const payload: CreateStockTakePayload = {
      warehouseId: form.warehouseId, stockTakeStatusId: 0, scopeType: form.scopeType,
      note: form.note.trim() || null, stockTakeItems: [],
      zoneName: form.scopeType === 'ZONE' ? String(form.scopeValue) : null,
      locationId: form.scopeType === 'COLUMN' ? Number(form.scopeValue) : null,
      paddyLotId: form.scopeType === 'LOT' ? Number(form.scopeValue) : null,
      productVariantId: form.scopeType === 'SKU' ? Number(form.scopeValue) : null,
    };
    this.saving.set(true);
    try {
      const response = await lastValueFrom(this.service.create(payload));
      if (!response.isSucceeded) throw new Error(response.message);
      this.showCreate.set(false);
      await this.refresh();
      this.alert(response.message || 'Đã tạo phiếu và chụp snapshot tồn kho.');
    } catch (error) { this.alert(this.errorText(error), false); }
    finally { this.saving.set(false); }
  }

  updateCount(index: number, field: keyof Omit<CountLine, 'id'>, value: unknown): void {
    this.countLines.update(lines => lines.map((line, i) => i !== index ? line : {
      ...line,
      [field]: field === 'actualQuantity' ? (value === '' || value == null ? null : Number(value)) : value,
    }));
  }

  lineFor(item: StockTakeItem): CountLine | undefined { return this.countLines().find(x => x.id === item.id); }
  lineSeverity(item: StockTakeItem): string {
    const actual = this.lineFor(item)?.actualQuantity;
    if (actual == null) return 'NONE';
    const abs = Math.abs(actual - Number(item.systemQuantity));
    if (abs === 0) return 'NONE';
    const pct = Number(item.systemQuantity) === 0 ? Number.POSITIVE_INFINITY : abs / Math.abs(Number(item.systemQuantity)) * 100;
    const t = this.thresholds();
    if (pct > t.mediumVariancePercent || abs > t.mediumVarianceKg) return 'LARGE';
    if (pct > t.smallVariancePercent || abs > t.smallVarianceKg) return 'MEDIUM';
    return 'SMALL';
  }

  async saveCounts(showSuccess = true): Promise<boolean> {
    const current = this.detail();
    if (!current) return false;
    if (this.countLines().some(x => x.actualQuantity != null && x.actualQuantity < 0)) {
      this.alert('Số lượng thực tế không được âm.', false); return false;
    }
    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(this.service.saveCounts(current.id, {
        note: current.note || null,
        items: this.countLines().map(x => ({ ...x, note: x.note.trim() || null })),
      }));
      if (!response.isSucceeded) throw new Error(response.message);
      await this.refreshDetail(current.id);
      if (showSuccess) this.alert(response.message || 'Đã lưu kết quả kiểm đếm.');
      return true;
    } catch (error) { this.alert(this.errorText(error), false); return false; }
    finally { this.actionLoading.set(false); }
  }

  async submit(): Promise<void> {
    const current = this.detail();
    if (!current) return;
    if (this.countLines().some(x => x.actualQuantity == null)) return this.alert('Vui lòng nhập đủ số lượng thực tế cho mọi dòng.', false);
    const invalidReason = current.stockTakeItems.find(x => {
      const severity = this.lineSeverity(x);
      return (severity === 'MEDIUM' || severity === 'LARGE') && !this.lineFor(x)?.note.trim();
    });
    if (invalidReason) return this.alert('Dòng chênh lệch MEDIUM/LARGE phải nhập lý do.', false);
    const invalidRecount = current.stockTakeItems.find(x => this.lineSeverity(x) === 'LARGE' && !this.lineFor(x)?.recountConfirmed);
    if (invalidRecount) return this.alert('Dòng chênh lệch LARGE phải xác nhận đã kiểm đếm lại.', false);
    const confirmed = await Swal.fire({ title: 'Gửi phiếu để duyệt?', text: 'Sau khi gửi, dữ liệu kiểm đếm sẽ bị khóa.', icon: 'question', showCancelButton: true, confirmButtonText: 'Gửi duyệt', cancelButtonText: 'Hủy' });
    if (!confirmed.isConfirmed || !(await this.saveCounts(false))) return;
    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(this.service.submit(current.id, current.note));
      if (!response.isSucceeded) throw new Error(response.message);
      await this.refresh(); await this.refreshDetail(current.id);
      this.alert(response.message || 'Đã gửi phiếu để duyệt.');
    } catch (error) { this.alert(this.errorText(error), false); }
    finally { this.actionLoading.set(false); }
  }

  async approve(): Promise<void> {
    const current = this.detail(); if (!current) return;
    const result = await Swal.fire({ title: `Duyệt ${current.stCode}?`, input: 'textarea', inputLabel: 'Ghi chú duyệt (không bắt buộc)', showCancelButton: true, confirmButtonText: 'Duyệt & điều chỉnh tồn', cancelButtonText: 'Hủy', confirmButtonColor: '#15803d' });
    if (!result.isConfirmed) return;
    await this.runAction(() => this.service.approve(current.id, result.value), 'Đã duyệt và điều chỉnh tồn kho.');
  }

  async reject(): Promise<void> {
    const current = this.detail(); if (!current) return;
    const result = await Swal.fire({ title: `Từ chối ${current.stCode}?`, input: 'textarea', inputLabel: 'Lý do từ chối', inputValidator: value => value?.trim() ? undefined : 'Vui lòng nhập lý do.', showCancelButton: true, confirmButtonText: 'Từ chối', cancelButtonText: 'Hủy', confirmButtonColor: '#dc2626' });
    if (!result.isConfirmed) return;
    await this.runAction(() => this.service.reject(current.id, result.value), 'Đã từ chối phiếu kiểm kê.');
  }

  statusClass(code?: string | null): string { return `status-${String(code || '').toLowerCase()}`; }
  isStatus(code: string | null | undefined, expected: string): boolean {
    return String(code || '').trim().toUpperCase() === expected.trim().toUpperCase();
  }
  severityClass(value?: string | null): string { return `severity-${String(value || 'NONE').toLowerCase()}`; }
  formatNumber(value?: number | null): string { return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(value || 0)); }
  formatDate(value?: string | null): string { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }

  private async runAction(factory: () => ReturnType<StockTakeService['approve']>, success: string): Promise<void> {
    const id = this.selectedId(); if (id == null) return;
    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(factory());
      if (!response.isSucceeded) throw new Error(response.message);
      await this.refresh(); await this.refreshDetail(id); this.alert(response.message || success);
    } catch (error) { this.alert(this.errorText(error), false); }
    finally { this.actionLoading.set(false); }
  }
  private async refresh(): Promise<void> {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: ['stock-takes', 'list'] }),
      this.queryClient.invalidateQueries({ queryKey: ['stock-takes', 'summary'] }),
    ]);
  }
  private async refreshDetail(id: number): Promise<void> { await this.queryClient.invalidateQueries({ queryKey: ['stock-takes', 'detail', id] }); }
  private resourceArray<T>(response: unknown): T[] { const r = response as ApiResponse<any> | undefined; return Array.isArray(r?.resources) ? r.resources : (r?.resources?.data ?? []); }
  private errorText(error: unknown): string { const e = error as any; return e?.error?.message || e?.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.'; }
  private alert(message: string, success = true): void { void Swal.fire({ text: message, icon: success ? 'success' : 'error', confirmButtonText: 'Đóng' }); }
}
