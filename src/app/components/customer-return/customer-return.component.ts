import { CommonModule } from "@angular/common";
import { Component, OnDestroy, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  injectQuery,
  injectQueryClient,
  keepPreviousData,
} from "@tanstack/angular-query-experimental";
import { lastValueFrom } from "rxjs";
import Swal from "sweetalert2";

import { HasPermissionDirective } from "../../directives/has-permission.directive";
import { ApiResponse } from "../../models/common";
import { CustomerRow } from "../../models/customer";
import { FEEDBACK_TYPE_LABELS } from "../../models/customer-feedback";
import {
  CUSTOMER_RETURN_STATUS,
  CreateCustomerReturnItemPayload,
  CreateCustomerReturnPayload,
  CustomerReturnDetail,
  CustomerReturnImpactPreview,
  CustomerReturnPage,
  CustomerReturnRow,
  CustomerReturnSourceOrder,
  InspectCustomerReturnItemPayload,
  InspectCustomerReturnPayload,
} from "../../models/customer-return";
import { STANDARD_RETURN_STATUSES } from "../../models/customer-return-order-status";
import { LocationDetailDto } from "../../models/location";
import { WarehouseRow } from "../../models/warehouse";
import { CustomerReturnService } from "../../services/customer-return.service";
import { CustomerReturnOrderStatusService } from "../../services/customer-return-order-status.service";
import { CustomerService } from "../../services/customer.service";
import { LocationService } from "../../services/location.service";
import { PermissionService } from "../../services/permission.service";
import { WarehouseService } from "../../services/warehouse.service";
import {
  FilterSelectComponent,
  FilterSelectOption,
} from "../shared/filter-select.component";

type ReturnTab = "ALL" | "PENDING_APPROVAL" | "RECEIVED" | "CONFIRMED";

interface ReturnFormLine {
  key: string;
  outboundOrderItemId: number;
  outboundAllocationId: number;
  paddyLotId: number;
  originalLocationId: number | null;
  productVariantId: number;
  productName: string;
  sku: string;
  lotCode: string;
  maxQuantity: number;
  quantityReturned: number;
}

interface ReturnFormSkuGroup {
  key: string;
  productVariantId: number;
  productName: string;
  sku: string;
  maxQuantity: number;
  quantityReturned: number;
  allocationCount: number;
}

interface ReturnFormState {
  customerFeedbackId: number | null;
  outboundOrderId: number | null;
  customerId: number | null;
  warehouseId: number | null;
  returnReason: string;
  note: string;
  lines: ReturnFormLine[];
}

interface ReceiveSkuGroup {
  key: string;
  itemId: number;
  productVariantId: number;
  productName: string;
  sku: string;
  approvedQuantity: number;
  receivedQuantity: number;
  allocations: Array<{
    itemId: number;
    allocationId: number;
    approvedQuantity: number;
  }>;
}

interface InspectionAllocationMember {
  itemId: number;
  allocationId: number;
  originalLocationId: number | null;
  quantityReceived: number;
  unitCreditPrice: number;
}

interface InspectionSkuGroup {
  key: string;
  itemId: number;
  originalLocationId: number | null;
  productVariantId: number;
  productName: string;
  sku: string;
  standardBagWeightKg: number;
  quantityReturned: number;
  quantityGood: number;
  quantityDamaged: number;
  quantityRejected: number;
  creditQuantity: number;
  unitCreditPrice: number;
  restockLocationId: number | null;
  quarantineLocationId: number | null;
  rejectedLocationId: number | null;
  damageReason: string;
  rejectionReason: string;
  note: string;
  bags: Array<{ weightKg: number; condition: "GOOD" | "DAMAGED" }>;
  allocations: InspectionAllocationMember[];
}

interface AllocatedInspectionMember extends InspectionAllocationMember {
  quantityGood: number;
  quantityDamaged: number;
  quantityRejected: number;
  creditQuantity: number;
  bags: Array<{ weightKg: number; condition: "GOOD" | "DAMAGED" }>;
}

