import { CommonModule } from '@angular/common';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
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
  BagQualityResult,
  InventoryRow,
  LocationRow,
  STOCK_TRANSFER_STATUS,
  StockTransferBagDisposition,
  StockTransferBagPayload,
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

interface BagFormLine {
  bagId: number;
  bagNo: number;
  lotId: number | null;
  lotCode: string;
  weightKg: number;
  selected: boolean;
  qualityResult: BagQualityResult;
  disposition: StockTransferBagDisposition;
  quarantineLocationId: number | null;
  moisturePercent: number | null;
  impurityPercent: number | null;
  moldLevel: string;
  pestLevel: string;
  packagingStatus: string;
  qualityNote: string;
}

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
  // Chuyển kho THEO BAO: khi cột nguồn có bao thì chọn bao + kiểm định chất lượng.
  hasBags: boolean;
  bags: BagFormLine[];
  // Gợi ý ô cách ly ở kho nguồn (dùng chung cho các bao không đạt của dòng).
  quarantineOptions: { id: number; name: string }[];
  // Chỉ các cột ĐÍCH thật sự dùng được cho dòng này (đủ chỗ, cùng loại/ô trống, đúng danh mục).
  destinationOptions: { id: number; name: string }[];
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
  imports: [CommonModule, FormsModule, FilterSelectComponent, HasPermissionDirective],
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
  readonly addingLine = signal(false);

  readonly bagQualityOptions: { value: BagQualityResult; label: string }[] = [
    { value: 'PASS', label: 'Đạt' },
    { value: 'ISSUE_DETECTED', label: 'Không đạt' },
  ];
  readonly bagDispositionOptions: { value: StockTransferBagDisposition; label: string }[] = [
    { value: 'QUARANTINE', label: 'Chuyển cách ly' },
    { value: 'DISPOSE', label: 'Bỏ bao' },
  ];

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
        !this.locations().some(location => location.id === row.locationId &&
          (location.isOutboundStaging || location.isLockedForOutbound)) &&
        Number(row.quantityQuarantine || 0) <= 0 &&
        !String(row.lotStatusName || '').toLowerCase().includes('cách ly')
    );
  });

  readonly destinationLocations = computed(() =>
    this.locations().filter(
      (location) =>
        location.warehouseId === this.form().toWarehouseId &&
        !location.isOutboundStaging &&
        !location.isLockedForOutbound &&
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
      items: detail.items.map((item) => {
        const bags: BagFormLine[] = (item.bags || []).map((bag) => ({
          bagId: bag.bagId,
          bagNo: Number(bag.bagNo || 0),
          lotId: bag.sourceLotId ?? null,
          lotCode: bag.sourceLotCode || '',
          weightKg: Number(bag.weightKg || 0),
          selected: true,
          qualityResult: (bag.qualityResult === 'ISSUE_DETECTED'
            ? 'ISSUE_DETECTED'
            : 'PASS') as BagQualityResult,
          disposition: ((bag.disposition as StockTransferBagDisposition) ||
            'TRANSFER') as StockTransferBagDisposition,
          quarantineLocationId: bag.quarantineLocationId ?? null,
          moisturePercent: bag.moisturePercent ?? null,
          impurityPercent: bag.impurityPercent ?? null,
          moldLevel: bag.moldLevel || '',
          pestLevel: bag.pestLevel || '',
          packagingStatus: bag.packagingStatus || '',
          qualityNote: bag.qualityNote || '',
        }));
        const quarantineOptions = Array.from(
          new Map(
            (item.bags || [])
              .filter((bag) => bag.quarantineLocationId != null)
              .map((bag) => [
                bag.quarantineLocationId as number,
                {
                  id: bag.quarantineLocationId as number,
                  name: bag.quarantineLocationName || `Ô #${bag.quarantineLocationId}`,
                },
              ])
          ).values()
        );
        return {
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
          weightKg: bags.length > 0 ? null : Number(item.weightKg),
          note: item.note || '',
          hasBags: bags.length > 0,
          bags,
          quarantineOptions,
          destinationOptions: [],
        };
      }),
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

  async addInventoryLine(): Promise<void> {
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

    // Hàng CÓ BAO → tải bao đỉnh cột nguồn để chọn + kiểm định chất lượng theo BAO.
    let bags: BagFormLine[] = [];
    const fromWarehouseId = this.form().fromWarehouseId;
    if (
      Number(inventory.bags || 0) > 0 &&
      inventory.locationId != null &&
      fromWarehouseId
    ) {
      this.addingLine.set(true);
      try {
        const response = await lastValueFrom(
          this.service.getSourceBags(
            Number(fromWarehouseId),
            Number(inventory.locationId),
            inventory.productVariantId
          )
        );
        const sourceBags = response?.resources ?? [];
        bags = sourceBags.map((bag) => ({
          bagId: bag.bagId,
          bagNo: bag.bagNo,
          lotId: bag.lotId ?? null,
          lotCode: bag.lotCode || '',
          weightKg: Number(bag.weightKg || 0),
          selected: true,
          qualityResult: 'PASS' as BagQualityResult,
          disposition: 'TRANSFER' as StockTransferBagDisposition,
          quarantineLocationId: null,
          moisturePercent: null,
          impurityPercent: null,
          moldLevel: '',
          pestLevel: '',
          packagingStatus: '',
          qualityNote: '',
        }));
      } catch (error) {
        this.alert(this.errorText(error), false);
        return;
      } finally {
        this.addingLine.set(false);
      }
      if (bags.length === 0) {
        this.alert('Cột nguồn này không còn bao khả dụng ở đỉnh chồng.', false);
        return;
      }
    }

    // Gợi ý sẵn ô cách ly ở kho nguồn (cho bao không đạt) — chỉ cần khi dòng có bao.
    let quarantineOptions: { id: number; name: string }[] = [];
    if (bags.length > 0 && fromWarehouseId) {
      try {
        const qResponse = await lastValueFrom(
          this.service.getQuarantineSuggestions(
            Number(fromWarehouseId),
            inventory.productVariantId
          )
        );
        quarantineOptions = (qResponse?.resources ?? []).map((loc) => ({
          id: loc.locationId,
          name: loc.locationName || `Ô #${loc.locationId}`,
        }));
      } catch {
        // Gợi ý là tùy chọn — bỏ qua lỗi.
      }
    }

    // Vị trí lưu ở kho đích: chỉ lấy các cột THẬT SỰ DÙNG ĐƯỢC (đủ chỗ, cùng loại/ô trống,
    // đúng danh mục) để hiển thị trong dropdown; pre-select ô tốt nhất (ô đầu).
    let destinationOptions: { id: number; name: string }[] = [];
    let suggestedToLocationId: number | null = null;
    const toWarehouseId = this.form().toWarehouseId;
    if (toWarehouseId) {
      const suggestWeight = bags.reduce((sum, bag) => sum + Number(bag.weightKg || 0), 0);
      try {
        const suggestion = await lastValueFrom(
          this.service.getDestinationSuggestions(
            Number(toWarehouseId),
            inventory.productVariantId,
            suggestWeight
          )
        );
        destinationOptions = (suggestion?.resources ?? []).map((loc) => ({
          id: loc.locationId,
          name: loc.locationName || `Ô #${loc.locationId}`,
        }));
        suggestedToLocationId = destinationOptions[0]?.id ?? null;
      } catch {
        // Gợi ý là tùy chọn — bỏ qua lỗi, người dùng tự chọn vị trí đích.
      }
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
          toLocationId: suggestedToLocationId,
          weightKg: null,
          note: '',
          hasBags: bags.length > 0,
          bags,
          quarantineOptions,
          destinationOptions,
        },
      ],
    }));
    this.selectedInventoryId.set(null);
  }

  // ─── Thao tác trên bao trong một dòng chuyển kho theo BAO ────────────────────
  private patchBag(lineIndex: number, bagId: number, patch: Partial<BagFormLine>): void {
    this.form.update((current) => ({
      ...current,
      items: current.items.map((item, index) =>
        index !== lineIndex
          ? item
          : {
              ...item,
              bags: item.bags.map((bag) =>
                bag.bagId === bagId ? { ...bag, ...patch } : bag
              ),
            }
      ),
    }));
  }

  toggleBag(lineIndex: number, bagId: number, selected: boolean): void {
    this.patchBag(lineIndex, bagId, { selected });
  }

  setBagQuality(lineIndex: number, bagId: number, value: string): void {
    const quality = (value === 'ISSUE_DETECTED' ? 'ISSUE_DETECTED' : 'PASS') as BagQualityResult;
    this.form.update((current) => ({
      ...current,
      items: current.items.map((item, index) =>
        index !== lineIndex
          ? item
          : {
              ...item,
              bags: item.bags.map((bag) => {
                if (bag.bagId !== bagId) return bag;
                const disposition: StockTransferBagDisposition =
                  quality === 'PASS'
                    ? 'TRANSFER'
                    : bag.disposition === 'TRANSFER'
                    ? 'QUARANTINE'
                    : bag.disposition;
                const quarantineLocationId =
                  disposition === 'QUARANTINE'
                    ? bag.quarantineLocationId ?? item.quarantineOptions[0]?.id ?? null
                    : null;
                return { ...bag, qualityResult: quality, disposition, quarantineLocationId };
              }),
            }
      ),
    }));
    void this.autofillQuarantineLocation(lineIndex, bagId);
  }

  setBagDisposition(lineIndex: number, bagId: number, value: string): void {
    const disposition = (value === 'DISPOSE' ? 'DISPOSE' : 'QUARANTINE') as StockTransferBagDisposition;
    this.form.update((current) => ({
      ...current,
      items: current.items.map((item, index) =>
        index !== lineIndex
          ? item
          : {
              ...item,
              bags: item.bags.map((bag) => {
                if (bag.bagId !== bagId) return bag;
                const quarantineLocationId =
                  disposition === 'QUARANTINE'
                    ? bag.quarantineLocationId ?? item.quarantineOptions[0]?.id ?? null
                    : null;
                return { ...bag, disposition, quarantineLocationId };
              }),
            }
      ),
    }));
    void this.autofillQuarantineLocation(lineIndex, bagId);
  }

  setBagQuarantineLocation(lineIndex: number, bagId: number, rawValue: string): void {
    const value = Number(rawValue) || null;
    this.patchBag(lineIndex, bagId, { quarantineLocationId: value });
  }

  /**
   * Khi một bao chuyển sang cách ly: đảm bảo dòng đã có gợi ý ô cách ly (gọi API nếu chưa),
   * rồi tự điền ô cách ly đầu tiên nếu người dùng chưa chọn.
   */
  private async autofillQuarantineLocation(lineIndex: number, bagId: number): Promise<void> {
    const line = this.form().items[lineIndex];
    if (!line?.hasBags) return;
    const bag = line.bags.find((b) => b.bagId === bagId);
    if (!bag || bag.disposition !== 'QUARANTINE') return;

    // Nạp gợi ý ô cách ly nếu dòng chưa có (lúc thêm dòng backend chưa trả kịp / chưa bật endpoint).
    if (line.quarantineOptions.length === 0) {
      const fromWarehouseId = this.form().fromWarehouseId;
      if (fromWarehouseId) {
        try {
          const response = await lastValueFrom(
            this.service.getQuarantineSuggestions(
              Number(fromWarehouseId),
              line.productVariantId
            )
          );
          const options = (response?.resources ?? []).map((loc) => ({
            id: loc.locationId,
            name: loc.locationName || `Ô #${loc.locationId}`,
          }));
          this.form.update((current) => ({
            ...current,
            items: current.items.map((item, index) =>
              index === lineIndex ? { ...item, quarantineOptions: options } : item
            ),
          }));
        } catch {
          // Bỏ qua — người dùng vẫn có thể để backend tự chọn khi nhận.
        }
      }
    }

    // Tự điền ô cách ly đầu tiên nếu bao vẫn chưa có ô.
    const firstId = this.form().items[lineIndex]?.quarantineOptions[0]?.id ?? null;
    if (firstId == null) return;
    this.form.update((current) => ({
      ...current,
      items: current.items.map((item, index) =>
        index !== lineIndex
          ? item
          : {
              ...item,
              bags: item.bags.map((b) =>
                b.bagId === bagId &&
                b.disposition === 'QUARANTINE' &&
                b.quarantineLocationId == null
                  ? { ...b, quarantineLocationId: firstId }
                  : b
              ),
            }
      ),
    }));
  }

  quarantineOptionsFor(line: TransferFormLine): FilterSelectOption[] {
    return line.quarantineOptions.map((option) => ({
      id: option.id,
      name: option.name,
    }));
  }

  /** Chỉ hiển thị các cột đích DÙNG ĐƯỢC cho dòng; dòng cũ (sửa phiếu) chưa nạp thì dùng danh sách chung. */
  destinationOptionsFor(line: TransferFormLine): FilterSelectOption[] {
    if (line.destinationOptions.length > 0) {
      return line.destinationOptions.map((option) => ({
        id: option.id,
        name: option.name,
      }));
    }
    return this.destinationLocationOptions();
  }

  setBagNumber(
    lineIndex: number,
    bagId: number,
    field: 'moisturePercent' | 'impurityPercent',
    rawValue: string
  ): void {
    const parsed = rawValue === '' ? null : Number(rawValue);
    this.patchBag(lineIndex, bagId, {
      [field]: parsed != null && !Number.isNaN(parsed) ? parsed : null,
    } as Partial<BagFormLine>);
  }

  setBagText(
    lineIndex: number,
    bagId: number,
    field: 'moldLevel' | 'pestLevel' | 'packagingStatus' | 'qualityNote',
    value: string
  ): void {
    this.patchBag(lineIndex, bagId, { [field]: value } as Partial<BagFormLine>);
  }

  lineTransferWeight(line: TransferFormLine): number {
    return line.bags
      .filter((bag) => bag.selected && bag.disposition === 'TRANSFER')
      .reduce((sum, bag) => sum + Number(bag.weightKg || 0), 0);
  }

  lineSelectedBags(line: TransferFormLine): number {
    return line.bags.filter((bag) => bag.selected).length;
  }

  lineQuarantineBags(line: TransferFormLine): number {
    return line.bags.filter((bag) => bag.selected && bag.disposition === 'QUARANTINE').length;
  }

  lineDisposeBags(line: TransferFormLine): number {
    return line.bags.filter((bag) => bag.selected && bag.disposition === 'DISPOSE').length;
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
    const items: StockTransferItemPayload[] = current.items.map((item) => {
      if (item.hasBags) {
        const bags: StockTransferBagPayload[] = item.bags
          .filter((bag) => bag.selected)
          .map((bag) => ({
            bagId: bag.bagId,
            moisturePercent: bag.moisturePercent,
            impurityPercent: bag.impurityPercent,
            moldLevel: bag.moldLevel.trim() || null,
            pestLevel: bag.pestLevel.trim() || null,
            packagingStatus: bag.packagingStatus.trim() || null,
            qualityResult: bag.qualityResult,
            disposition: bag.disposition,
            quarantineLocationId:
              bag.disposition === 'QUARANTINE' ? bag.quarantineLocationId : null,
            qualityNote: bag.qualityNote.trim() || null,
            note: null,
          }));
        return {
          productVariantId: item.productVariantId,
          paddyLotId: item.paddyLotId,
          fromLocationId: item.fromLocationId,
          toLocationId: item.toLocationId,
          weightKg: this.lineTransferWeight(item),
          note: item.note.trim() || null,
          bags,
        };
      }
      return {
        productVariantId: item.productVariantId,
        paddyLotId: item.paddyLotId,
        fromLocationId: item.fromLocationId,
        toLocationId: item.toLocationId,
        weightKg: Number(item.weightKg),
        note: item.note.trim() || null,
      };
    });
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

  bagQualityLabel(value?: string | null): string {
    if (value === 'ISSUE_DETECTED') return 'Không đạt';
    if (value === 'PASS') return 'Đạt';
    return '—';
  }

  bagDispositionLabel(value?: string | null): string {
    switch (value) {
      case 'TRANSFER':
        return 'Chuyển đi';
      case 'QUARANTINE':
        return 'Cách ly';
      case 'DISPOSE':
        return 'Bỏ bao';
      default:
        return value || '—';
    }
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

      if (item.hasBags) {
        const selected = this.lineSelectedBags(item);
        if (selected === 0) {
          return `Dòng ${lineNumber}: hãy chọn ít nhất một bao để chuyển.`;
        }
        if (this.lineTransferWeight(item) <= 0) {
          return `Dòng ${lineNumber}: cần ít nhất một bao ĐẠT chất lượng để chuyển sang kho đích.`;
        }
        continue;
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
