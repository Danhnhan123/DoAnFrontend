import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  injectQuery,
  injectQueryClient,
  keepPreviousData,
} from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import {
  ApiResponse,
  InventoryRow,
  LocationRow,
  STOCK_TRANSFER_STATUS,
  StockTransferDetail,
  StockTransferItemPayload,
  StockTransferRow,
  StockTransferSummary,
  WarehouseRow,
} from '../../models';
import { InventoryService } from '../../services/inventory.service';
import { LocationService } from '../../services/location.service';
import { StockTransferService } from '../../services/stock-transfer.service';
import { WarehouseService } from '../../services/warehouse.service';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

type TransferTab = 'ALL' | 'IN_TRANSIT' | 'COMPLETED';

interface TransferFormLine {
  clientId: string;
  inventoryId: number;
  productVariantId: number;
  sku: string;
  productVariantName: string;
  paddyLotId: number | null;
  lotCode: string;
  fromLocationId: number | null;
  fromLocationName: string;
  toLocationId: number | null;
  weightKg: number | null;
  note: string;
}

interface TransferFormState {
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  transferDate: string;
  note: string;
  items: TransferFormLine[];
}

@Component({
  selector: 'app-stock-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './stock-transfer.component.html',
  styleUrl: './stock-transfer.component.css',
})
export class StockTransferComponent implements OnDestroy {
  private readonly service = inject(StockTransferService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly locationService = inject(LocationService);
  private readonly inventoryService = inject(InventoryService);
  private readonly queryClient = injectQueryClient();

  readonly status = STOCK_TRANSFER_STATUS;
  readonly tabs: { key: TransferTab; label: string }[] = [
    { key: 'ALL', label: 'Tất cả' },
    { key: STOCK_TRANSFER_STATUS.IN_TRANSIT, label: 'Đang chuyển' },
    { key: STOCK_TRANSFER_STATUS.COMPLETED, label: 'Hoàn tất' },
  ];

  readonly activeTab = signal<TransferTab>('ALL');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly fromWarehouseFilter = signal<number | null>(null);
  readonly toWarehouseFilter = signal<number | null>(null);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly showFilters = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly showFormModal = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly selectedInventoryId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly actionLoading = signal(false);

  readonly form = signal<TransferFormState>(this.emptyForm());
  private searchTimer?: ReturnType<typeof setTimeout>;

  private readonly warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouse-options', 'stock-transfer'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
    staleTime: 60_000,
  }));

  private readonly locationsQuery = injectQuery(() => ({
    queryKey: ['location-options', 'stock-transfer'],
    queryFn: () => lastValueFrom(this.locationService.getAll()),
    staleTime: 60_000,
  }));

  private readonly listQuery = injectQuery(() => ({
    queryKey: [
      'stock-transfers',
      this.page(),
      this.pageSize(),
      this.search(),
      this.activeTab(),
      this.fromWarehouseFilter(),
      this.toWarehouseFilter(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.service.getPagedAdvanced(
          this.service.buildPagedBody({
            page: this.page(),
            pageSize: this.pageSize(),
            search: this.search(),
            statusCode:
              this.activeTab() === 'ALL' ? null : this.activeTab(),
            fromWarehouseId: this.fromWarehouseFilter(),
            toWarehouseId: this.toWarehouseFilter(),
            dateFrom: this.dateFrom(),
            dateTo: this.dateTo(),
          })
        )
      ),
    placeholderData: keepPreviousData,
  }));

  private readonly summaryQuery = injectQuery(() => ({
    queryKey: ['stock-transfers', 'summary'],
    queryFn: () => lastValueFrom(this.service.getSummary()),
  }));

  private readonly detailQuery = injectQuery(() => ({
    queryKey: ['stock-transfers', 'detail', this.selectedId()],
    enabled: this.selectedId() != null,
    queryFn: async () => {
      const id = this.selectedId();
      if (id == null) throw new Error('Chưa chọn phiếu chuyển kho.');
      return lastValueFrom(this.service.getById(id));
    },
  }));

  private readonly sourceInventoriesQuery = injectQuery(() => ({
    queryKey: [
      'stock-transfer-source-inventory',
      this.form().fromWarehouseId,
    ],
    enabled: !!this.form().fromWarehouseId && this.showFormModal(),
    queryFn: () =>
      lastValueFrom(
        this.inventoryService.getPagedAdvanced(
          this.inventoryService.buildPagedBody({
            page: 1,
            pageSize: 500,
            search: '',
            sortField: 'lotCode',
            sortDir: 'asc',
            colMap: {
              lotCode: 0,
              categoryName: 1,
              warehouseName: 2,
              bags: 3,
              quantityOnHand: 4,
              quantityAvailable: 5,
              quantityReserved: 6,
              costPrice: 7,
              id: 8,
            },
            warehouseId: this.form().fromWarehouseId,
          })
        )
      ),
  }));

  readonly warehouses = computed<WarehouseRow[]>(() =>
    this.resourceArray<WarehouseRow>(this.warehousesQuery.data())
      .filter((warehouse) => warehouse.isActive)
  );

  readonly locations = computed<LocationRow[]>(() =>
    this.resourceArray<LocationRow>(this.locationsQuery.data())
      .filter((location) => location.isActive)
  );

  readonly warehouseOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
    }))
  );

  readonly pageSizeOptions: FilterSelectOption[] = [
    { id: 10, name: '10 / trang' },
    { id: 20, name: '20 / trang' },
    { id: 50, name: '50 / trang' },
  ];

  readonly rows = computed<StockTransferRow[]>(() => {
    const response = this.listQuery.data() as ApiResponse<any> | undefined;
    return response?.resources?.data ?? [];
  });

  readonly total = computed(() => {
    const response = this.listQuery.data() as ApiResponse<any> | undefined;
    return Number(
      response?.resources?.recordsFiltered ??
      response?.resources?.recordsTotal ??
      0
    );
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );

  readonly summary = computed<StockTransferSummary>(() => {
    const response = this.summaryQuery.data() as
      | ApiResponse<StockTransferSummary>
      | undefined;
    return response?.resources ?? {
      transfersThisMonth: 0,
      inTransitCount: 0,
      totalTransferredWeightKg: 0,
    };
  });

  readonly detail = computed<StockTransferDetail | null>(() => {
    const response = this.detailQuery.data() as
      | ApiResponse<StockTransferDetail>
      | undefined;
    return response?.resources ?? null;
  });

  readonly sourceInventories = computed<InventoryRow[]>(() => {
    const response = this.sourceInventoriesQuery.data() as
      | ApiResponse<any>
      | undefined;
    const rows: InventoryRow[] = response?.resources?.data ?? [];
    return rows.filter(
      (row) =>
        Number(row.quantityAvailable || 0) > 0 &&
        Number(row.quantityQuarantine || 0) <= 0 &&
        !String(row.lotStatusName || '').toLowerCase().includes('cách ly')
    );
  });

  readonly destinationLocations = computed(() =>
    this.locations().filter(
      (location) =>
        location.warehouseId === this.form().toWarehouseId &&
        !(location as LocationRow & { isQuarantine?: boolean }).isQuarantine
    )
  );

  // ─── Option cho dropdown dùng chung trong form (app-filter-select) ──────────
  /** Kho nguồn: chặn chọn trùng kho đích. */
  readonly fromWarehouseSelectOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({
      id: w.id,
      name: w.name,
      disabled: w.id === this.form().toWarehouseId,
    }))
  );

  /** Kho đích: chặn chọn trùng kho nguồn. */
  readonly toWarehouseSelectOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({
      id: w.id,
      name: w.name,
      disabled: w.id === this.form().fromWarehouseId,
    }))
  );

  readonly sourceInventoryOptions = computed<FilterSelectOption[]>(() =>
    this.sourceInventories().map((inv) => ({
      id: inv.id,
      name: this.inventoryOption(inv),
    }))
  );

  readonly destinationLocationOptions = computed<FilterSelectOption[]>(() =>
    this.destinationLocations().map((loc) => ({
      id: loc.id,
      name: this.locationLabel(loc),
    }))
  );

  readonly listLoading = computed(
    () => this.listQuery.isPending() || this.listQuery.isFetching()
  );
  readonly detailLoading = computed(
    () => this.detailQuery.isPending() || this.detailQuery.isFetching()
  );
  readonly sourceLoading = computed(() =>
    this.sourceInventoriesQuery.isFetching()
  );

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  selectTab(tab: TransferTab): void {
    this.activeTab.set(tab);
    this.page.set(1);
  }

  onSearch(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.search.set(value.trim());
      this.page.set(1);
    }, 350);
  }

  setFromFilter(value: number | null): void {
    this.fromWarehouseFilter.set(value);
    this.page.set(1);
  }

  setToFilter(value: number | null): void {
    this.toWarehouseFilter.set(value);
    this.page.set(1);
  }

  resetFilters(): void {
    this.searchInput.set('');
    this.search.set('');
    this.fromWarehouseFilter.set(null);
    this.toWarehouseFilter.set(null);
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);
  }

  toggleFilters(): void {
    this.showFilters.update((value) => !value);
  }

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
    this.page.set(1);
  }

  setDateTo(value: string): void {
    this.dateTo.set(value);
    this.page.set(1);
  }

  changePage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages()) return;
    this.page.set(nextPage);
  }

  changePageSize(value: number): void {
    this.pageSize.set(Number(value) || 10);
    this.page.set(1);
  }

  openDetail(id: number): void {
    this.selectedId.set(id);
  }

  closeDetail(): void {
    if (this.actionLoading()) return;
    this.selectedId.set(null);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.selectedInventoryId.set(null);
    this.form.set(this.emptyForm());
    this.showFormModal.set(true);
  }

  openEdit(detail: StockTransferDetail): void {
    if (detail.statusCode !== this.status.DRAFT) return;
    this.editingId.set(detail.id);
    this.selectedInventoryId.set(null);
    this.form.set({
      fromWarehouseId: detail.fromWarehouseId,
      toWarehouseId: detail.toWarehouseId,
      transferDate: this.toDateInput(detail.transferDate),
      note: detail.note || '',
      items: detail.items.map((item) => ({
        clientId: this.clientId(),
        inventoryId: 0,
        productVariantId: item.productVariantId,
        sku: item.sku || '',
        productVariantName: item.productVariantName || '',
        paddyLotId: item.paddyLotId ?? null,
        lotCode: item.lotCode || '',
        fromLocationId: item.fromLocationId ?? null,
        fromLocationName: item.fromLocationName || '',
        toLocationId: item.toLocationId ?? null,
        weightKg: Number(item.weightKg),
        note: item.note || '',
      })),
    });
    this.selectedId.set(null);
    this.showFormModal.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.showFormModal.set(false);
  }

  setFormWarehouse(
    field: 'fromWarehouseId' | 'toWarehouseId',
    rawValue: string
  ): void {
    const value = Number(rawValue) || null;
    this.form.update((current) => {
      if (field === 'fromWarehouseId') {
        return { ...current, fromWarehouseId: value, items: [] };
      }
      return {
        ...current,
        toWarehouseId: value,
        items: current.items.map((item) => ({
          ...item,
          toLocationId: null,
        })),
      };
    });
    this.selectedInventoryId.set(null);
  }

  setFormText(field: 'transferDate' | 'note', value: string): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  addInventoryLine(): void {
    const inventoryId = this.selectedInventoryId();
    const inventory = this.sourceInventories().find(
      (row) => row.id === inventoryId
    );
    if (!inventory) {
      this.alert('Vui lòng chọn một dòng tồn kho nguồn.', false);
      return;
    }

    const duplicated = this.form().items.some(
      (line) =>
        line.productVariantId === inventory.productVariantId &&
        line.paddyLotId === (inventory.paddyLotId ?? null) &&
        line.fromLocationId === (inventory.locationId ?? null)
    );
    if (duplicated) {
      this.alert('Dòng tồn kho này đã có trong phiếu.', false);
      return;
    }

    this.form.update((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          clientId: this.clientId(),
          inventoryId: inventory.id,
          productVariantId: inventory.productVariantId,
          sku: inventory.sku,
          productVariantName: inventory.productVariantName,
          paddyLotId: inventory.paddyLotId ?? null,
          lotCode: inventory.lotCode || '',
          fromLocationId: inventory.locationId ?? null,
          fromLocationName: inventory.locationCode || 'Tồn cấp kho nguồn',
          toLocationId: null,
          weightKg: null,
          note: '',
        },
      ],
    }));
    this.selectedInventoryId.set(null);
  }

  removeLine(index: number): void {
    this.form.update((current) => ({
      ...current,
      items: current.items.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  updateLine(
    index: number,
    field: 'toLocationId' | 'weightKg' | 'note',
    rawValue: string
  ): void {
    this.form.update((current) => ({
      ...current,
      items: current.items.map((item, lineIndex) => {
        if (lineIndex !== index) return item;
        if (field === 'note') return { ...item, note: rawValue };
        const value = Number(rawValue);
        return {
          ...item,
          [field]: value > 0 ? value : null,
        };
      }),
    }));
  }

  lineAvailable(line: TransferFormLine): number {
    const inventory = this.sourceInventories().find(
      (row) =>
        row.productVariantId === line.productVariantId &&
        (row.paddyLotId ?? null) === line.paddyLotId &&
        (row.locationId ?? null) === line.fromLocationId
    );
    return Number(inventory?.quantityAvailable || 0);
  }

  async saveForm(): Promise<void> {
    const error = this.validateForm();
    if (error) {
      this.alert(error, false);
      return;
    }

    const current = this.form();
    const items: StockTransferItemPayload[] = current.items.map((item) => ({
      productVariantId: item.productVariantId,
      paddyLotId: item.paddyLotId,
      fromLocationId: item.fromLocationId,
      toLocationId: item.toLocationId,
      weightKg: Number(item.weightKg),
      note: item.note.trim() || null,
    }));
    const payload = {
      fromWarehouseId: Number(current.fromWarehouseId),
      toWarehouseId: Number(current.toWarehouseId),
      transferDate: current.transferDate,
      assignedUserId: null,
      note: current.note.trim() || null,
      items,
    };

    this.saving.set(true);
    try {
      const id = this.editingId();
      const response = id
        ? await lastValueFrom(
            this.service.update(id, { id, ...payload })
          )
        : await lastValueFrom(this.service.create(payload));
      this.ensureSucceeded(response, 'Không lưu được phiếu chuyển kho.');
      this.showFormModal.set(false);
      this.refreshAfterWrite();
      this.alert(
        id
          ? 'Cập nhật phiếu chuyển kho thành công.'
          : 'Tạo phiếu chuyển kho thành công.'
      );
    } catch (error) {
      this.alert(this.errorText(error), false);
    } finally {
      this.saving.set(false);
    }
  }

  confirmDispatch(detail: StockTransferDetail): void {
    if (detail.statusCode !== this.status.DRAFT) return;
    Swal.fire({
      icon: 'question',
      title: 'Xác nhận xuất chuyển?',
      html: `Phiếu <b>${detail.transferCode}</b> sẽ trừ tồn kho nguồn và chuyển sang trạng thái <b>Đang chuyển</b>.`,
      showCancelButton: true,
      confirmButtonText: 'Xuất chuyển',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a34a',
    }).then((result) => {
      if (result.isConfirmed) {
        this.runAction(
          () => lastValueFrom(this.service.dispatch(detail.id)),
          'Đã xuất hàng khỏi kho nguồn.'
        );
      }
    });
  }

  confirmReceive(detail: StockTransferDetail): void {
    if (detail.statusCode !== this.status.IN_TRANSIT) return;
    Swal.fire({
      icon: 'question',
      title: 'Xác nhận đã nhận hàng?',
      html: `Phiếu <b>${detail.transferCode}</b> sẽ cộng tồn kho đích và chuyển sang trạng thái <b>Hoàn tất</b>.`,
      showCancelButton: true,
      confirmButtonText: 'Xác nhận nhận hàng',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a34a',
    }).then((result) => {
      if (result.isConfirmed) {
        this.runAction(
          () => lastValueFrom(this.service.receive(detail.id)),
          'Đã nhận hàng và cập nhật tồn kho đích.'
        );
      }
    });
  }

  confirmCancel(detail: StockTransferDetail): void {
    if (detail.statusCode !== this.status.DRAFT) return;
    Swal.fire({
      icon: 'warning',
      title: 'Hủy phiếu chuyển?',
      input: 'textarea',
      inputLabel: 'Lý do hủy',
      inputPlaceholder: 'Nhập lý do hủy (không bắt buộc)…',
      showCancelButton: true,
      confirmButtonText: 'Hủy phiếu',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (result.isConfirmed) {
        this.runAction(
          () =>
            lastValueFrom(
              this.service.cancel(detail.id, String(result.value || ''))
            ),
          'Đã hủy phiếu chuyển kho.'
        );
      }
    });
  }

  statusClass(statusName?: string | null): string {
    switch (statusName) {
      case STOCK_TRANSFER_STATUS.DRAFT:
        return 'status-draft';
      case STOCK_TRANSFER_STATUS.IN_TRANSIT:
        return 'status-transit';
      case STOCK_TRANSFER_STATUS.COMPLETED:
        return 'status-completed';
      case STOCK_TRANSFER_STATUS.CANCELLED:
        return 'status-cancelled';
      default:
        return '';
    }
  }

  receivingLabel(statusName?: string | null): string {
    if (statusName === STOCK_TRANSFER_STATUS.IN_TRANSIT) return 'Chưa nhận';
    if (statusName === STOCK_TRANSFER_STATUS.COMPLETED) return 'Đã nhận';
    return '—';
  }

  formatWeight(weightKg: number): string {
    return `${Number(weightKg || 0).toLocaleString('vi-VN', {
      maximumFractionDigits: 3,
    })} kg`;
  }

  formatTon(weightKg: number): string {
    const tons = Number(weightKg || 0) / 1000;
    return `${tons.toLocaleString('vi-VN', {
      minimumFractionDigits: tons % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 3,
    })}t`;
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('vi-VN');
  }

  inventoryOption(row: InventoryRow): string {
    const item = row.lotCode || row.sku;
    const location = row.locationCode || 'Không vị trí';
    return `${item} · ${row.productVariantName} · ${location} · khả dụng ${this.formatWeight(row.quantityAvailable)}`;
  }

  locationLabel(location: LocationRow): string {
    return [location.zoneName, location.shelfRow, location.shelfLevel, location.slotCode]
      .filter(Boolean)
      .join('-');
  }

  private validateForm(): string | null {
    const current = this.form();
    if (!current.fromWarehouseId) return 'Vui lòng chọn kho nguồn.';
    if (!current.toWarehouseId) return 'Vui lòng chọn kho đích.';
    if (current.fromWarehouseId === current.toWarehouseId) {
      return 'Kho nguồn và kho đích không được trùng nhau.';
    }
    if (!current.transferDate) return 'Vui lòng chọn ngày chuyển.';
    if (current.items.length === 0) {
      return 'Phiếu chuyển phải có ít nhất một dòng hàng.';
    }

    for (let index = 0; index < current.items.length; index++) {
      const item = current.items[index];
      const lineNumber = index + 1;
      if (!item.toLocationId) {
        return `Vui lòng chọn vị trí đích cho dòng ${lineNumber}.`;
      }
      if (!item.weightKg || item.weightKg <= 0) {
        return `Khối lượng dòng ${lineNumber} phải lớn hơn 0.`;
      }
      const available = this.lineAvailable(item);
      if (available > 0 && item.weightKg > available) {
        return `Khối lượng dòng ${lineNumber} vượt tồn khả dụng ${this.formatWeight(available)}.`;
      }
    }
    return null;
  }

  private async runAction(
    action: () => Promise<ApiResponse<any>>,
    successMessage: string
  ): Promise<void> {
    this.actionLoading.set(true);
    try {
      const response = await action();
      this.ensureSucceeded(response, 'Không thực hiện được thao tác.');
      this.selectedId.set(null);
      this.refreshAfterWrite();
      this.alert(response.message || successMessage);
    } catch (error) {
      this.alert(this.errorText(error), false);
    } finally {
      this.actionLoading.set(false);
    }
  }

  private refreshAfterWrite(): void {
    this.queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    this.queryClient.invalidateQueries({ queryKey: ['inventories'] });
    this.queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    this.queryClient.invalidateQueries({
      queryKey: ['stock-transfer-source-inventory'],
    });
  }

  private ensureSucceeded(
    response: ApiResponse<any>,
    fallback: string
  ): void {
    if (!response || response.isSucceeded === false) {
      throw new Error(response?.message || fallback);
    }
  }

  private resourceArray<T>(response: unknown): T[] {
    return ((response as ApiResponse<T[]> | undefined)?.resources ?? []) as T[];
  }

  private errorText(error: unknown): string {
    const value = error as any;
    return (
      value?.error?.message ||
      value?.message ||
      'Có lỗi xảy ra. Vui lòng thử lại.'
    );
  }

  private alert(message: string, success = true): void {
    Swal.fire({
      icon: success ? 'success' : 'error',
      title: success ? 'Thành công' : 'Không thể thực hiện',
      text: message,
      confirmButtonColor: success ? '#16a34a' : '#dc2626',
    });
  }

  private emptyForm(): TransferFormState {
    return {
      fromWarehouseId: null,
      toWarehouseId: null,
      transferDate: this.toDateInput(new Date().toISOString()),
      note: '',
      items: [],
    };
  }

  private toDateInput(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value?.slice(0, 10) || '';
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000)
      .toISOString()
      .slice(0, 10);
  }

  private clientId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