@Component({
  selector: "app-customer-return",
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective, FilterSelectComponent],
  templateUrl: "./customer-return.component.html",
  styleUrl: "./customer-return.component.css",
})
export class CustomerReturnComponent implements OnDestroy {
  readonly feedbackTypeLabels = FEEDBACK_TYPE_LABELS;
  readonly bagConditionOptions: FilterSelectOption[] = [
    { id: "GOOD", name: "Bao đạt" },
    { id: "DAMAGED", name: "Bao cách ly" },
  ];
  private readonly service = inject(CustomerReturnService);
  private readonly customerService = inject(CustomerService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly locationService = inject(LocationService);
  private readonly statusService = inject(CustomerReturnOrderStatusService);
  private readonly permission = inject(PermissionService);
  private readonly queryClient = injectQueryClient();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly status = CUSTOMER_RETURN_STATUS;
  readonly pageSize = 10;
  readonly activeTab = signal<ReturnTab>("ALL");
  readonly page = signal(1);
  readonly searchInput = signal("");
  readonly search = signal("");
  readonly customerFilter = signal<number | null>(null);
  readonly warehouseFilter = signal<number | null>(null);
  readonly dateFrom = signal("");
  readonly dateTo = signal("");
  readonly selectedId = signal<number | null>(null);
  readonly showCreateModal = signal(false);
  readonly showRefundModal = signal(false);
  readonly refundAmount = signal<number | null>(null);
  readonly refundNote = signal("");
  readonly refundAmountError = signal("");
  readonly saving = signal(false);
  readonly actionLoading = signal(false);
  readonly loadingSource = signal(false);
  readonly inspectionOpen = signal(false);
  readonly receiveOpen = signal(false);
  readonly receiveSkuGroups = signal<ReceiveSkuGroup[]>([]);
  readonly inspectionLines = signal<InspectionSkuGroup[]>([]);
  readonly form = signal<ReturnFormState>(this.emptyForm());
  readonly returnSkuQuantities = signal<Record<string, number>>({});
  readonly returnFormSkuGroups = computed<ReturnFormSkuGroup[]>(() => {
    const quantities = this.returnSkuQuantities();
    const groups = new Map<string, ReturnFormSkuGroup>();
    this.form().lines.forEach(line => {
      const key = this.returnFormGroupKey(line);
      const group = groups.get(key) || {
        key,
        productVariantId: line.productVariantId,
        productName: line.productName,
        sku: line.sku,
        maxQuantity: 0,
        quantityReturned: quantities[key] ?? 0,
        allocationCount: 0,
      };
      group.maxQuantity += Number(line.maxQuantity || 0);
      group.allocationCount += 1;
      groups.set(key, group);
    });
    return [...groups.values()];
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const returnOrderId = Number(params.get("returnOrderId"));
    const outboundId = Number(params.get("outboundId"));
    const feedbackId = Number(params.get("feedbackId"));
    if (returnOrderId > 0) this.selectedId.set(returnOrderId);
    if (
      outboundId > 0 &&
      feedbackId > 0 &&
      this.permission.canCreate("CUSTOMER_RETURNS")
    ) {
      this.form.update(form => ({ ...form, customerFeedbackId: feedbackId, returnReason: params.get("reason") || "" }));
      this.showCreateModal.set(true);
      void this.setSourceOutbound(String(outboundId));
    }
  }

  readonly tabs: { key: ReturnTab; label: string }[] = [
    { key: "ALL", label: "Tất cả" },
    { key: "PENDING_APPROVAL", label: "Chờ duyệt" },
    { key: "RECEIVED", label: "Chờ kiểm định" },
    { key: "CONFIRMED", label: "Đã xác nhận tồn" },
  ];

  private readonly customersQuery = injectQuery(() => ({
    queryKey: ["customer-return", "customers"],
    queryFn: async () =>
      this.resourceArray<CustomerRow>(
        await lastValueFrom(this.customerService.getAll()),
      ),
    staleTime: 60_000,
  }));

  private readonly warehousesQuery = injectQuery(() => ({
    queryKey: ["customer-return", "warehouses"],
    queryFn: async () =>
      this.resourceArray<WarehouseRow>(
        await lastValueFrom(this.warehouseService.getAll()),
      ),
    staleTime: 60_000,
  }));

  private readonly locationsQuery = injectQuery(() => ({
    queryKey: ["customer-return", "locations"],
    queryFn: async () =>
      this.resourceArray<LocationDetailDto>(
        await lastValueFrom(this.locationService.getAll()),
      ),
    staleTime: 60_000,
  }));

  private readonly outboundsQuery = injectQuery(() => ({
    queryKey: ["customer-return", "outbounds"],
    queryFn: async () => {
      const response = await lastValueFrom(this.service.getSources());
      return this.resourceArray<CustomerReturnSourceOrder>(response);
    },
    staleTime: 30_000,
  }));

  private readonly listQuery = injectQuery(() => ({
    queryKey: [
      "customer-returns",
      this.page(),
      this.search(),
      this.activeTab(),
      this.customerFilter(),
      this.warehouseFilter(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: async () =>
      this.unwrap<CustomerReturnPage>(
        await lastValueFrom(
          this.service.getPaged({
            page: this.page(),
            pageSize: this.pageSize,
            keyword: this.search(),
            statusCode: this.activeTab() === "ALL" ? null : this.activeTab(),
            customerId: this.customerFilter(),
            warehouseId: this.warehouseFilter(),
            dateFrom: this.dateFrom(),
            dateTo: this.dateTo(),
          }),
        ),
      ),
    placeholderData: keepPreviousData,
  }));

  private readonly summaryQuery = injectQuery(() => ({
    queryKey: ["customer-returns", "summary"],
    queryFn: async () =>
      this.unwrap<CustomerReturnPage>(
        await lastValueFrom(this.service.getPaged({ page: 1, pageSize: 1000 })),
      ).dataSource,
    staleTime: 30_000,
  }));

  readonly rows = computed(() => this.listQuery.data()?.dataSource || []);
  readonly total = computed(() => this.listQuery.data()?.totalFiltered || 0);
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize)),
  );
  readonly activeId = computed(
    () => this.selectedId() ?? this.rows()[0]?.id ?? null,
  );

  private readonly detailQuery = injectQuery(() => ({
    queryKey: ["customer-returns", "detail", this.activeId()],
    enabled: this.activeId() != null,
    queryFn: async () => {
      const id = this.activeId();
      if (id == null) throw new Error("Chưa chọn phiếu trả hàng.");
      return this.unwrap<CustomerReturnDetail>(
        await lastValueFrom(this.service.getById(id)),
      );
    },
  }));

  readonly detail = computed(() => this.detailQuery.data() || null);

  private readonly impactQuery = injectQuery(() => ({
    queryKey: ["customer-returns", "impact", this.detail()?.id],
    enabled:
      this.detail()?.statusCode === CUSTOMER_RETURN_STATUS.INSPECTED ||
      this.detail()?.statusCode === CUSTOMER_RETURN_STATUS.CONFIRMED,
    queryFn: async () => {
      const id = this.detail()?.id;
      if (!id) throw new Error("Chưa chọn phiếu trả hàng.");
      return this.unwrap<CustomerReturnImpactPreview>(
        await lastValueFrom(this.service.getImpactPreview(id)),
      );
    },
  }));

  readonly impact = computed(() => this.impactQuery.data() || null);
  readonly loadingImpact = computed(() => this.impactQuery.isPending());
  readonly inspectionCreditAmount = computed(() =>
    this.inspectionLines().reduce(
      (total, line) => total + this.allocateInspectionGroup(line).reduce(
        (groupTotal, allocation) =>
          groupTotal + allocation.creditQuantity * allocation.unitCreditPrice,
        0,
      ),
      0,
    ),
  );
  readonly customers = computed(() => this.customersQuery.data() || []);
  readonly warehouses = computed(() =>
    (this.warehousesQuery.data() || []).filter((item) => item.isActive),
  );
  readonly locations = computed(() =>
    (this.locationsQuery.data() || []).filter((item) => item.isActive),
  );
  readonly outbounds = computed(() => this.outboundsQuery.data() || []);
  readonly customerFilterOptions = computed<FilterSelectOption[]>(() =>
    this.customers().map(customer => ({ id: customer.id, name: customer.name })),
  );
  readonly warehouseFilterOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map(warehouse => ({ id: warehouse.id, name: warehouse.name })),
  );
  readonly sourceOutboundOptions = computed<FilterSelectOption[]>(() =>
    this.outbounds().map(outbound => ({
      id: outbound.outboundOrderId,
      name: `${outbound.outboundOrderCode} · ${outbound.salesOrderCode} · ${outbound.customerName} · còn ${this.fmtWeight(outbound.returnableQuantity)}`,
    })),
  );
  readonly restockLocations = computed(() =>
    this.locations().filter(
      (location) =>
        location.warehouseId === this.detail()?.warehouseId &&
        !location.isQuarantine &&
        !location.isOutboundStaging &&
        !location.isLockedForOutbound,
    ),
  );
  readonly quarantineLocations = computed(() =>
    this.locations().filter(
      (location) =>
        location.warehouseId === this.detail()?.warehouseId &&
        location.isQuarantine &&
        !location.isOutboundStaging &&
        !location.isLockedForOutbound,
    ),
  );

  readonly loading = computed(
    () => this.listQuery.isFetching() && this.listQuery.data() == null,
  );
  readonly loadingDetail = computed(
    () =>
      this.activeId() != null &&
      this.detailQuery.isFetching() &&
      this.detailQuery.data() == null,
  );
  readonly errorMessage = computed(() =>
    this.listQuery.isError() ? this.errorText(this.listQuery.error()) : "",
  );
  readonly summary = computed(() => {
    const rows = this.summaryQuery.data() || [];
    return {
      waitingInspection: rows.filter(
        (row) => row.statusCode === CUSTOMER_RETURN_STATUS.RECEIVED,
      ).length,
      waitingApproval: rows.filter(
        (row) => row.statusCode === CUSTOMER_RETURN_STATUS.PENDING_APPROVAL,
      ).length,
      restockedKg: rows
        .filter((row) => row.statusCode === CUSTOMER_RETURN_STATUS.CONFIRMED)
        .reduce((sum, row) => sum + Number(row.totalQuantityGood || 0), 0),
      quarantinedKg: rows
        .filter((row) => row.statusCode === CUSTOMER_RETURN_STATUS.CONFIRMED)
        .reduce((sum, row) => sum + Number(row.totalQuantityDamaged || 0), 0),
    };
  });

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  setTab(tab: ReturnTab): void {
    this.activeTab.set(tab);
    this.page.set(1);
    this.selectedId.set(null);
    this.inspectionOpen.set(false);
    this.receiveOpen.set(false);
  }

