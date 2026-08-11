import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';
import { FormsModule } from '@angular/forms';
import {
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import {
  ApiResponse,
  CompleteMillingOrderPayload,
  CreateMillingOrderPayload,
  InventoryRow,
  MillingLocationOption,
  MillingOrderDetailDto,
  MillingOrderInputPayload,
  MillingOrderRow,
  MillingOrderStatusCode,
  MillingOutputType,
  MillingPaddyLotOption,
  MillingProductVariantOption,
  MillingSalesOrderOption,
  MillingWarehouseOption,
  MillingYieldOption,
  UpdateMillingOrderPayload,
} from '../../models';
import { AuthService } from '../../services/auth.service';
import { InventoryService } from '../../services/inventory.service';
import { MillingOrderService } from '../../services/milling-order.service';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

interface AllocationLine {
  key: number;
  paddyLotId: number | null;
  locationId: number | null;
  consumedWeightKg: number | null;
  note: string;
}

interface CreateOrderForm {
  id: number | null;
  sourceType: 'SALES_ORDER' | 'PRODUCTION_PLAN';
  salesOrderId: number | null;
  warehouseId: number | null;
  riceVarietyId: number | null;
  moisturePercent: number | null;
  expectedYield: number | null;
  targetRiceKg: number | null;
  expectedCompletionDate: string;
  millingCost: number | null;
  incidentalCost: number | null;
  reason: string;
  allocations: AllocationLine[];
}

interface OutputLine {
  key: number;
  outputType: MillingOutputType;
  productVariantId: number | null;
  locationId: number | null;
  bagCount: number | null;
  bagWeightKg: number | null;
  outputWeightKg: number | null;
  unitCost: number | null;
}

interface CompleteOrderForm {
  configuredYieldRate: number | null;
  machineRef: string;
  operatorId: number | null;
  lossKg: number | null;
  millingCost: number | null;
  incidentalCost: number | null;
  note: string;
  outputs: OutputLine[];
}

type StatusFilter = 'ALL' | MillingOrderStatusCode;

@Component({
  selector: 'app-milling-order',
  standalone: true,
  imports: [
    HasPermissionDirective,
    ReadonlyIfDirective,
    CommonModule,
    FormsModule,
    FilterSelectComponent,
  ],
  templateUrl: './milling-order.component.html',
  styleUrl: './milling-order.component.css',
})
export class MillingOrderComponent {
  private readonly service = inject(MillingOrderService);
  readonly perm = inject(PermissionService);
  // Xem chi tiết lệnh (đang sửa) khi không có quyền UPDATE.
  readonly viewOnly = computed(() => !!this.createForm().id && !this.perm.canUpdate('MILLING_ORDERS'));
  private readonly inventoryService = inject(InventoryService);
  private readonly authService = inject(AuthService);
  private readonly queryClient = injectQueryClient();
  private lineSequence = 0;

  readonly statusTabs: Array<{ code: StatusFilter; label: string }> = [
    { code: 'ALL', label: 'Tất cả' },
    { code: 'DRAFT', label: 'Nháp' },
    { code: 'RESERVED', label: 'Đã giữ lúa' },
    { code: 'IN_PROGRESS', label: 'Đang xay' },
    { code: 'COMPLETED', label: 'Hoàn tất' },
    { code: 'CANCELLED', label: 'Đã hủy' },
  ];

  readonly outputTypes: Array<{
    value: MillingOutputType;
    label: string;
    byproduct: boolean;
  }> = [
    { value: 'RICE', label: 'Gạo thành phẩm', byproduct: false },
    { value: 'BROKEN', label: 'Tấm', byproduct: true },
    { value: 'BRAN', label: 'Cám', byproduct: true },
    { value: 'HUSK', label: 'Trấu', byproduct: true },
  ];

  page = signal(1);
  pageSize = signal(10);
  searchInput = signal('');
  search = signal('');
  statusFilter = signal<StatusFilter>('ALL');
  warehouseFilter = signal<number | null>(null);
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showCreateModal = signal(false);
  showReserveModal = signal(false);
  showCompleteModal = signal(false);
  showDetailModal = signal(false);
  selectedOrderId = signal<number | null>(null);
  activeOrder = signal<MillingOrderRow | MillingOrderDetailDto | null>(null);
  saving = signal(false);
  actionLoadingId = signal<number | null>(null);

  createForm = signal<CreateOrderForm>(this.defaultCreateForm());
  reserveLines = signal<AllocationLine[]>([this.newAllocation()]);
  completeForm = signal<CompleteOrderForm>(this.defaultCompleteForm());

  listQuery = injectQuery(() => ({
    queryKey: [
      'milling-orders',
      'paged',
      this.page(),
      this.pageSize(),
      this.search(),
      this.statusFilter(),
      this.warehouseFilter(),
      this.sortField(),
      this.sortDir(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.service.getPaged(
          this.service.buildPagedBody({
            page: this.page(),
            pageSize: this.pageSize(),
            search: this.search(),
            statusId: this.statusIdFromCode(this.statusFilter()),
            warehouseId: this.warehouseFilter(),
            sortField: this.sortField(),
            sortDir: this.sortDir(),
          })
        )
      ),
  }));

  summaryQuery = injectQuery(() => ({
    queryKey: ['milling-orders', 'all'],
    queryFn: () => lastValueFrom(this.service.getAll()),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['milling-orders', 'detail', this.selectedOrderId()],
    enabled: this.showDetailModal() && !!this.selectedOrderId(),
    queryFn: () =>
      lastValueFrom(this.service.getById(this.selectedOrderId()!)),
  }));

  warehouseQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'warehouses'],
    queryFn: () => lastValueFrom(this.service.getWarehouses()),
    staleTime: 5 * 60 * 1000,
  }));

  locationQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'locations'],
    queryFn: () => lastValueFrom(this.service.getLocations()),
    staleTime: 2 * 60 * 1000,
  }));

  paddyLotQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'paddy-lots'],
    queryFn: () => lastValueFrom(this.service.getPaddyLots()),
    staleTime: 30 * 1000,
  }));

  variantQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'product-variants'],
    queryFn: () => lastValueFrom(this.service.getProductVariants()),
    staleTime: 5 * 60 * 1000,
  }));

  yieldQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'yield-configs'],
    queryFn: () => lastValueFrom(this.service.getYieldConfigs()),
    staleTime: 2 * 60 * 1000,
  }));

  riceVarietyQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'rice-varieties'],
    queryFn: () => lastValueFrom(this.service.getRiceVarieties()),
    staleTime: 5 * 60 * 1000,
  }));

  salesOrderQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'sales-orders'],
    queryFn: () => lastValueFrom(this.service.getSalesOrders()),
    staleTime: 60 * 1000,
  }));

  inventoryQuery = injectQuery(() => ({
    queryKey: ['milling-order-options', 'paddy-inventory'],
    queryFn: () =>
      lastValueFrom(
        this.inventoryService.getPagedAdvanced(
          this.inventoryService.buildPagedBody({
            page: 1,
            pageSize: 5000,
            search: '',
            sortField: 'id',
            sortDir: 'asc',
            colMap: { id: 0 },
            lotType: 'PADDY',
            withLotOnly: true,
          })
        )
      ),
    staleTime: 30 * 1000,
  }));

  rows = computed<MillingOrderRow[]>(() => {
    const resource = this.resource<any>(this.listQuery.data());
    return resource?.data ?? [];
  });

  total = computed<number>(() => {
    const resource = this.resource<any>(this.listQuery.data());
    return resource?.recordsFiltered ?? resource?.recordsTotal ?? 0;
  });

  allRows = computed<MillingOrderRow[]>(
    () => this.resourceList<MillingOrderRow>(this.summaryQuery.data())
  );

  detail = computed<MillingOrderDetailDto | null>(
    () => this.resource<MillingOrderDetailDto>(this.detailQuery.data()) ?? null
  );

  warehouses = computed<MillingWarehouseOption[]>(() =>
    this.resourceList<MillingWarehouseOption>(this.warehouseQuery.data())
      .filter((x) => x.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  locations = computed<MillingLocationOption[]>(() =>
    this.resourceList<MillingLocationOption>(this.locationQuery.data())
      .filter((x) => x.isActive !== false)
      .sort((a, b) => this.locationLabel(a).localeCompare(this.locationLabel(b)))
  );

  paddyLots = computed<MillingPaddyLotOption[]>(() =>
    this.resourceList<MillingPaddyLotOption>(this.paddyLotQuery.data())
      .filter(
        (lot) =>
          this.isEligiblePaddyLot(lot) &&
          this.paddyInventoryRows().some(
            (inventory) => inventory.paddyLotId === lot.id
          )
      )
      .sort((a, b) => {
        const dateA = a.inboundDate ? new Date(a.inboundDate).getTime() : 0;
        const dateB = b.inboundDate ? new Date(b.inboundDate).getTime() : 0;
        return dateA - dateB;
      })
  );

  paddyInventoryRows = computed<InventoryRow[]>(() => {
    const resource = this.resource<any>(this.inventoryQuery.data());
    const rows: InventoryRow[] = Array.isArray(resource?.data)
      ? resource.data
      : Array.isArray(resource)
        ? resource
        : [];
    return rows.filter((row) => {
      const lotType = String(row.lotType || '').toUpperCase();
      const status = String(row.lotStatusName || '').toUpperCase();
      return (
        lotType === 'PADDY' &&
        !!row.paddyLotId &&
        !!row.locationId &&
        Number(row.quantityAvailable) > 0 &&
        row.lotIsSellable !== false &&
        !status.includes('CÁCH LY') &&
        !status.includes('QUARANTINE') &&
        !status.includes('ĐANG XAY')
      );
    });
  });

  readonly isAdmin = computed(() =>
    this.hasRole(['ADMIN'], ['quản trị viên', 'system admin', 'admin'], [1001])
  );
  readonly isOwner = computed(() =>
    this.hasRole(
      ['OWNER'],
      ['chủ kho', 'chủ cơ sở', 'chủ hộ kinh doanh', 'warehouse owner', 'owner'],
      [1002]
    )
  );
  readonly isMillingStaff = computed(() =>
    this.hasRole(
      ['MILLING'],
      ['nhân viên xay xát', 'milling staff', 'milling'],
      [1009]
    )
  );
  readonly isWarehouseStaff = computed(() =>
    this.hasRole(
      ['WAREHOUSE'],
      ['nhân viên kho', 'warehouse staff', 'warehouse'],
      [1008]
    )
  );
  readonly canManageOrder = computed(
    () => this.isAdmin() || this.isOwner() || this.isMillingStaff()
  );
  readonly canReservePaddy = computed(
    () => this.canManageOrder() || this.isWarehouseStaff()
  );
  readonly canCompleteOrder = computed(
    () => this.canManageOrder() || this.isWarehouseStaff()
  );

  productVariants = computed<MillingProductVariantOption[]>(() =>
    this.resourceList<MillingProductVariantOption>(this.variantQuery.data())
      .filter((x) => x.isActive !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  );

  yieldConfigs = computed<MillingYieldOption[]>(() =>
    this.resourceList<MillingYieldOption>(this.yieldQuery.data()).filter(
      (x) => x.isActive !== false
    )
  );

  riceVarieties = computed(() =>
    this.resourceList<any>(this.riceVarietyQuery.data())
      .filter((x) => x.isActive !== false)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  );

  salesOrders = computed<MillingSalesOrderOption[]>(() => {
    return this.resourceList<MillingSalesOrderOption>(this.salesOrderQuery.data())
      .filter((x: MillingSalesOrderOption) => x.requiresMilling !== false)
      .sort((a: MillingSalesOrderOption, b: MillingSalesOrderOption) =>
        b.id - a.id
      );
  });

  varietyOptions = computed(() => {
    const map = new Map<number, { id: number; code?: string; name: string }>();

    // Tên chuẩn luôn lấy từ danh mục giống lúa, không dựng nhãn "Giống #ID".
    for (const variety of this.riceVarieties()) {
      const name = String(variety.name || '').trim();
      const code = String(variety.code || '').trim();
      if (variety.id != null && (name || code)) {
        map.set(variety.id, {
          id: variety.id,
          code: code || undefined,
          name: name || code,
        });
      }
    }

    // Các nguồn nghiệp vụ chỉ bổ sung dữ liệu lịch sử nếu danh mục không có.
    for (const config of this.yieldConfigs()) {
      if (config.riceVarietyId != null && !map.has(config.riceVarietyId)) {
        const name = String(
          config.riceVarietyName || config.riceVarietyCode || ''
        ).trim();
        if (!name) continue;
        map.set(config.riceVarietyId, {
          id: config.riceVarietyId,
          code: config.riceVarietyCode ?? undefined,
          name,
        });
      }
    }
    for (const lot of this.paddyLots()) {
      if (lot.riceVarietyId != null && !map.has(lot.riceVarietyId)) {
        const name = String(lot.riceVarietyName || '').trim();
        if (!name) continue;
        map.set(lot.riceVarietyId, {
          id: lot.riceVarietyId,
          name,
        });
      }
    }
    for (const order of this.salesOrders()) {
      if (order.riceVarietyId != null && !map.has(order.riceVarietyId)) {
        const name = String(
          order.riceVarietyDisplayName ||
            order.riceVarietyName ||
            order.riceVarietyCode ||
            ''
        ).trim();
        if (!name) continue;
        map.set(order.riceVarietyId, {
          id: order.riceVarietyId,
          code: order.riceVarietyCode ?? undefined,
          name,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  // ---- Options cho dropdown dùng chung (app-filter-select) ----
  readonly sourceTypeSelectOptions: FilterSelectOption[] = [
    { id: 'PRODUCTION_PLAN', name: 'Kế hoạch sản xuất' },
    { id: 'SALES_ORDER', name: 'Đơn bán cần xay' },
  ];
  readonly outputTypeSelectOptions: FilterSelectOption[] = this.outputTypes.map(
    (t) => ({ id: t.value, name: t.label })
  );
  readonly warehouseSelectOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({ id: w.id, name: w.name }))
  );
  readonly salesOrderSelectOptions = computed<FilterSelectOption[]>(() =>
    this.salesOrders().map((o) => ({
      id: o.id,
      name: `${o.soCode} — ${o.customerName || 'Khách hàng'}`,
    }))
  );
  readonly varietySelectOptions = computed<FilterSelectOption[]>(() =>
    this.varietyOptions().map((v) => ({
      id: v.id,
      name: `${v.code ? v.code + ' — ' : ''}${v.name}`,
    }))
  );

  lotSelectOptions(warehouseId: number | null): FilterSelectOption[] {
    return this.eligibleLotsForWarehouse(warehouseId).map((lot) => ({
      id: lot.id,
      name: this.lotLabel(lot),
    }));
  }
  inventoryLocationSelectOptions(
    paddyLotId: number | null,
    warehouseId: number | null
  ): FilterSelectOption[] {
    return this.inventoryLocationsForLot(paddyLotId, warehouseId).map((inv) => ({
      id: inv.locationId,
      name: this.inventoryLocationLabel(inv),
    }));
  }
  variantSelectOptions(type: MillingOutputType): FilterSelectOption[] {
    return this.variantsForType(type).map((v) => ({
      id: v.id,
      name: this.variantLabel(v),
    }));
  }
  locationSelectOptions(warehouseId: number | null): FilterSelectOption[] {
    return this.locationsForWarehouse(warehouseId).map((l) => ({
      id: l.id,
      name: this.locationLabel(l),
    }));
  }

  loading = computed(() => this.listQuery.isPending() || this.listQuery.isFetching());
  loadingDetail = computed(() => this.detailQuery.isPending());
  errorMessage = computed(() =>
    this.listQuery.isError()
      ? this.errorText(this.listQuery.error(), 'Không tải được danh sách lệnh xay.')
      : ''
  );

  expectedRiceThisMonth = computed(() => {
    const now = new Date();
    return this.allRows()
      .filter((row) => {
        const date = new Date(row.createdDate);
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          this.statusCode(row) !== 'CANCELLED'
        );
      })
      .reduce((sum, row) => sum + this.targetRice(row), 0);
  });

  inProgressCount = computed(
    () =>
      this.allRows().filter((row) =>
        ['RESERVED', 'IN_PROGRESS'].includes(
          this.statusCode(row)
        )
      ).length
  );

  averageYield7Days = computed(() => {
    const from = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completed = this.allRows().filter(
      (row) =>
        this.statusCode(row) === 'COMPLETED' &&
        !!row.completedAt &&
        new Date(row.completedAt).getTime() >= from &&
        row.yieldRateUsed > 0
    );
    if (!completed.length) return 0;
    return (
      completed.reduce((sum, row) => sum + row.yieldRateUsed, 0) /
      completed.length
    );
  });

  createComputedPaddyKg = computed(() => {
    const form = this.createForm();
    const rice = Number(form.targetRiceKg) || 0;
    const yieldRate = Number(form.expectedYield) || 0;
    return yieldRate > 0 ? rice / yieldRate : 0;
  });

  createAllocatedKg = computed(() =>
    this.createForm().allocations.reduce(
      (sum, line) => sum + (Number(line.consumedWeightKg) || 0),
      0
    )
  );

  reserveRequiredKg = computed(
    () => Number(this.activeOrder()?.computedPaddyKg) || 0
  );

  reserveAllocatedKg = computed(() =>
    this.reserveLines().reduce(
      (sum, line) => sum + (Number(line.consumedWeightKg) || 0),
      0
    )
  );

  completeInputKg = computed(() => {
    const order = this.activeOrder();
    if (!order) return 0;
    const inputs = order.inputs ?? [];
    const fromInputs = inputs.reduce(
      (sum, input) =>
        sum +
        (Number(input.reservedWeightKg ?? input.consumedWeightKg) || 0),
      0
    );
    return fromInputs > 0 ? fromInputs : Number(order.computedPaddyKg) || 0;
  });

  totalRiceOutputKg = computed(() =>
    this.completeForm().outputs
      .filter((line) => line.outputType === 'RICE')
      .reduce((sum, line) => sum + (Number(line.outputWeightKg) || 0), 0)
  );

  totalByproductKg = computed(() =>
    this.completeForm().outputs
      .filter((line) => line.outputType !== 'RICE')
      .reduce((sum, line) => sum + (Number(line.outputWeightKg) || 0), 0)
  );

  totalAllOutputsKg = computed(
    () => this.totalRiceOutputKg() + this.totalByproductKg()
  );

  computedPaddyToConsumeKg = computed(() => {
    const yieldRate = Number(this.completeForm().configuredYieldRate) || 0;
    return yieldRate > 0 ? this.totalRiceOutputKg() / yieldRate : 0;
  });

  actualYieldRate = computed(() => {
    const order = this.activeOrder();
    const expectedRice = order ? this.targetRice(order) : 0;
    return expectedRice > 0 ? this.totalRiceOutputKg() / expectedRice : 0;
  });

  yieldDeviationPercent = computed(() => {
    const order = this.activeOrder();
    const expectedRice = order ? this.targetRice(order) : 0;
    return expectedRice > 0
      ? ((this.totalRiceOutputKg() - expectedRice) / expectedRice) * 100
      : 0;
  });

  massBalanceDeltaKg = computed(
    () =>
      this.computedPaddyToConsumeKg() -
      this.totalAllOutputsKg() -
      (Number(this.completeForm().lossKg) || 0)
  );

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
  }

  applySearch(): void {
    this.page.set(1);
    this.search.set(this.searchInput().trim());
  }

  clearSearch(): void {
    this.searchInput.set('');
    this.search.set('');
    this.page.set(1);
  }

  setStatusFilter(code: StatusFilter): void {
    this.statusFilter.set(code);
    this.page.set(1);
  }

  setWarehouseFilter(value: unknown): void {
    this.warehouseFilter.set(this.toNullableNumber(value));
    this.page.set(1);
  }

  sortBy(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.update((value) => (value === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }

  refresh(): void {
    this.queryClient.invalidateQueries({ queryKey: ['milling-orders'] });
    this.queryClient.invalidateQueries({
      queryKey: ['milling-order-options', 'paddy-lots'],
    });
    this.queryClient.invalidateQueries({
      queryKey: ['milling-order-options', 'locations'],
    });
    this.queryClient.invalidateQueries({
      queryKey: ['milling-order-options', 'paddy-inventory'],
    });
  }

  openCreate(): void {
    if (!this.canManageOrder()) {
      void this.showPermissionDenied('Chỉ Admin, Chủ cơ sở hoặc Nhân viên xay xát được tạo lệnh.');
      return;
    }
    this.createForm.set(this.defaultCreateForm());
    this.showCreateModal.set(true);
  }

  openEdit(row: MillingOrderRow, event?: Event): void {
    event?.stopPropagation();
    // Cho phép mở để XEM (READ). Nếu không có quyền UPDATE, popup mở ở chế độ chỉ xem
    // (input khoá, ẩn nút lưu — xem viewOnly()). Chỉ đơn DRAFT mới mở form này.
    if (!['DRAFT', 'RESERVED', 'IN_PROGRESS'].includes(this.statusCode(row))) return;
    this.createForm.set({
      id: row.id,
      sourceType: row.salesOrderId ? 'SALES_ORDER' : 'PRODUCTION_PLAN',
      salesOrderId: row.salesOrderId ?? null,
      warehouseId: row.warehouseId,
      riceVarietyId: row.riceVarietyId ?? null,
      moisturePercent: row.moisturePercent ?? null,
      expectedYield: row.yieldRateUsed,
      targetRiceKg: this.targetRice(row),
      expectedCompletionDate: this.toDateInput(row.expectedCompletionDate),
      millingCost: row.millingCost ?? row.totalCost ?? null,
      incidentalCost: row.incidentalCost ?? null,
      reason: row.reason ?? '',
      allocations: [],
    });
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    if (this.saving()) return;
    this.showCreateModal.set(false);
    this.createForm.set(this.defaultCreateForm());
  }

  setCreateField(field: keyof CreateOrderForm, value: unknown): void {
    const numericFields: Array<keyof CreateOrderForm> = [
      'salesOrderId',
      'warehouseId',
      'riceVarietyId',
      'moisturePercent',
      'expectedYield',
      'targetRiceKg',
      'millingCost',
      'incidentalCost',
    ];
    const normalized = numericFields.includes(field)
      ? this.toNullableNumber(value)
      : value;

    this.createForm.update((form) => {
      const next = {
        ...form,
        [field]: normalized,
      } as CreateOrderForm;
      if (field === 'warehouseId') next.allocations = [];
      if (field === 'sourceType' && normalized === 'PRODUCTION_PLAN') {
        next.salesOrderId = null;
      }
      return next;
    });

    if (field === 'riceVarietyId' || field === 'moisturePercent') {
      this.applyRecommendedYield();
    }
  }

  selectSalesOrder(value: unknown): void {
    const id = this.toNullableNumber(value);
    const order = this.salesOrders().find((item) => item.id === id);
    this.createForm.update((form) => ({
      ...form,
      salesOrderId: id,
      warehouseId: order?.warehouseId ?? form.warehouseId,
      riceVarietyId: order?.riceVarietyId ?? null,
      targetRiceKg: order ? Number(order.remainingMillingRiceKg) || null : null,
      expectedCompletionDate:
        this.toDateInput(order?.expectedDeliveryDate) ||
        form.expectedCompletionDate,
      allocations:
        order?.warehouseId && order.warehouseId !== form.warehouseId
          ? []
          : form.allocations,
    }));
    this.applyRecommendedYield();
  }

  selectedSalesOrderWeightNote(): string {
    const order = this.salesOrders().find(
      (item) => item.id === this.createForm().salesOrderId
    );
    if (!order) return '';
    const total = Number(order.totalRiceRequiredKg) || 0;
    const allocated = Number(order.allocatedMillingRiceKg) || 0;
    const remaining = Number(order.remainingMillingRiceKg) || 0;
    return `Đơn cần ${this.fmtWeight(total)}; đã phân bổ ${this.fmtWeight(allocated)}; lệnh này lấy phần còn lại ${this.fmtWeight(remaining)}.`;
  }

  outputLocationSelectOptions(line: OutputLine): FilterSelectOption[] {
    return this.suitableOutputLocations(line).map((location, index) => ({
      id: location.id,
      name: `${index === 0 ? 'Gợi ý · ' : ''}${this.locationLabel(location)} · còn ${this.fmtWeight(
        Math.max(0, Number(location.maxCapacity ?? 0) - Number(location.currentOccupancy ?? 0))
      )}`,
    }));
  }

  selectedSalesOrderVarietyError(): string {
    const form = this.createForm();
    if (form.sourceType !== 'SALES_ORDER' || !form.salesOrderId) return '';
    const order = this.salesOrders().find((item) => item.id === form.salesOrderId);
    if (!order) return 'Không tìm thấy thông tin đơn bán đã chọn.';
    if (order.hasUnconfiguredRiceVariety)
      return 'Có sản phẩm chưa được cấu hình giống lúa. Hãy cập nhật biến thể sản phẩm trước.';
    if ((order.riceVarietyCount ?? 0) > 1)
      return 'Đơn bán có nhiều giống lúa. Hãy tách đơn theo từng giống trước khi tạo lệnh xay.';
    if (!order.riceVarietyId)
      return 'Không xác định được giống lúa từ sản phẩm của đơn bán.';
    return '';
  }

  applyRecommendedYield(): void {
    const form = this.createForm();
    const moisture = form.moisturePercent;
    const candidates = this.yieldConfigs()
      .filter(
        (item) =>
          item.riceVarietyId === form.riceVarietyId ||
          item.riceVarietyId == null
      )
      .filter((item) => {
        if (moisture == null) return true;
        const from = item.moistureFrom ?? Number.NEGATIVE_INFINITY;
        const to = item.moistureTo ?? Number.POSITIVE_INFINITY;
        return moisture >= from && moisture <= to;
      })
      .sort((a, b) => {
        const aSpecific = a.riceVarietyId === form.riceVarietyId ? 1 : 0;
        const bSpecific = b.riceVarietyId === form.riceVarietyId ? 1 : 0;
        return bSpecific - aSpecific;
      });
    if (candidates.length) {
      this.createForm.update((current) => ({
        ...current,
        expectedYield: candidates[0].yieldRate,
      }));
    }
  }

  addCreateAllocation(): void {
    this.createForm.update((form) => ({
      ...form,
      allocations: [...form.allocations, this.newAllocation()],
    }));
  }

  removeCreateAllocation(index: number): void {
    this.createForm.update((form) => ({
      ...form,
      allocations: form.allocations.filter((_, i) => i !== index),
    }));
  }

  setCreateAllocation(
    index: number,
    field: keyof AllocationLine,
    value: unknown
  ): void {
    this.createForm.update((form) => ({
      ...form,
      allocations: this.updateAllocationArray(
        form.allocations,
        index,
        field,
        value,
        this.createComputedPaddyKg()
      ),
    }));
  }

  async saveCreate(): Promise<void> {
    if (!this.canManageOrder()) {
      await this.showPermissionDenied('Bạn không có quyền lưu lệnh xay.');
      return;
    }
    const form = this.createForm();
    const error = this.validateCreateForm(form);
    if (error) {
      this.showError(error);
      return;
    }

    const confirmed = await Swal.fire({
      title: form.id ? 'Cập nhật lệnh xay?' : 'Tạo lệnh xay?',
      text:
        !form.id && form.allocations.length
          ? 'Hệ thống sẽ tạo lệnh và giữ các lô lúa đã chọn.'
          : undefined,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: form.id ? 'Cập nhật' : 'Tạo lệnh',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a052',
    });
    if (!confirmed.isConfirmed) return;

    this.saving.set(true);
    try {
      const payload = this.buildCreatePayload(form);
      if (form.id) {
        const result = await lastValueFrom(
          this.service.update({
            ...payload,
            id: form.id,
          } as UpdateMillingOrderPayload)
        );
        this.assertSucceeded(result);
        this.showCreateModal.set(false);
        this.createForm.set(this.defaultCreateForm());
        await this.afterCommand('Cập nhật lệnh xay thành công.');
        return;
      }

      const created = await lastValueFrom(this.service.create(payload));
      this.assertSucceeded(created);
      const orderId = this.createdId(created);

      if (form.allocations.length && orderId) {
        const reserved = await lastValueFrom(
          this.service.reserve(orderId, {
            inputs: this.toInputPayloads(form.allocations),
          })
        );
        if (!reserved?.isSucceeded) {
          this.showCreateModal.set(false);
          this.createForm.set(this.defaultCreateForm());
          await this.afterCommand();
          await Swal.fire({
            icon: 'warning',
            title: 'Đã tạo lệnh Nháp',
            text:
              reserved?.message ||
              'Giữ lúa chưa thành công. Hãy mở lệnh Nháp và chọn “Giữ lúa”.',
            confirmButtonColor: '#16a052',
          });
          return;
        }
      }

      this.showCreateModal.set(false);
      this.createForm.set(this.defaultCreateForm());
      await this.afterCommand(
        form.allocations.length
          ? 'Đã tạo lệnh và giữ lúa thành công.'
          : 'Tạo lệnh xay Nháp thành công.'
      );
    } catch (error) {
      this.showError(this.errorText(error, 'Không thể lưu lệnh xay.'));
    } finally {
      this.saving.set(false);
    }
  }

  async openReserve(row: MillingOrderRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canReservePaddy()) {
      void this.showPermissionDenied('Bạn không có quyền giữ lúa cho lệnh xay.');
      return;
    }
    if (!['DRAFT', 'RESERVED', 'IN_PROGRESS'].includes(this.statusCode(row))) return;

    this.actionLoadingId.set(row.id);
    try {
      let detail: MillingOrderRow | MillingOrderDetailDto = row;
      if (!row.inputs) {
        const response = await lastValueFrom(this.service.getById(row.id));
        this.assertSucceeded(response);
        detail = this.resource<MillingOrderDetailDto>(response) ?? row;
      }
      this.activeOrder.set(detail);
      const currentInputs = detail.inputs ?? [];
      this.reserveLines.set(
        currentInputs.length
          ? currentInputs.map((input) => ({
              key: ++this.lineSequence,
              paddyLotId: input.paddyLotId,
              locationId: input.locationId ?? null,
              consumedWeightKg:
                Number(input.reservedWeightKg ?? input.consumedWeightKg) || null,
              note: input.note ?? '',
            }))
          : [this.newAllocation()]
      );
      this.showReserveModal.set(true);
    } catch (error) {
      this.showError(this.errorText(error, 'Không thể tải phân bổ nguồn lúa.'));
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  closeReserve(): void {
    if (this.saving()) return;
    this.showReserveModal.set(false);
    this.activeOrder.set(null);
    this.reserveLines.set([this.newAllocation()]);
  }

  addReserveLine(): void {
    this.reserveLines.update((lines) => [...lines, this.newAllocation()]);
  }

  removeReserveLine(index: number): void {
    this.reserveLines.update((lines) =>
      lines.filter((_, current) => current !== index)
    );
  }

  setReserveLine(
    index: number,
    field: keyof AllocationLine,
    value: unknown
  ): void {
    this.reserveLines.update((lines) =>
      this.updateAllocationArray(
        lines,
        index,
        field,
        value,
        this.reserveRequiredKg()
      )
    );
  }

  async reservePaddy(): Promise<void> {
    if (!this.canReservePaddy()) {
      await this.showPermissionDenied('Bạn không có quyền giữ lúa cho lệnh xay.');
      return;
    }
    const order = this.activeOrder();
    if (!order) return;
    const error = this.validateAllocations(
      this.reserveLines(),
      this.reserveRequiredKg()
    );
    if (error) {
      this.showError(error);
      return;
    }

    this.saving.set(true);
    try {
      const result = await lastValueFrom(
        this.service.reserve(order.id, {
          inputs: this.toInputPayloads(this.reserveLines()),
        })
      );
      this.assertSucceeded(result);
      this.showReserveModal.set(false);
      this.activeOrder.set(null);
      this.reserveLines.set([this.newAllocation()]);
      await this.afterCommand(
        this.statusCode(order) === 'IN_PROGRESS'
          ? 'Điều chỉnh nguồn lúa đang xay thành công.'
          : this.statusCode(order) === 'RESERVED'
            ? 'Phân bổ lại lúa cho lệnh xay thành công.'
            : 'Giữ lúa cho lệnh xay thành công.'
      );
    } catch (error) {
      this.showError(this.errorText(error, 'Không thể giữ lúa.'));
    } finally {
      this.saving.set(false);
    }
  }

  async startOrder(row: MillingOrderRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canManageOrder()) {
      await this.showPermissionDenied('Bạn không có quyền bắt đầu lệnh xay.');
      return;
    }
    if (this.statusCode(row) !== 'RESERVED') return;
    const confirm = await Swal.fire({
      title: `Bắt đầu ${row.millingCode}?`,
      text: 'Lệnh sẽ chuyển sang trạng thái Đang xay.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Bắt đầu xay',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#16a052',
    });
    if (!confirm.isConfirmed) return;

    this.actionLoadingId.set(row.id);
    try {
      const result = await lastValueFrom(this.service.start(row.id));
      this.assertSucceeded(result);
      await this.afterCommand('Đã bắt đầu lệnh xay.');
    } catch (error) {
      this.showError(this.errorText(error, 'Không thể bắt đầu lệnh xay.'));
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  async cancelOrder(row: MillingOrderRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canManageOrder()) {
      await this.showPermissionDenied('Bạn không có quyền hủy lệnh xay.');
      return;
    }
    if (!['DRAFT', 'RESERVED'].includes(this.statusCode(row))) return;
    const confirm = await Swal.fire({
      title: `Hủy ${row.millingCode}?`,
      text:
        this.statusCode(row) === 'RESERVED'
          ? 'Toàn bộ lượng lúa đã giữ sẽ được giải phóng.'
          : 'Lệnh Nháp sẽ chuyển sang trạng thái Hủy.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hủy lệnh',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    this.actionLoadingId.set(row.id);
    try {
      const result = await lastValueFrom(this.service.cancel(row.id));
      this.assertSucceeded(result);
      await this.afterCommand('Đã hủy lệnh xay.');
    } catch (error) {
      this.showError(this.errorText(error, 'Không thể hủy lệnh xay.'));
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  async openComplete(row: MillingOrderRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canCompleteOrder()) {
      await this.showPermissionDenied('Bạn không có quyền nhập kết quả xay.');
      return;
    }
    if (this.statusCode(row) !== 'IN_PROGRESS') {
      return;
    }
    this.actionLoadingId.set(row.id);
    try {
      const response = await lastValueFrom(this.service.getById(row.id));
      this.assertSucceeded(response);
      const detail = this.resource<MillingOrderDetailDto>(response) ?? row;
      this.activeOrder.set(detail);
      this.completeForm.set(
        this.defaultCompleteForm(
          detail.yieldRateUsed,
          detail.millingCost ?? null,
          detail.incidentalCost ?? null
        )
      );
      this.showCompleteModal.set(true);
    } catch (error) {
      this.showError(
        this.errorText(error, 'Không tải được dữ liệu để hoàn tất lệnh.')
      );
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  closeComplete(): void {
    if (this.saving()) return;
    this.showCompleteModal.set(false);
    this.activeOrder.set(null);
    this.completeForm.set(this.defaultCompleteForm());
  }

  setCompleteField(field: keyof CompleteOrderForm, value: unknown): void {
    const numericFields: Array<keyof CompleteOrderForm> = [
      'configuredYieldRate',
      'operatorId',
      'lossKg',
      'millingCost',
      'incidentalCost',
    ];
    this.completeForm.update(
      (form) =>
        ({
          ...form,
          [field]: numericFields.includes(field)
            ? this.toNullableNumber(value)
            : value,
        }) as CompleteOrderForm
    );
  }

  addOutput(type: MillingOutputType = 'RICE'): void {
    this.completeForm.update((form) => ({
      ...form,
      outputs: [...form.outputs, this.newOutput(type)],
    }));
  }

  removeOutput(index: number): void {
    this.completeForm.update((form) => ({
      ...form,
      outputs: form.outputs.filter((_, current) => current !== index),
    }));
  }

  setOutputField(
    index: number,
    field: keyof OutputLine,
    value: unknown
  ): void {
    const numericFields: Array<keyof OutputLine> = [
      'productVariantId',
      'locationId',
      'bagCount',
      'bagWeightKg',
      'outputWeightKg',
      'unitCost',
    ];
    this.completeForm.update((form) => {
      const outputs = form.outputs.map((line, current) => {
        if (current !== index) return line;
        const normalized = numericFields.includes(field)
          ? this.toNullableNumber(value)
          : value;
        const updated = { ...line, [field]: normalized } as OutputLine;
        if (field === 'outputType') {
          updated.productVariantId = null;
          updated.locationId = null;
        }
        if (field === 'productVariantId') {
          const variant = this.productVariants().find(
            (item) => item.id === updated.productVariantId
          );
          updated.bagWeightKg = Number(variant?.weight) > 0 ? Number(variant?.weight) : null;
          const count = Number(updated.bagCount) || 0;
          if (count > 0 && updated.bagWeightKg) {
            updated.outputWeightKg = Number((count * updated.bagWeightKg).toFixed(3));
          }
          updated.locationId = this.suitableOutputLocations(updated)[0]?.id ?? null;
        }
        if (field === 'bagCount' || field === 'bagWeightKg') {
          const count = Number(updated.bagCount) || 0;
          const bagWeight = Number(updated.bagWeightKg) || 0;
          if (count > 0 && bagWeight > 0) {
            updated.outputWeightKg = Number((count * bagWeight).toFixed(3));
          }
        }
        if (['bagCount', 'bagWeightKg', 'outputWeightKg'].includes(String(field))) {
          const suitableIds = new Set(this.suitableOutputLocations(updated).map((item) => item.id));
          if (!updated.locationId || !suitableIds.has(updated.locationId)) {
            updated.locationId = this.suitableOutputLocations(updated)[0]?.id ?? null;
          }
        }
        return updated;
      });
      return { ...form, outputs };
    });
  }

  async completeOrder(): Promise<void> {
    if (!this.canCompleteOrder()) {
      await this.showPermissionDenied('Bạn không có quyền hoàn tất lệnh xay.');
      return;
    }
    const order = this.activeOrder();
    if (!order) return;
    const error = this.validateCompleteForm();
    if (error) {
      this.showError(error);
      return;
    }

    const deviation = Math.abs(this.yieldDeviationPercent());
    const confirm = await Swal.fire({
      title: `Hoàn tất ${order.millingCode}?`,
      html:
        `<div style="text-align:left;line-height:1.6">` +
        `<div>Gạo thành phẩm: <b>${this.fmtWeight(
          this.totalRiceOutputKg()
        )}</b></div>` +
        `<div>Lúa tính theo yield tham chiếu: <b>${this.fmtWeight(
          this.computedPaddyToConsumeKg()
        )}</b></div>` +
        `<div>Mức đạt kế hoạch: <b>${this.fmtPercent(
          this.actualYieldRate()
        )}</b></div>` +
        (deviation > 2
          ? `<div style="color:#b45309">Sai lệch yield ${this.yieldDeviationPercent().toFixed(
              2
            )}% — cần ghi nhận lý do.</div>`
          : '') +
        `</div>`,
      icon: deviation > 2 ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: 'Nhập kho & hoàn tất',
      cancelButtonText: 'Kiểm tra lại',
      confirmButtonColor: '#16a052',
    });
    if (!confirm.isConfirmed) return;

    this.saving.set(true);
    try {
      const form = this.completeForm();
      const payload: CompleteMillingOrderPayload = {
        outputs: form.outputs.map((line) => ({
          productVariantId: Number(line.productVariantId),
          locationId: line.locationId,
          outputType: line.outputType,
          outputWeightKg: Number(line.outputWeightKg),
          bagCount: line.bagCount,
          isByproduct: line.outputType !== 'RICE',
          unitCost: line.unitCost,
        })),
        lossKg: Number(form.lossKg) || 0,
        byproductKg: this.totalByproductKg(),
        millingCost: Number(form.millingCost) || 0,
        incidentalCost: Number(form.incidentalCost) || 0,
        machineRef: form.machineRef.trim() || null,
        operatorId: form.operatorId,
        note: form.note.trim() || null,
      };
      const result = await lastValueFrom(
        this.service.complete(order.id, payload)
      );
      this.assertSucceeded(result);
      this.showCompleteModal.set(false);
      this.activeOrder.set(null);
      this.completeForm.set(this.defaultCompleteForm());
      await this.afterCommand(
        'Đã hoàn tất lệnh, tạo lô đầu ra và nhập kho thành phẩm.'
      );
    } catch (error) {
      const message = this.errorText(error, 'Không thể hoàn tất lệnh xay.');
      if (message.includes('Chưa thể lấy đủ') || message.includes('bao đang cản')) {
        const choice = await Swal.fire({
          icon: 'warning',
          title: 'Nguồn lúa đang bị bao khác cản',
          text: message,
          showCancelButton: true,
          confirmButtonText: 'Điều chỉnh nguồn lúa',
          cancelButtonText: 'Ở lại kiểm tra',
          confirmButtonColor: '#16a052',
        });
        if (choice.isConfirmed) {
          this.showCompleteModal.set(false);
          this.completeForm.set(this.defaultCompleteForm());
          this.openReserve(order);
        }
      } else {
        this.showError(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  openDetail(row: MillingOrderRow): void {
    this.selectedOrderId.set(row.id);
    this.showDetailModal.set(true);
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedOrderId.set(null);
  }

  eligibleLotsForWarehouse(warehouseId: number | null): MillingPaddyLotOption[] {
    if (!warehouseId) return [];
    return this.paddyLots().filter(
      (lot) =>
        lot.warehouseId === warehouseId &&
        this.inventoryLocationsForLot(lot.id, warehouseId).length > 0
    );
  }

  inventoryLocationsForLot(
    paddyLotId: number | null,
    warehouseId: number | null
  ): InventoryRow[] {
    if (!paddyLotId || !warehouseId) return [];
    return this.paddyInventoryRows()
      .filter(
        (row) =>
          row.paddyLotId === paddyLotId &&
          row.warehouseId === warehouseId &&
          !!row.locationId
      )
      .sort((a, b) =>
        this.inventoryLocationLabel(a).localeCompare(
          this.inventoryLocationLabel(b)
        )
      );
  }

  inventoryLocationLabel(row: InventoryRow): string {
    const location = this.locations().find(
      (item) => item.id === row.locationId
    );
    const label = location
      ? this.locationLabel(location)
      : row.locationCode || `Vị trí #${row.locationId}`;
    return `${label} · khả dụng ${this.fmtWeight(row.quantityAvailable)}`;
  }

  locationsForWarehouse(
    warehouseId: number | null
  ): MillingLocationOption[] {
    if (!warehouseId) return [];
    return this.locations().filter(
      (location) =>
        location.warehouseId === warehouseId && !location.isQuarantine
    );
  }

  allocationLocationLabel(line: AllocationLine): string {
    if (!line.paddyLotId) return 'Chọn lô trước';
    if (!line.locationId) return 'Lô chưa được gán vị trí lưu kho';

    const location = this.locations().find(
      (item) => item.id === line.locationId
    );
    return location
      ? this.locationLabel(location)
      : `Vị trí #${line.locationId}`;
  }

  variantsForType(type: MillingOutputType): MillingProductVariantOption[] {
    const tokenByType: Partial<Record<MillingOutputType, string[]>> = {
      BROKEN: ['TAM-', 'TẤM', 'TAM '],
      BRAN: ['CAM-', 'CÁM', 'CAM '],
      HUSK: ['TRAU-', 'TRẤU', 'TRAU '],
    };
    return this.productVariants()
      .filter((variant) => {
        const text = `${variant.sku ?? ''} ${variant.name ?? ''} ${variant.productName ?? ''}`.toUpperCase();
        if (type === 'RICE') {
          return variant.isByproduct !== true &&
            (text.includes('GAO-') || text.includes('GẠO') || text.includes('GAO '));
        }
        const tokens = tokenByType[type] ?? [];
        return variant.isByproduct === true && tokens.some((token) => text.includes(token));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private suitableOutputLocations(line: OutputLine): MillingLocationOption[] {
    const order = this.activeOrder();
    const variant = this.productVariants().find((item) => item.id === line.productVariantId);
    if (!order || !variant) return [];
    const requiredKg = Number(line.outputWeightKg) || 0;
    return this.locations()
      .filter((location) => {
        const remaining = Number(location.maxCapacity ?? 0) - Number(location.currentOccupancy ?? 0);
        return location.warehouseId === order.warehouseId &&
          location.isActive !== false &&
          !location.isQuarantine &&
          (!location.allowedCategoryId || location.allowedCategoryId === variant.productCategoryId) &&
          (!location.currentProductVariantId || location.currentProductVariantId === variant.id) &&
          remaining + 0.0005 >= requiredKg;
      })
      .sort((a, b) => {
        const sameA = a.currentProductVariantId === variant.id ? 0 : 1;
        const sameB = b.currentProductVariantId === variant.id ? 0 : 1;
        const priorityA = Number(a.priority) || 3;
        const priorityB = Number(b.priority) || 3;
        const remainingA = Number(a.maxCapacity ?? 0) - Number(a.currentOccupancy ?? 0);
        const remainingB = Number(b.maxCapacity ?? 0) - Number(b.currentOccupancy ?? 0);
        return sameA - sameB || priorityA - priorityB || remainingA - remainingB || a.id - b.id;
      });
  }

  lotLabel(lot: MillingPaddyLotOption): string {
    const variety =
      lot.riceVarietyName || lot.productVariantName || lot.sku || 'Lúa';
    return `${lot.lotCode} · ${variety} · ${this.fmtWeight(
      lot.remainingWeightKg
    )}`;
  }

  locationLabel(location: MillingLocationOption): string {
    const code =
      location.slotCode ||
      [location.shelfRow, location.shelfLevel].filter(Boolean).join('/');
    return [location.zoneName, code].filter(Boolean).join(' · ') || `#${location.id}`;
  }

  variantLabel(variant: MillingProductVariantOption): string {
    return [variant.sku, variant.name || variant.productName]
      .filter(Boolean)
      .join(' — ');
  }

  sourceLabel(row: MillingOrderRow): string {
    if (row.salesOrderCode) return row.salesOrderCode;
    if (row.salesOrderId) return `Đơn bán #${row.salesOrderId}`;
    return row.reason ? 'Kế hoạch sản xuất' : 'Kế hoạch nội bộ';
  }

  inputLabel(row: MillingOrderRow): string {
    if (row.inputs?.length) {
      return row.inputs
        .map((input) => input.lotCode || `Lô #${input.paddyLotId}`)
        .join(', ');
    }
    return this.fmtWeight(row.computedPaddyKg);
  }

  targetRice(row: MillingOrderRow): number {
    return Number(row.targetRiceKg ?? row.totalRiceOutputKg) || 0;
  }

  statusCode(row: MillingOrderRow): MillingOrderStatusCode {
    const raw = String(row.statusCode || '').toUpperCase();
    if (
      ['DRAFT', 'RESERVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(
        raw
      )
    ) {
      return raw as MillingOrderStatusCode;
    }
    return (
      {
        1: 'DRAFT',
        2: 'RESERVED',
        3: 'IN_PROGRESS',
        5: 'COMPLETED',
        6: 'CANCELLED',
      } as Record<number, MillingOrderStatusCode>
    )[row.statusId] ?? 'DRAFT';
  }

  statusLabel(row: MillingOrderRow): string {
    return (
      row.statusName ||
      {
        DRAFT: 'Nháp',
        RESERVED: 'Đã giữ lúa',
        IN_PROGRESS: 'Đang xay',
        COMPLETED: 'Hoàn tất',
        CANCELLED: 'Hủy',
      }[this.statusCode(row)]
    );
  }

  statusClass(row: MillingOrderRow): string {
    return `status-${this.statusCode(row).toLowerCase().replace('_', '-')}`;
  }

  outputTypeLabel(type?: string | null): string {
    return (
      this.outputTypes.find((item) => item.value === type)?.label ||
      type ||
      'Đầu ra'
    );
  }

  fmtWeight(value: number | null | undefined): string {
    return `${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 3,
    }).format(Number(value) || 0)} kg`;
  }

  fmtTon(value: number | null | undefined): string {
    return `${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 2,
    }).format((Number(value) || 0) / 1000)} t`;
  }

  fmtPercent(value: number | null | undefined): string {
    return `${new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).format((Number(value) || 0) * 100)}%`;
  }

  fmtMoney(value: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  fmtDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('vi-VN').format(date);
  }

  fmtDateTime(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(date);
  }

  toNullableNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private defaultCreateForm(): CreateOrderForm {
    return {
      id: null,
      sourceType: 'PRODUCTION_PLAN',
      salesOrderId: null,
      warehouseId: null,
      riceVarietyId: null,
      moisturePercent: null,
      expectedYield: 0.68,
      targetRiceKg: null,
      expectedCompletionDate: '',
      millingCost: null,
      incidentalCost: null,
      reason: '',
      allocations: [],
    };
  }

  private defaultCompleteForm(
    yieldRate = 0.68,
    millingCost: number | null = null,
    incidentalCost: number | null = null
  ): CompleteOrderForm {
    return {
      configuredYieldRate: yieldRate || 0.68,
      machineRef: '',
      operatorId: null,
      lossKg: 0,
      millingCost,
      incidentalCost,
      note: '',
      outputs: [this.newOutput('RICE')],
    };
  }

  private newAllocation(): AllocationLine {
    return {
      key: ++this.lineSequence,
      paddyLotId: null,
      locationId: null,
      consumedWeightKg: null,
      note: '',
    };
  }

  private newOutput(type: MillingOutputType): OutputLine {
    return {
      key: ++this.lineSequence,
      outputType: type,
      productVariantId: null,
      locationId: null,
      bagCount: null,
      bagWeightKg: null,
      outputWeightKg: null,
      unitCost: null,
    };
  }

  private updateAllocationArray(
    lines: AllocationLine[],
    index: number,
    field: keyof AllocationLine,
    value: unknown,
    requiredKg: number
  ): AllocationLine[] {
    return lines.map((line, current) => {
      if (current !== index) return line;
      const numericFields: Array<keyof AllocationLine> = [
        'paddyLotId',
        'locationId',
        'consumedWeightKg',
      ];
      const normalized = numericFields.includes(field)
        ? this.toNullableNumber(value)
        : value;
      const updated = { ...line, [field]: normalized } as AllocationLine;
      if (field === 'paddyLotId') {
        const lot = this.paddyLots().find(
          (item) => item.id === updated.paddyLotId
        );
        const inventories = lot
          ? this.inventoryLocationsForLot(lot.id, lot.warehouseId)
          : [];
        updated.locationId =
          inventories.length === 1 ? inventories[0].locationId ?? null : null;
        updated.consumedWeightKg = null;
        if (lot && inventories.length === 1) {
          const otherAllocated = lines.reduce(
            (sum, item, lineIndex) =>
              lineIndex === index
                ? sum
                : sum + (Number(item.consumedWeightKg) || 0),
            0
          );
          const desired = Math.max(0, requiredKg - otherAllocated);
          updated.consumedWeightKg = Math.min(
            Number(inventories[0].quantityAvailable) || 0,
            desired || Number(inventories[0].quantityAvailable) || 0
          );
        }
      }
      if (field === 'locationId' && updated.paddyLotId && updated.locationId) {
        const lot = this.paddyLots().find(
          (item) => item.id === updated.paddyLotId
        );
        const inventory = this.paddyInventoryRows().find(
          (item) =>
            item.paddyLotId === updated.paddyLotId &&
            item.locationId === updated.locationId
        );
        if (lot && inventory) {
          const otherAllocated = lines.reduce(
            (sum, item, lineIndex) =>
              lineIndex === index
                ? sum
                : sum + (Number(item.consumedWeightKg) || 0),
            0
          );
          const desired = Math.max(0, requiredKg - otherAllocated);
          updated.consumedWeightKg = Math.min(
            Number(inventory.quantityAvailable) || 0,
            desired || Number(inventory.quantityAvailable) || 0
          );
        }
      }
      return updated;
    });
  }

  private buildCreatePayload(
    form: CreateOrderForm
  ): CreateMillingOrderPayload {
    return {
      warehouseId: Number(form.warehouseId),
      reason: form.reason.trim() || null,
      salesOrderId:
        form.sourceType === 'SALES_ORDER' ? form.salesOrderId : null,
      riceVarietyId: form.riceVarietyId,
      moisturePercent: form.moisturePercent,
      expectedYield: Number(form.expectedYield),
      targetRiceKg: Number(form.targetRiceKg),
      millingCost: Number(form.millingCost) || 0,
      incidentalCost: Number(form.incidentalCost) || 0,
      expectedCompletionDate: form.expectedCompletionDate
        ? new Date(`${form.expectedCompletionDate}T12:00:00`).toISOString()
        : null,
    };
  }

  private validateCreateForm(form: CreateOrderForm): string | null {
    if (!form.warehouseId) return 'Vui lòng chọn kho thực hiện xay.';
    if (form.sourceType === 'SALES_ORDER' && !form.salesOrderId) {
      return 'Vui lòng chọn đơn bán cần xay.';
    }
    if (form.sourceType === 'SALES_ORDER') {
      const varietyError = this.selectedSalesOrderVarietyError();
      if (varietyError) return varietyError;
    }
    if (
      form.expectedYield == null ||
      form.expectedYield <= 0 ||
      form.expectedYield > 1
    ) {
      return 'Yield áp dụng phải lớn hơn 0 và không vượt quá 1.';
    }
    if (form.targetRiceKg == null || form.targetRiceKg <= 0) {
      return 'Số kg gạo dự kiến phải lớn hơn 0.';
    }
    if (form.allocations.length) {
      return this.validateAllocations(
        form.allocations,
        this.createComputedPaddyKg()
      );
    }
    return null;
  }

  private validateAllocations(
    lines: AllocationLine[],
    requiredKg: number
  ): string | null {
    if (!lines.length) return 'Vui lòng thêm ít nhất một lô lúa đầu vào.';
    const selected = new Set<string>();
    let total = 0;
    for (const line of lines) {
      if (!line.paddyLotId) return 'Mỗi dòng đầu vào phải chọn một lô lúa.';
      if (!line.locationId) return 'Mỗi dòng đầu vào phải có vị trí/cột.';
      if (!line.consumedWeightKg || line.consumedWeightKg <= 0) {
        return 'Khối lượng giữ tại mỗi dòng phải lớn hơn 0.';
      }
      const lot = this.paddyLots().find((item) => item.id === line.paddyLotId);
      if (!lot) return 'Có lô lúa không còn đủ điều kiện để xay.';
      const inventory = this.paddyInventoryRows().find(
        (item) =>
          item.paddyLotId === line.paddyLotId &&
          item.locationId === line.locationId
      );
      if (!inventory) {
        return `Lô ${lot.lotCode} không còn tồn khả dụng tại vị trí đã chọn.`;
      }
      const ownReserved = (this.activeOrder()?.inputs ?? [])
        .filter(
          (input) =>
            input.paddyLotId === line.paddyLotId &&
            input.locationId === line.locationId
        )
        .reduce(
          (sum, input) =>
            sum + Number(input.reservedWeightKg ?? input.consumedWeightKg ?? 0),
          0
        );
      const reallocatableAvailable = inventory.quantityAvailable + ownReserved;
      if (line.consumedWeightKg > reallocatableAvailable + 0.001) {
        return `Lô ${lot.lotCode} tại vị trí đã chọn chỉ còn khả dụng ${this.fmtWeight(
          reallocatableAvailable
        )}.`;
      }
      const key = `${line.paddyLotId}:${line.locationId}`;
      if (selected.has(key)) {
        return `Lô ${lot.lotCode} tại cùng vị trí đang bị chọn trùng.`;
      }
      selected.add(key);
      total += Number(line.consumedWeightKg);
    }
    if (requiredKg > 0 && Math.abs(total - requiredKg) > 0.01) {
      return `Tổng lượng giữ phải bằng lượng lúa dự kiến ${this.fmtWeight(
        requiredKg
      )}. Hiện đã phân bổ ${this.fmtWeight(total)}.`;
    }
    return null;
  }

  private validateCompleteForm(): string | null {
    const form = this.completeForm();
    if (
      !form.configuredYieldRate ||
      form.configuredYieldRate <= 0 ||
      form.configuredYieldRate > 1
    ) {
      return 'Yield cấu hình phải lớn hơn 0 và không vượt quá 1.';
    }
    if (!form.outputs.length) return 'Vui lòng thêm ít nhất một dòng đầu ra.';
    if (!form.outputs.some((line) => line.outputType === 'RICE')) {
      return 'Phải có ít nhất một dòng gạo thành phẩm.';
    }
    for (const line of form.outputs) {
      if (!line.productVariantId) {
        return `${this.outputTypeLabel(
          line.outputType
        )}: chưa chọn SKU đầu ra.`;
      }
      if (!line.locationId) {
        return `${this.outputTypeLabel(
          line.outputType
        )}: chưa chọn vị trí nhập kho.`;
      }
      if (!line.outputWeightKg || line.outputWeightKg <= 0) {
        return `${this.outputTypeLabel(
          line.outputType
        )}: khối lượng phải lớn hơn 0.`;
      }
    }
    if (this.totalRiceOutputKg() <= 0) {
      return 'Khối lượng gạo thành phẩm phải lớn hơn 0.';
    }
    const currentBackendLimit = this.computedPaddyToConsumeKg() * 1.02;
    const outputAndLoss =
      this.totalAllOutputsKg() + (Number(form.lossKg) || 0);
    if (
      this.computedPaddyToConsumeKg() > 0 &&
      outputAndLoss > currentBackendLimit
    ) {
      return `Tổng đầu ra và hao hụt ${this.fmtWeight(
        outputAndLoss
      )} vượt quá lượng lúa tính ngược + 2% dung sai.`;
    }
    if (
      Math.abs(this.yieldDeviationPercent()) > 2 &&
      !form.note.trim()
    ) {
      return 'Sai lệch yield trên 2%. Vui lòng nhập ghi chú/lý do.';
    }
    return null;
  }

  private toInputPayloads(
    lines: AllocationLine[]
  ): MillingOrderInputPayload[] {
    return lines.map((line) => ({
      paddyLotId: Number(line.paddyLotId),
      locationId: line.locationId,
      consumedWeightKg: 0,
      reservedWeightKg: Number(line.consumedWeightKg),
      note: line.note.trim() || null,
    }));
  }

  private hasRole(
    codes: string[],
    names: string[],
    fallbackIds: number[] = []
  ): boolean {
    const normalizedCodes = codes.map((value) => value.toUpperCase());
    const normalizedNames = names.map((value) =>
      this.normalizeRoleValue(value)
    );
    return (this.authService.currentUser()?.roles ?? []).some((role) => {
      const roleCode = String((role as any).code ?? '').toUpperCase();
      const roleName = this.normalizeRoleValue(role.name);
      return (
        fallbackIds.includes(Number(role.id)) ||
        normalizedCodes.includes(roleCode) ||
        normalizedNames.some(
          (name) => roleName === name || roleName.includes(name)
        )
      );
    });
  }

  private normalizeRoleValue(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private async showPermissionDenied(message: string): Promise<void> {
    await Swal.fire({
      icon: 'warning',
      title: 'Không có quyền thực hiện',
      text: message,
      confirmButtonColor: '#16a052',
    });
  }

  private isEligiblePaddyLot(lot: MillingPaddyLotOption): boolean {
    const lotType = String(lot.lotType || '').toUpperCase();
    const status = `${lot.statusCode || ''} ${lot.statusName || ''}`.toUpperCase();
    const blocked = [
      'QUARANTINE',
      'CÁCH LY',
      'PROCESSING',
      'CHỜ XỬ LÝ',
      'MILLING',
      'ĐANG XAY',
      'DEPLETED',
      'ĐÃ DÙNG HẾT',
    ].some((text) => status.includes(text));
    return (
      (lotType === 'PADDY' || lotType === 'LUA' || lotType === 'LÚA') &&
      lot.remainingWeightKg > 0 &&
      !blocked
    );
  }

  private statusIdFromCode(code: StatusFilter): number | null {
    return (
      {
        ALL: null,
        DRAFT: 1,
        RESERVED: 2,
        IN_PROGRESS: 3,
        COMPLETED: 5,
        CANCELLED: 6,
      } as Record<StatusFilter, number | null>
    )[code];
  }

  private resource<T>(response: unknown): T | null {
    const value = response as any;
    return (value?.resources ?? value?.data ?? value ?? null) as T | null;
  }

  private resourceList<T>(response: unknown): T[] {
    const resource = this.resource<any>(response);
    if (Array.isArray(resource)) return resource as T[];
    if (Array.isArray(resource?.data)) return resource.data as T[];
    if (Array.isArray(resource?.items)) return resource.items as T[];
    if (Array.isArray(resource?.Items)) return resource.Items as T[];
    if (Array.isArray(resource?.resources)) return resource.resources as T[];
    return [];
  }

  private assertSucceeded(response: ApiResponse<any>): void {
    if (!response?.isSucceeded) {
      throw new Error(response?.message || 'Yêu cầu không thành công.');
    }
  }

  private createdId(response: ApiResponse<any>): number | null {
    const resource = this.resource<any>(response);
    const value =
      typeof resource === 'number'
        ? resource
        : resource?.id ?? resource?.orderId ?? resource?.OrderId;
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private async afterCommand(message?: string): Promise<void> {
    this.refresh();
    if (message) {
      await Swal.fire({
        icon: 'success',
        title: 'Thành công',
        text: message,
        timer: 1700,
        showConfirmButton: false,
      });
    }
  }

  private showError(message: string): void {
    void Swal.fire({
      icon: 'error',
      title: 'Không thể thực hiện',
      text: message,
      confirmButtonColor: '#16a052',
    });
  }

  private errorText(error: unknown, fallback: string): string {
    const value = error as any;
    return (
      value?.error?.message ||
      value?.message ||
      value?.error?.errors?.[0] ||
      fallback
    );
  }

  private toDateInput(value?: string | null): string {
    return value ? String(value).substring(0, 10) : '';
  }
}