  onSearch(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.selectedId.set(null);
      this.search.set(value.trim());
    }, 350);
  }

  setCustomerFilter(value: string | number | null): void {
    this.customerFilter.set(value ? Number(value) : null);
    this.resetList();
  }

  setWarehouseFilter(value: string | number | null): void {
    this.warehouseFilter.set(value ? Number(value) : null);
    this.resetList();
  }

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
    this.resetList();
  }

  setDateTo(value: string): void {
    this.dateTo.set(value);
    this.resetList();
  }

  selectReturn(id: number): void {
    this.selectedId.set(id);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { returnOrderId: id },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
    this.inspectionOpen.set(false);
    this.receiveOpen.set(false);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.selectedId.set(null);
    this.inspectionOpen.set(false);
    this.receiveOpen.set(false);
  }

  openCreate(): void {
    if (!this.permission.canCreate("CUSTOMER_RETURNS")) return;
    this.form.set(this.emptyForm());
    this.returnSkuQuantities.set({});
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    if (this.saving()) return;
    this.showCreateModal.set(false);
  }

  async setSourceOutbound(value: string | number | null): Promise<void> {
    const id = value ? Number(value) : null;
    if (!id) {
      this.returnSkuQuantities.set({});
      this.form.update((form) => ({
        ...form,
        outboundOrderId: null,
        customerId: null,
        warehouseId: null,
        lines: [],
      }));
      return;
    }

    this.loadingSource.set(true);
    try {
      const detail = this.unwrap(
        await lastValueFrom(this.service.getSourceById(id)),
      );
      const lines: ReturnFormLine[] = detail.items.flatMap((item) =>
        item.allocations
          .filter((allocation) => allocation.quantityReturnable > 0)
          .map((allocation) => ({
            key: `out-${allocation.outboundOrderItemAllocationId}`,
            outboundOrderItemId: item.outboundOrderItemId,
            outboundAllocationId: allocation.outboundOrderItemAllocationId,
            paddyLotId: allocation.paddyLotId,
            originalLocationId: allocation.originalLocationId,
            productVariantId: item.productVariantId,
            productName: item.productVariantName,
            sku: item.sku || "",
            lotCode: allocation.paddyLotCode || `Lô #${allocation.paddyLotId}`,
            maxQuantity: allocation.quantityReturnable,
            quantityReturned: 0,
          })),
      );
      this.form.set({
        ...this.form(),
        outboundOrderId: id,
        customerId: detail.customerId,
        warehouseId: detail.warehouseId,
        lines,
      });
      this.returnSkuQuantities.set({});
    } catch (error) {
      await this.alertError(error);
    } finally {
      this.loadingSource.set(false);
    }
  }

  updateFormField(
    field: "customerId" | "warehouseId" | "returnReason" | "note",
    value: string,
  ): void {
    this.form.update((form) => ({
      ...form,
      [field]:
        field === "customerId" || field === "warehouseId"
          ? value
            ? Number(value)
            : null
          : value,
      ...(field === "warehouseId" ? { lines: [] } : {}),
    }));
  }

  updateReturnQuantity(key: string, value: string | number): void {
    this.returnSkuQuantities.update(quantities => ({
      ...quantities,
      [key]: Number(value) || 0,
    }));
  }

  private returnFormGroupKey(line: ReturnFormLine): string {
    return line.productVariantId > 0
      ? `variant-${line.productVariantId}`
      : `item-${line.outboundOrderItemId}`;
  }

  private distributeReturnFormQuantities(lines: ReturnFormLine[]): ReturnFormLine[] {
    const remainingByGroup = { ...this.returnSkuQuantities() };
    return lines.map(line => {
      const key = this.returnFormGroupKey(line);
      const quantityReturned = this.takeQuantity(
        line.maxQuantity,
        remainingByGroup[key] ?? 0,
      );
      remainingByGroup[key] = Number(remainingByGroup[key] || 0) - quantityReturned;
      return { ...line, quantityReturned };
    });
  }

  async submitCreate(): Promise<void> {
    const form = this.form();
    const selectedLines = this.distributeReturnFormQuantities(form.lines).filter(
      (line) => line.quantityReturned > 0,
    );
    if (!form.outboundOrderId || !form.customerId || !form.warehouseId) {
      await this.message(
        "Thiếu thông tin",
        "Vui lòng chọn đơn xuất gốc hợp lệ.",
        "warning",
      );
      return;
    }
    const invalidGroup = this.returnFormSkuGroups().find(group =>
      !Number.isFinite(group.quantityReturned) ||
      group.quantityReturned < 0 ||
      group.quantityReturned > group.maxQuantity,
    );
    if (invalidGroup) {
      await this.message(
        "Số lượng không hợp lệ",
        `${invalidGroup.productName} chỉ có thể trả tối đa ${this.fmtWeight(invalidGroup.maxQuantity)}.`,
        "warning",
      );
      return;
    }
    if (!selectedLines.length) {
      await this.message(
        "Chưa có hàng trả",
        "Nhập số lượng trả lớn hơn 0 cho ít nhất một lô.",
        "warning",
      );
      return;
    }
    if (!form.returnReason.trim()) {
      await this.message(
        "Thiếu lý do trả hàng",
        "Vui lòng nhập lý do trả hàng.",
        "warning",
      );
      return;
    }
    if (form.returnReason.trim().length > 500 || form.note.trim().length > 1000) {
      await this.message(
        "Nội dung quá dài",
        "Lý do tối đa 500 ký tự và ghi chú tối đa 1.000 ký tự.",
        "warning",
      );
      return;
    }
    const invalid = selectedLines.find(
      (line) => line.quantityReturned > line.maxQuantity,
    );
    if (invalid) {
      await this.message(
        "Số lượng không hợp lệ",
        `${invalid.lotCode} chỉ có thể trả tối đa ${this.fmtWeight(invalid.maxQuantity)}.`,
        "warning",
      );
      return;
    }

    const grouped = new Map<string, CreateCustomerReturnItemPayload>();
    selectedLines.forEach((line) => {
      const key = `${line.outboundOrderItemId}-${line.productVariantId}`;
      const item = grouped.get(key) || {
        outboundOrderItemId: line.outboundOrderItemId,
        productVariantId: line.productVariantId,
        quantityReturned: 0,
        allocations: [],
      };
      item.quantityReturned += line.quantityReturned;
      item.allocations.push({
        outboundOrderItemAllocationId: line.outboundAllocationId,
        quantityReturned: line.quantityReturned,
      });
      grouped.set(key, item);
    });

    const payload: CreateCustomerReturnPayload = {
      warehouseId: form.warehouseId,
      customerId: form.customerId,
      outboundOrderId: form.outboundOrderId,
      customerFeedbackId: form.customerFeedbackId,
      returnReason: form.returnReason.trim() || null,
      note: form.note.trim() || null,
      items: [...grouped.values()],
    };

    this.saving.set(true);
    try {
      const response = await lastValueFrom(this.service.create(payload));
      this.ensureSucceeded(response);
      this.showCreateModal.set(false);
      await this.refresh();
      await this.message(
        "Thành công",
        response.message || "Đã tạo phiếu trả hàng.",
        "success",
      );
    } catch (error) {
      await this.alertError(error);
    } finally {
      this.saving.set(false);
    }
  }

  async approve(): Promise<void> {
    const detail = this.detail();
    if (!detail || detail.statusCode !== CUSTOMER_RETURN_STATUS.PENDING_APPROVAL) return;
    const result = await Swal.fire({
      title: "Duyệt phiếu trả hàng?",
      text: "Sau khi duyệt, nhân viên kho có thể tiếp nhận hàng trả thực tế.",
      input: "textarea",
      inputLabel: "Ghi chú duyệt (không bắt buộc)",
      showCancelButton: true,
      confirmButtonText: "Duyệt phiếu",
      cancelButtonText: "Đóng",
      confirmButtonColor: "#16a052",
    });
    if (!result.isConfirmed) return;
    await this.runAction(
      () => this.service.approve(detail.id, result.value || undefined),
      "Đã duyệt phiếu trả hàng.",
    );
  }

  beginInspection(): void {
    const detail = this.detail();
    if (!detail || ![
      CUSTOMER_RETURN_STATUS.RECEIVED,
      CUSTOMER_RETURN_STATUS.INSPECTED,
    ].includes(detail.statusCode as any))
      return;

    const editingInspection = detail.statusCode === CUSTOMER_RETURN_STATUS.INSPECTED;
    const groups = new Map<string, InspectionSkuGroup>();

    detail.items.forEach(item => item.allocations.forEach(allocation => {
      const productVariantId = Number(item.productVariantId || allocation.productVariantId);
      const key = productVariantId > 0 ? `variant-${productVariantId}` : `item-${item.id}`;
      const current = groups.get(key) || {
        key,
        itemId: item.id,
        originalLocationId: null,
        productVariantId,
        productName: item.productVariantName || item.sku || "Sản phẩm",
        sku: item.sku || allocation.sku || "",
        standardBagWeightKg: Number(item.standardBagWeightKg || 0),
        quantityReturned: 0,
        quantityGood: 0,
        quantityDamaged: 0,
        quantityRejected: 0,
        creditQuantity: 0,
        unitCreditPrice: Number(allocation.unitCreditPrice || 0),
        restockLocationId: null,
        quarantineLocationId: null,
        rejectedLocationId: null,
        damageReason: "",
        rejectionReason: "",
        note: "",
        bags: [],
        allocations: [],
      };

      current.quantityReturned += Number(allocation.quantityReceived || 0);
      current.quantityGood += editingInspection
        ? Number(allocation.quantityGood || 0)
        : Number(allocation.quantityReceived || 0);
      current.quantityDamaged += editingInspection ? Number(allocation.quantityDamaged || 0) : 0;
      current.quantityRejected += editingInspection ? Number(allocation.quantityRejected || 0) : 0;
      current.creditQuantity += editingInspection ? Number(allocation.creditQuantity || 0) : 0;
      current.allocations.push({
        itemId: item.id,
        allocationId: allocation.id,
        originalLocationId: allocation.originalLocationId ?? null,
        quantityReceived: Number(allocation.quantityReceived || 0),
        unitCreditPrice: Number(allocation.unitCreditPrice || 0),
      });

      if (editingInspection) {
        current.restockLocationId ??= allocation.restockLocationId ?? null;
        current.quarantineLocationId ??= allocation.quarantineLocationId ?? null;
        current.rejectedLocationId ??= allocation.rejectedLocationId ?? null;
        current.damageReason = this.appendUniqueText(current.damageReason, item.damageReason);
        current.rejectionReason = this.appendUniqueText(current.rejectionReason, allocation.rejectionReason);
        current.note = this.appendUniqueText(current.note, allocation.note);
        if (allocation.bags?.length) {
          current.bags.push(...allocation.bags.map(bag => ({ ...bag })));
        }
      }
      groups.set(key, current);
    }));

    const inspectionGroups = [...groups.values()].map(group => {
      const originalLocationIds = group.allocations.map(member => member.originalLocationId);
      group.originalLocationId = originalLocationIds.length > 0 &&
        originalLocationIds[0] != null &&
        originalLocationIds.every(id => id === originalLocationIds[0])
        ? originalLocationIds[0]
        : null;
      if (!editingInspection) {
        group.bags = this.defaultInspectionBags(
          group.quantityReturned,
          group.standardBagWeightKg,
          "GOOD",
        );
      } else if (!group.bags.length) {
        group.bags = [
          ...this.defaultInspectionBags(
            group.quantityGood,
            group.standardBagWeightKg,
            "GOOD",
          ),
          ...this.defaultInspectionBags(
            group.quantityDamaged,
            group.standardBagWeightKg,
            "DAMAGED",
          ),
        ];
      }

      group.restockLocationId = this.initialLocationId(
        group.quantityGood,
        group.restockLocationId,
        this.restockLocationOptions(group),
      );
      group.quarantineLocationId = this.initialLocationId(
        group.quantityDamaged,
        group.quarantineLocationId,
        this.quarantineLocationOptions(group),
      );
      group.rejectedLocationId = this.initialLocationId(
        group.quantityRejected,
        group.rejectedLocationId,
        this.rejectedLocationOptions(group),
      );
      return group;
    });

    this.inspectionLines.set(inspectionGroups);
    this.inspectionOpen.set(true);
  }


  addInspectionBag(groupKey: string, condition: "GOOD" | "DAMAGED"): void {
    this.inspectionLines.update(lines => lines.map(line => line.key === groupKey
      ? { ...line, bags: [...line.bags, { weightKg: 0, condition }] }
      : line));
  }

  updateInspectionBag(groupKey: string, index: number, weightKg: number): void {
    this.inspectionLines.update(lines => lines.map(line => line.key === groupKey
      ? { ...line, bags: line.bags.map((bag, i) => i === index ? { ...bag, weightKg: Number(weightKg) } : bag) }
      : line));
  }

  updateInspectionBagCondition(groupKey: string, index: number, condition: "GOOD" | "DAMAGED"): void {
    this.inspectionLines.update(lines => lines.map(line => line.key === groupKey
      ? { ...line, bags: line.bags.map((bag, i) => i === index ? { ...bag, condition } : bag) }
      : line));
  }

  removeInspectionBag(groupKey: string, index: number): void {
    this.inspectionLines.update(lines => lines.map(line => line.key === groupKey
      ? { ...line, bags: line.bags.filter((_, i) => i !== index) }
      : line));
  }

  updateInspection(
    groupKey: string,
    field: keyof InspectionSkuGroup,
    value: string | number,
  ): void {
    this.inspectionLines.update((lines) =>
      lines.map((line) => {
        if (line.key !== groupKey) return line;
        const numericFields: (keyof InspectionSkuGroup)[] = [
          "quantityGood",
          "quantityDamaged",
          "quantityRejected",
          "creditQuantity",
          "restockLocationId",
          "quarantineLocationId",
          "rejectedLocationId",
        ];
        const nextValue = numericFields.includes(field)
          ? value === "" || value == null
            ? field.toString().endsWith("LocationId")
              ? null
              : 0
            : Number(value)
          : value;
        const nextLine = { ...line, [field]: nextValue } as InspectionSkuGroup;
        if (field === "quantityGood") {
          if (nextLine.quantityGood <= 0) {
            nextLine.restockLocationId = null;
          } else if (!this.restockLocationOptions(nextLine)
            .some(option => option.id === nextLine.restockLocationId)) {
            nextLine.restockLocationId = this.restockLocationOptions(nextLine)[0]?.id ?? null;
          }
        }
        if (field === "quantityDamaged") {
          if (nextLine.quantityDamaged <= 0) {
            nextLine.quarantineLocationId = null;
          } else if (!this.quarantineLocationOptions(nextLine)
            .some(option => option.id === nextLine.quarantineLocationId)) {
            nextLine.quarantineLocationId = this.quarantineLocationOptions(nextLine)[0]?.id ?? null;
          }
        }
        if (field === "quantityRejected") {
          if (nextLine.quantityRejected <= 0) {
            nextLine.rejectedLocationId = null;
          } else if (!this.rejectedLocationOptions(nextLine)
            .some(option => option.id === nextLine.rejectedLocationId)) {
            nextLine.rejectedLocationId = this.rejectedLocationOptions(nextLine)[0]?.id ?? null;
          }
        }
        return nextLine;
      }),
    );
  }

  async submitInspection(): Promise<void> {
    const detail = this.detail();
    if (!detail) return;
    const lines = this.inspectionLines();
    for (const line of lines) {
      const classified =
        line.quantityGood + line.quantityDamaged + line.quantityRejected;
      if (
        !Number.isFinite(classified) ||
        line.quantityGood < 0 ||
        line.quantityDamaged < 0 ||
        line.quantityRejected < 0 ||
        line.creditQuantity < 0 ||
        Math.abs(classified - line.quantityReturned) > 0.001
      ) {
        await this.message(
          "Số lượng chưa khớp",
          `Tổng phân loại của ${line.productName} phải bằng ${this.fmtWeight(line.quantityReturned)}.`,
          "warning",
        );
        return;
      }
      if (line.creditQuantity > line.quantityGood + line.quantityDamaged) {
        await this.message(
          "Số lượng hoàn tiền không hợp lệ",
          `${line.productName} chỉ được hoàn tối đa ${this.fmtWeight(line.quantityGood + line.quantityDamaged)} theo lượng nhận lại.`,
          "warning",
        );
        return;
      }
      const goodBagKg = line.bags.filter(x => x.condition === "GOOD").reduce((sum, x) => sum + Number(x.weightKg || 0), 0);
      const damagedBagKg = line.bags.filter(x => x.condition === "DAMAGED").reduce((sum, x) => sum + Number(x.weightKg || 0), 0);
      const oversizedBag = line.standardBagWeightKg > 0
        ? line.bags.find(x => Number(x.weightKg) > line.standardBagWeightKg + 0.001)
        : undefined;
      if (oversizedBag) {
        await this.message("Khối lượng bao không hợp lệ", `Mỗi bao không được lớn hơn trọng lượng đóng bao chuẩn ${this.fmtWeight(line.standardBagWeightKg)}. Hãy tách thành các bao vật lý thực tế.`, "warning");
        return;
      }
      if (line.bags.some(x => !Number.isFinite(x.weightKg) || x.weightKg <= 0)
        || Math.abs(goodBagKg - line.quantityGood) > 0.001
        || Math.abs(damagedBagKg - line.quantityDamaged) > 0.001) {
        await this.message("Cân bao chưa khớp", `Tổng cân bao đạt/hỏng của ${line.productName} phải khớp số kg phân loại.`, "warning");
        return;
      }
      if (line.quantityGood > 0 && !line.restockLocationId) {
        await this.message(
          "Thiếu vị trí",
          "Không có cột trống hoặc cột cùng SKU đủ sức chứa.",
          "warning",
        );
        return;
      }
      if (line.quantityGood > 0 &&
        !this.restockLocationOptions(line).some(option => option.id === line.restockLocationId)) {
        await this.message(
          "Vị trí không còn phù hợp",
          "Chỉ được nhập lại vào cột trống hoặc cột cùng SKU đủ sức chứa.",
          "warning",
        );
        return;
      }
      if (line.quantityDamaged > 0 && !line.quarantineLocationId) {
        await this.message(
          "Thiếu vị trí",
          `Chọn vị trí cách ly cho ${line.productName}.`,
          "warning",
        );
        return;
      }
      if (line.quantityDamaged > 0 &&
        !this.quarantineLocationOptions(line)
          .some(option => option.id === line.quarantineLocationId)) {
        await this.message(
          "Vị trí cách ly không còn phù hợp",
          "Vị trí cách ly không tương thích SKU hoặc không còn đủ sức chứa.",
          "warning",
        );
        return;
      }
      if (
        (line.quantityDamaged > 0 || line.quantityRejected > 0) &&
        !line.damageReason.trim()
      ) {
        await this.message(
          "Thiếu lý do",
          `Nhập lý do xử lý ${line.productName}.`,
          "warning",
        );
        return;
      }
      if (line.quantityRejected > 0 && (!line.rejectedLocationId || !line.rejectionReason.trim())) {
        await this.message(
          "Thiếu thông tin hàng trả lại",
          `Chọn vị trí và nhập lý do trả lại khách cho ${line.productName}.`,
          "warning",
        );
        return;
      }
      if (line.quantityRejected > 0 &&
        !this.rejectedLocationOptions(line)
          .some(option => option.id === line.rejectedLocationId)) {
        await this.message(
          "Vị trí giữ hàng không còn phù hợp",
          "Vị trí giữ hàng không tương thích SKU hoặc không còn đủ sức chứa.",
          "warning",
        );
        return;
      }
    }

    const items = new Map<number, InspectCustomerReturnItemPayload>();
    lines.forEach(line => this.allocateInspectionGroup(line).forEach(allocation => {
      const current = items.get(allocation.itemId) || {
        customerReturnOrderItemId: allocation.itemId,
        qualityStatus: "GOOD",
        damageReason: null,
        allocations: [],
      };
      current.damageReason = this.appendUniqueText(
        current.damageReason || "",
        line.damageReason,
      ) || null;
      current.allocations.push({
        returnAllocationId: allocation.allocationId,
        quantityGood: allocation.quantityGood,
        quantityDamaged: allocation.quantityDamaged,
        quantityRejected: allocation.quantityRejected,
        creditQuantity: allocation.creditQuantity,
        restockLocationId: allocation.quantityGood > 0 ? line.restockLocationId : null,
        quarantineLocationId: allocation.quantityDamaged > 0 ? line.quarantineLocationId : null,
        rejectedLocationId: allocation.quantityRejected > 0 ? line.rejectedLocationId : null,
        rejectionReason: allocation.quantityRejected > 0
          ? line.rejectionReason.trim() || null
          : null,
        note: line.note.trim() || null,
        bags: allocation.bags,
      });
      items.set(allocation.itemId, current);
    }));

    items.forEach(item => {
      const quantityGood = item.allocations.reduce((sum, allocation) => sum + allocation.quantityGood, 0);
      const quantityDamaged = item.allocations.reduce((sum, allocation) => sum + allocation.quantityDamaged, 0);
      const quantityRejected = item.allocations.reduce((sum, allocation) => sum + allocation.quantityRejected, 0);
      item.qualityStatus = quantityRejected > 0 && quantityGood === 0 && quantityDamaged === 0
        ? "EXPIRED"
        : quantityDamaged > 0 || quantityRejected > 0
          ? "DAMAGED"
          : "GOOD";
    });

    const payload: InspectCustomerReturnPayload = {
      id: detail.id,
      items: [...items.values()],
    };
    await this.runAction(
      () => this.service.inspect(payload),
      "Đã lưu kết quả kiểm tra chất lượng.",
    );
    this.inspectionOpen.set(false);
    this.receiveOpen.set(false);
  }

  private allocateInspectionGroup(group: InspectionSkuGroup): AllocatedInspectionMember[] {
    let remainingGood = Number(group.quantityGood || 0);
    let remainingDamaged = Number(group.quantityDamaged || 0);
    let remainingRejected = Number(group.quantityRejected || 0);
    let remainingCredit = Number(group.creditQuantity || 0);

    const allocations = group.allocations.map(member => {
      let capacity = Number(member.quantityReceived || 0);
      const quantityGood = this.takeQuantity(capacity, remainingGood);
      capacity -= quantityGood;
      remainingGood -= quantityGood;
      const quantityDamaged = this.takeQuantity(capacity, remainingDamaged);
      capacity -= quantityDamaged;
      remainingDamaged -= quantityDamaged;
      const quantityRejected = this.takeQuantity(capacity, remainingRejected);
      remainingRejected -= quantityRejected;
      return {
        ...member,
        quantityGood,
        quantityDamaged,
        quantityRejected,
        creditQuantity: 0,
        bags: [],
      };
    });

    allocations.forEach(allocation => {
      allocation.creditQuantity = this.takeQuantity(
        allocation.quantityGood + allocation.quantityDamaged,
        remainingCredit,
      );
      remainingCredit -= allocation.creditQuantity;
    });
    this.allocateBagsToMembers(group.bags, "GOOD", allocations);
    this.allocateBagsToMembers(group.bags, "DAMAGED", allocations);
    return allocations;
  }

  private allocateBagsToMembers(
    bags: InspectionSkuGroup["bags"],
    condition: "GOOD" | "DAMAGED",
    allocations: AllocatedInspectionMember[],
  ): void {
    const assigned = allocations.map(allocation => ({
      allocation,
      remaining: condition === "GOOD"
        ? allocation.quantityGood
        : allocation.quantityDamaged,
    }));
    let allocationIndex = 0;

    bags.filter(bag => bag.condition === condition).forEach(bag => {
      let remainingBagWeight = Number(bag.weightKg || 0);
      while (remainingBagWeight > 0.0005 && allocationIndex < assigned.length) {
        const target = assigned[allocationIndex];
        if (target.remaining <= 0.0005) {
          allocationIndex += 1;
          continue;
        }
        const weightKg = this.takeQuantity(target.remaining, remainingBagWeight);
        target.allocation.bags.push({ weightKg, condition });
        target.remaining -= weightKg;
        remainingBagWeight -= weightKg;
      }
    });
  }

  private takeQuantity(capacity: number, requested: number): number {
    return Math.round(Math.min(Math.max(capacity, 0), Math.max(requested, 0)) * 1000) / 1000;
  }

  private defaultInspectionBags(
    quantity: number,
    standardBagWeightKg: number,
    condition: "GOOD" | "DAMAGED",
  ): InspectionSkuGroup["bags"] {
    const bags: InspectionSkuGroup["bags"] = [];
    let remaining = Number(quantity || 0);
    const maxBagWeight = Number(standardBagWeightKg || 0) > 0
      ? Number(standardBagWeightKg)
      : remaining;
    while (remaining > 0.0005) {
      const weightKg = this.takeQuantity(maxBagWeight, remaining);
      bags.push({ weightKg, condition });
      remaining -= weightKg;
    }
    return bags;
  }

  private initialLocationId(
    quantity: number,
    savedId: number | null,
    options: FilterSelectOption[],
  ): number | null {
    if (quantity <= 0) return null;
    return options.some(option => option.id === savedId)
      ? savedId
      : Number(options[0]?.id) || null;
  }

  private appendUniqueText(current: string, next: string | null | undefined): string {
    const value = next?.trim();
    if (!value) return current;
    const parts = current.split("; ").filter(Boolean);
    return parts.includes(value) ? current : [...parts, value].join("; ");
  }

  async submitForApproval(): Promise<void> {
    const current = this.detail();
    if (!current || current.statusCode !== CUSTOMER_RETURN_STATUS.DRAFT) return;
    await this.runAction(
      () => this.service.submit(current.id),
      "Đã gửi phiếu trả hàng để duyệt.",
    );
  }

  async rejectReturn(): Promise<void> {
    const current = this.detail();
    if (!current || current.statusCode !== CUSTOMER_RETURN_STATUS.PENDING_APPROVAL) return;
    const result = await Swal.fire({
      title: "Từ chối phiếu trả hàng",
      input: "textarea",
      inputLabel: "Lý do từ chối",
      inputValidator: value => !value?.trim() ? "Vui lòng nhập lý do từ chối." : null,
      showCancelButton: true,
      confirmButtonText: "Từ chối",
      cancelButtonText: "Đóng",
      confirmButtonColor: "#dc3b3b",
    });
    if (result.isConfirmed) {
      await this.runAction(
        () => this.service.reject(current.id, String(result.value).trim()),
        "Đã từ chối phiếu trả hàng.",
      );
    }
  }

  beginReceive(): void {
    const current = this.detail();
    if (!current || current.statusCode !== CUSTOMER_RETURN_STATUS.APPROVED) return;
    const groups = new Map<string, ReceiveSkuGroup>();
    current.items.forEach(item => item.allocations.forEach(allocation => {
      const productVariantId = Number(item.productVariantId || allocation.productVariantId);
      const key = productVariantId > 0 ? `variant-${productVariantId}` : `item-${item.id}`;
      const group = groups.get(key) || {
        key,
        itemId: item.id,
        productVariantId,
        productName: item.productVariantName || item.sku || "Sản phẩm",
        sku: item.sku || allocation.sku || "",
        approvedQuantity: 0,
        receivedQuantity: 0,
        allocations: [],
      };
      const approvedQuantity = Number(allocation.quantityReturned || 0);
      group.approvedQuantity += approvedQuantity;
      group.receivedQuantity += approvedQuantity;
      group.allocations.push({
        itemId: item.id,
        allocationId: allocation.id,
        approvedQuantity,
      });
      groups.set(key, group);
    }));
    this.receiveSkuGroups.set([...groups.values()]);
    this.receiveOpen.set(true);
  }

  updateReceived(groupKey: string, value: string | number): void {
    this.receiveSkuGroups.update(groups => groups.map(group => group.key === groupKey
      ? { ...group, receivedQuantity: Number(value) || 0 }
      : group));
  }

  async submitReceive(): Promise<void> {
    const current = this.detail();
    if (!current) return;
    const groups = this.receiveSkuGroups();
    for (const group of groups) {
      if (!Number.isFinite(group.receivedQuantity) ||
        group.receivedQuantity < 0 ||
        group.receivedQuantity > group.approvedQuantity) {
        await this.message(
          "Số lượng thực nhận không hợp lệ",
          `Số lượng thực nhận của ${group.productName} phải từ 0 đến ${this.fmtWeight(group.approvedQuantity)}.`,
          "warning",
        );
        return;
      }
    }
    const allocations = groups.flatMap(group => {
      let remaining = group.receivedQuantity;
      return group.allocations.map(allocation => {
        const quantityReceived = this.takeQuantity(allocation.approvedQuantity, remaining);
        remaining -= quantityReceived;
        return {
          returnAllocationId: allocation.allocationId,
          quantityReceived,
        };
      });
    });
    await this.runAction(
      () => this.service.receive({
        id: current.id,
        allocations,
      }),
      "Đã ghi nhận hàng trả thực nhận.",
    );
    this.receiveOpen.set(false);
  }

  openRefundModal(): void {
    const current = this.detail();
    if (!current || current.statusCode !== CUSTOMER_RETURN_STATUS.CONFIRMED || current.refundPendingAmount <= 0) return;
    this.refundAmount.set(null);
    this.refundNote.set("");
    this.refundAmountError.set("");
    this.showRefundModal.set(true);
  }

  closeRefundModal(): void {
    if (this.actionLoading()) return;
    this.showRefundModal.set(false);
  }

  updateRefundAmount(value: string | number | null): void {
    this.refundAmount.set(value === null || value === "" ? null : Number(value));
    this.refundAmountError.set("");
  }

  fillRefundAmount(): void {
    const pendingAmount = this.detail()?.refundPendingAmount;
    if (!pendingAmount || pendingAmount <= 0) return;
    this.refundAmount.set(pendingAmount);
    this.refundAmountError.set("");
  }

  async submitRefund(): Promise<void> {
    const current = this.detail();
    if (!current || current.statusCode !== CUSTOMER_RETURN_STATUS.CONFIRMED) return;

    const amount = Number(this.refundAmount());
    if (!Number.isFinite(amount) || amount <= 0) {
      this.refundAmountError.set("Vui lòng nhập số tiền hoàn lớn hơn 0.");
      return;
    }
    if (amount > current.refundPendingAmount) {
      this.refundAmountError.set(
        `Số tiền hoàn không được vượt quá ${this.fmtCurrency(current.refundPendingAmount)}.`,
      );
      return;
    }

    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(this.service.registerRefund(current.id, {
        amount,
        note: this.refundNote().trim() || null,
      }));
      this.ensureSucceeded(response);
      this.showRefundModal.set(false);
      await this.refresh();
      await this.message(
        "Thành công",
        response.message || "Đã ghi nhận giao dịch hoàn tiền.",
        "success",
      );
    } catch (error) {
      await this.alertError(error);
    } finally {
      this.actionLoading.set(false);
    }
  }

  async confirmReturn(): Promise<void> {
    const detail = this.detail();
    if (!detail || detail.statusCode !== CUSTOMER_RETURN_STATUS.INSPECTED)
      return;
    const preview = this.impact();
    const financialText = preview?.approvedCreditAmount
      ? ` Ghi có ${this.fmtCurrency(preview.approvedCreditAmount)}: khấu trừ công nợ ${this.fmtCurrency(preview.debtReductionAmount)}, còn phải hoàn ${this.fmtCurrency(preview.refundPendingAmount)}.`
      : " Không phát sinh ghi có cho khách.";
    const result = await Swal.fire({
      title: "Xác nhận điều chỉnh tồn?",
      text: `Hàng đạt sẽ nhập lại kho, hàng lỗi sẽ chuyển cách ly.${financialText} Thao tác này không thể hoàn tác.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xác nhận",
      cancelButtonText: "Đóng",
      confirmButtonColor: "#16a052",
    });
    if (!result.isConfirmed) return;
    await this.runAction(
      () => this.service.confirm(detail.id),
      "Gạo đạt đã nhập lại kho; gạo không đạt đã chuyển cách ly.",
    );
  }

  async cancelReturn(): Promise<void> {
    const detail = this.detail();
    if (!detail || [
      CUSTOMER_RETURN_STATUS.RECEIVED,
      CUSTOMER_RETURN_STATUS.INSPECTED,
      CUSTOMER_RETURN_STATUS.CONFIRMED,
      CUSTOMER_RETURN_STATUS.CANCELLED,
    ].includes(detail.statusCode as any))
      return;
    const result = await Swal.fire({
      title: "Hủy phiếu trả hàng",
      input: "textarea",
      inputLabel: "Lý do hủy",
      inputValidator: (value) =>
        !value?.trim() ? "Vui lòng nhập lý do hủy." : null,
      showCancelButton: true,
      confirmButtonText: "Hủy phiếu",
      cancelButtonText: "Đóng",
      confirmButtonColor: "#dc3b3b",
    });
    if (!result.isConfirmed) return;
    await this.runAction(
      () => this.service.cancel(detail.id, String(result.value).trim()),
      "Đã hủy phiếu trả hàng.",
    );
  }

  locationLabel(location: LocationDetailDto | null | undefined): string {
    if (!location) return '';
    return [
      location.zoneName,
      location.shelfRow ? `Cột ${location.shelfRow}` : '',
      location.shelfLevel ? `Lớp ${location.shelfLevel}` : '',
      location.slotCode || '',
    ]
      .filter(Boolean)
      .join(' / ');
  }

  customerLabelById(id: number | null | undefined): string {
    const customer = this.customers().find(item => item.id === id);
    return customer ? `${customer.code} · ${customer.name}` : "";
  }

  warehouseLabelById(id: number | null | undefined): string {
    const warehouse = this.warehouses().find(item => item.id === id);
    return warehouse ? `${warehouse.code} · ${warehouse.name}` : "";
  }

  restockLocationOptions(line: InspectionSkuGroup): FilterSelectOption[] {
    return this.restockLocations()
      .filter(location =>
        this.isRestockLocationCompatible(location, line.productVariantId) &&
        (location.maxCapacity == null ||
          Number(location.currentOccupancy || 0) + Number(line.quantityGood || 0) <=
            Number(location.maxCapacity) + 0.001),
      )
      .map(location => {
        const occupancy = Number(location.currentOccupancy || 0);
        const isOriginal = location.id === line.originalLocationId;
        const isEmpty = occupancy <= 0.001;
        const priority = isOriginal ? 0 : isEmpty ? 2 : 1;
        const kind = isOriginal ? "Cột gốc" : isEmpty ? "Cột trống" : "Cùng SKU";
        const sku = location.currentProductVariantSku?.trim();
        const detail = isEmpty
          ? kind
          : `${kind} · ${sku || "Cùng SKU"}`;
        return {
          option: { id: location.id, name: `${this.locationLabel(location)} — ${detail}` },
          priority,
        };
      })
      .sort((left, right) => left.priority - right.priority ||
        left.option.name.localeCompare(right.option.name, "vi"))
      .map(entry => entry.option);
  }

  quarantineLocationOptions(line: InspectionSkuGroup): FilterSelectOption[] {
    return this.quarantineReturnLocationOptions(
      line.productVariantId,
      line.quantityDamaged,
    );
  }

  rejectedLocationOptions(line: InspectionSkuGroup): FilterSelectOption[] {
    return this.quarantineReturnLocationOptions(
      line.productVariantId,
      line.quantityRejected,
    );
  }

  private quarantineReturnLocationOptions(
    productVariantId: number,
    quantity: number,
  ): FilterSelectOption[] {
    return this.quarantineLocations()
      .filter(location => {
        const occupancy = Number(location.currentOccupancy || 0);
        const isEmpty = occupancy <= 0.001;
        const isSingleType = location.isSingleTypeColumn !== false;
        const skuCompatible = !isSingleType || isEmpty ||
          location.currentProductVariantId === productVariantId;
        const hasCapacity = location.maxCapacity == null ||
          occupancy + Number(quantity || 0) <= Number(location.maxCapacity) + 0.001;
        return skuCompatible && hasCapacity;
      })
      .map(location => {
        const occupancy = Number(location.currentOccupancy || 0);
        const isEmpty = occupancy <= 0.001;
        const isSingleType = location.isSingleTypeColumn !== false;
        const kind = isEmpty
          ? "Cột trống"
          : isSingleType
            ? "Cùng SKU"
            : "Cột đa SKU";
        const sku = location.currentProductVariantSku?.trim();
        const detail = isEmpty
          ? kind
          : `${kind}${sku ? ` · ${sku}` : ""}`;
        return {
          id: location.id,
          name: `${this.locationLabel(location)} — ${detail}`,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  }

  isRestockLocationCompatible(location: LocationDetailDto, productVariantId: number): boolean {
    return Number(location.currentOccupancy || 0) <= 0.001 ||
      location.currentProductVariantId === productVariantId;
  }

  sourceCode(row: CustomerReturnRow | CustomerReturnDetail): string {
    return row.salesOrderCode || row.outboundOrderCode || "Đơn xuất gốc";
  }

  openSourceOutbound(current: CustomerReturnDetail): void {
    if (!current.outboundOrderId) return;
    this.router.navigate(["/admin/outbound-orders"], {
      queryParams: { outboundOrderId: current.outboundOrderId },
    });
  }

  openSourceSalesOrder(current: CustomerReturnDetail): void {
    if (!current.salesOrderId) return;
    this.router.navigate(["/admin/sales-orders"], {
      queryParams: { salesOrderId: current.salesOrderId },
    });
  }

  openTrace(lotId: number | null | undefined): void {
    if (!lotId || lotId <= 0) return;
    this.router.navigate(["/admin/paddy-lots"], { queryParams: { lotId } });
  }

  statusClass(code: string): string {
    return `status-${(code || "unknown").toLowerCase()}`;
  }

  canCancel(code: string): boolean {
    return [
      CUSTOMER_RETURN_STATUS.DRAFT,
      CUSTOMER_RETURN_STATUS.PENDING_APPROVAL,
      CUSTOMER_RETURN_STATUS.APPROVED,
      CUSTOMER_RETURN_STATUS.REJECTED,
    ].some(status => status === code);
  }

  statusDisplay(code: string, name: string): string {
    const labels: Record<string, string> = {
      DRAFT: "Nháp",
      PENDING_APPROVAL: "Chờ duyệt",
      APPROVED: "Đã duyệt - chờ nhận hàng",
      RECEIVED: "Đã nhận - chờ kiểm định",
      INSPECTED: "Chờ xác nhận tồn",
      CONFIRMED: "Đã xác nhận điều chỉnh tồn",
      REJECTED: "Đã từ chối",
      CANCELLED: "Đã hủy",
    };
    return labels[code] || name;
  }

  fmtNumber(value: number | null | undefined, digits = 0): string {
    return Number(value || 0).toLocaleString("vi-VN", {
      maximumFractionDigits: digits,
    });
  }

  fmtWeight(value: number | null | undefined): string {
    return `${this.fmtNumber(value, 2)} kg`;
  }

  fmtCurrency(value: number | null | undefined): string {
    return `${this.fmtNumber(value, 0)}₫`;
  }

  fmtDate(value: string | null | undefined, includeTime = false): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
  }

  async initStandardStatuses(showConfirmation = true): Promise<void> {
    if (showConfirmation) {
      const confirm = await Swal.fire({
        title: "Khởi tạo trạng thái chuẩn?",
        text: "Hệ thống sẽ tự động tạo các mã trạng thái đơn hoàn khách còn thiếu (DRAFT, PENDING_APPROVAL, APPROVED, RECEIVED, INSPECTED, CONFIRMED, REJECTED, CANCELLED).",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#16a052",
        cancelButtonColor: "#94a3b8",
        confirmButtonText: "Đồng ý khởi tạo",
        cancelButtonText: "Hủy",
      });
      if (!confirm.isConfirmed) return;
    }

    this.actionLoading.set(true);
    try {
      const dtBody = this.statusService.buildPagedBody({
        page: 1,
        pageSize: 100,
        search: "",
        sortField: "createdDate",
        sortDir: "desc",
        colMap: { code: 1, name: 2, color: 3, createdDate: 4 },
        filterName: "",
        filterDateFrom: "",
        filterDateTo: "",
      });
      const res = await lastValueFrom(this.statusService.getPagedAdvanced(dtBody));
      const list = (res as any)?.resources?.data ?? (res as any)?.data?.data ?? [];
      const existingCodes = new Set<string>();
      if (Array.isArray(list)) {
        list.forEach((x: any) => {
          if (x.code) existingCodes.add(x.code.trim().toUpperCase());
        });
      }

      let count = 0;
      for (const st of STANDARD_RETURN_STATUSES) {
        if (!existingCodes.has(st.code!.toUpperCase())) {
          try {
            await lastValueFrom(this.statusService.create(st));
            count++;
          } catch (e) {
            console.warn(`Lỗi tạo trạng thái ${st.code}:`, e);
          }
        }
      }

      await this.queryClient.invalidateQueries({ queryKey: ["customer-return-order-status"] });
      await this.refresh();
      await this.message(
        "Khởi tạo thành công",
        `Đã khởi tạo thành công ${count} mã trạng thái chuẩn cho đơn hoàn khách.`,
        "success",
      );
    } catch (err) {
      await this.message("Lỗi khởi tạo", this.errorText(err), "error");
    } finally {
      this.actionLoading.set(false);
    }
  }

  private async runAction(
    request: () => ReturnType<CustomerReturnService["confirm"]>,
    successMessage: string,
  ): Promise<void> {
    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(request());
      this.ensureSucceeded(response);
      await this.refresh();
      await this.message(
        "Thành công",
        response.message || successMessage,
        "success",
      );
    } catch (error) {
      await this.alertError(error, () => this.runAction(request, successMessage));
    } finally {
      this.actionLoading.set(false);
    }
  }

  private async refresh(): Promise<void> {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: ["customer-returns"] }),
      this.queryClient.invalidateQueries({
        queryKey: ["customer-return", "outbounds"],
      }),
    ]);
  }

  private resetList(): void {
    this.page.set(1);
    this.selectedId.set(null);
    this.inspectionOpen.set(false);
    this.receiveOpen.set(false);
  }

  private emptyForm(): ReturnFormState {
    return {
      customerFeedbackId: null,
      outboundOrderId: null,
      customerId: null,
      warehouseId: null,
      returnReason: "",
      note: "",
      lines: [],
    };
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    this.ensureSucceeded(response);
    return response.resources;
  }

  private resourceArray<T>(response: ApiResponse<any>): T[] {
    const resources = this.unwrap<any>(response);
    if (Array.isArray(resources)) return resources as T[];
    return (resources?.data ||
      resources?.items ||
      resources?.dataSource ||
      []) as T[];
  }

  private ensureSucceeded(response: ApiResponse<any>): void {
    if (!response || response.isSucceeded === false) {
      throw new Error(response?.message || "Yêu cầu không thành công.");
    }
  }

  private errorText(error: unknown): string {
    const value = error as any;
    return (
      value?.error?.message ||
      value?.message ||
      "Không thể xử lý yêu cầu. Vui lòng thử lại."
    );
  }

  private async alertError(
    error: unknown,
    retryAction?: () => Promise<void>,
  ): Promise<void> {
    const text = this.errorText(error);
    if (
      text.toLowerCase().includes("thiếu trạng thái") ||
      text.toUpperCase().includes("PENDING_APPROVAL")
    ) {
      const confirm = await Swal.fire({
        title: "Thiếu dữ liệu trạng thái",
        text: "Cơ sở dữ liệu chưa có các mã trạng thái chuẩn (PENDING_APPROVAL, APPROVED,...). Bạn có muốn tự động khởi tạo ngay bây giờ không?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "⚡ Tự động khởi tạo ngay",
        cancelButtonText: "Đóng",
        confirmButtonColor: "#16a052",
        cancelButtonColor: "#94a3b8",
      });
      if (confirm.isConfirmed) {
        await this.initStandardStatuses(false);
        if (retryAction) {
          await retryAction();
        }
        return;
      }
    }
    await this.message("Không thể thực hiện", text, "error");
  }

  private async message(
    title: string,
    text: string,
    icon: "success" | "error" | "warning",
  ): Promise<void> {
    await Swal.fire({ title, text, icon, confirmButtonColor: "#16a052" });
  }
}
