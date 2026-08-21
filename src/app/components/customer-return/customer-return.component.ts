import { CommonModule } from "@angular/common";
import { Component, OnDestroy, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
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
import { WarehouseService } from "../../services/warehouse.service";

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

interface ReturnFormState {
  customerFeedbackId: number | null;
  outboundOrderId: number | null;
  customerId: number | null;
  warehouseId: number | null;
  returnReason: string;
  note: string;
  lines: ReturnFormLine[];
}

interface InspectionLine {
  itemId: number;
  allocationId: number;
  productName: string;
  standardBagWeightKg: number;
  lotCode: string;
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
}

@Component({
  selector: "app-customer-return",
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective],
  templateUrl: "./customer-return.component.html",
  styleUrl: "./customer-return.component.css",
})
export class CustomerReturnComponent implements OnDestroy {
  private readonly service = inject(CustomerReturnService);
  private readonly customerService = inject(CustomerService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly locationService = inject(LocationService);
  private readonly statusService = inject(CustomerReturnOrderStatusService);
  private readonly queryClient = injectQueryClient();
  private readonly route = inject(ActivatedRoute);

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
  readonly saving = signal(false);
  readonly actionLoading = signal(false);
  readonly loadingSource = signal(false);
  readonly inspectionOpen = signal(false);
  readonly receiveOpen = signal(false);
  readonly receiveQuantities = signal<Record<number, number>>({});
  readonly inspectionLines = signal<InspectionLine[]>([]);
  readonly form = signal<ReturnFormState>(this.emptyForm());

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const outboundId = Number(params.get("outboundId"));
    const feedbackId = Number(params.get("feedbackId"));
    if (outboundId > 0 && feedbackId > 0) {
      this.form.update(form => ({ ...form, customerFeedbackId: feedbackId, returnReason: params.get("reason") || "" }));
      this.showCreateModal.set(true);
      void this.setSourceOutbound(String(outboundId));
    }
  }

  readonly tabs: { key: ReturnTab; label: string }[] = [
    { key: "ALL", label: "Tất cả" },
    { key: "PENDING_APPROVAL", label: "Chờ duyệt" },
    { key: "RECEIVED", label: "Chờ kiểm định" },
    { key: "CONFIRMED", label: "Đã hoàn tất" },
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
      (total, line) =>
        total + Number(line.creditQuantity) * Number(line.unitCreditPrice),
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
  readonly formRestockLocations = computed(() =>
    this.locations().filter(
      (location) => location.warehouseId === this.form().warehouseId &&
        !location.isOutboundStaging && !location.isLockedForOutbound,
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

  setCustomerFilter(value: string): void {
    this.customerFilter.set(value ? Number(value) : null);
    this.resetList();
  }

  setWarehouseFilter(value: string): void {
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
    this.form.set(this.emptyForm());
    this.showCreateModal.set(true);
  }

  closeCreate(): void {
    if (this.saving()) return;
    this.showCreateModal.set(false);
  }

  async setSourceOutbound(value: string): Promise<void> {
    const id = value ? Number(value) : null;
    if (!id) {
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
    const quantity = Number(value) || 0;
    this.form.update((form) => ({
      ...form,
      lines: form.lines.map((line) =>
        line.key === key ? { ...line, quantityReturned: quantity } : line,
      ),
    }));
  }

  async submitCreate(): Promise<void> {
    const form = this.form();
    const selectedLines = form.lines.filter(
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

    const restockLocs = this.restockLocations();
    const quarantineLocs = this.quarantineLocations();
    const defaultQuarantineId = quarantineLocs[0]?.id ?? null;

    this.inspectionLines.set(
      detail.items.flatMap((item) =>
        item.allocations.map((allocation) => {
          // Ưu tiên: vị trí gốc của lô → vị trí nhập đầu tiên còn chỗ → vị trí đầu tiên
          const originalLoc = restockLocs.find(
            (loc) => loc.id === allocation.originalLocationId,
          );
          const firstAvailable =
            restockLocs.find(
              (loc) =>
              (loc.maxCapacity == null ||
                (loc.currentOccupancy ?? 0) < loc.maxCapacity),
            ) ?? restockLocs[0];
          const autoRestockId = (originalLoc ?? firstAvailable)?.id ?? null;

          return {
            itemId: item.id,
            allocationId: allocation.id,
            productName: item.productVariantName || item.sku || 'Sản phẩm',
            standardBagWeightKg: Number(item.standardBagWeightKg || 0),
            lotCode: allocation.paddyLotCode,
            quantityReturned: allocation.quantityReceived,
            quantityGood: editingInspection ? allocation.quantityGood : allocation.quantityReceived,
            quantityDamaged: editingInspection ? allocation.quantityDamaged : 0,
            quantityRejected: editingInspection ? allocation.quantityRejected : 0,
            creditQuantity: allocation.creditQuantity || 0,
            unitCreditPrice: allocation.unitCreditPrice || 0,
            restockLocationId: editingInspection ? (allocation.restockLocationId ?? autoRestockId) : autoRestockId,
            quarantineLocationId: editingInspection ? (allocation.quarantineLocationId ?? defaultQuarantineId) : defaultQuarantineId,
            rejectedLocationId: editingInspection ? (allocation.rejectedLocationId ?? defaultQuarantineId) : defaultQuarantineId,
            damageReason: editingInspection ? (item.damageReason ?? '') : '',
            rejectionReason: editingInspection ? (allocation.rejectionReason ?? '') : '',
            note: editingInspection ? (allocation.note ?? '') : '',
            bags: editingInspection && allocation.bags?.length
              ? allocation.bags.map(bag => ({ ...bag }))
              : allocation.quantityReceived > 0
                ? [
                  {
                    weightKg: allocation.quantityReceived,
                    condition: 'GOOD' as const,
                  },
                ]
                : [],
          };
        }),
      ),
    );
    this.inspectionOpen.set(true);
  }


  addInspectionBag(allocationId: number, condition: "GOOD" | "DAMAGED"): void {
    this.inspectionLines.update(lines => lines.map(line => line.allocationId === allocationId
      ? { ...line, bags: [...line.bags, { weightKg: 0, condition }] }
      : line));
  }

  updateInspectionBag(allocationId: number, index: number, weightKg: number): void {
    this.inspectionLines.update(lines => lines.map(line => line.allocationId === allocationId
      ? { ...line, bags: line.bags.map((bag, i) => i === index ? { ...bag, weightKg: Number(weightKg) } : bag) }
      : line));
  }

  updateInspectionBagCondition(allocationId: number, index: number, condition: "GOOD" | "DAMAGED"): void {
    this.inspectionLines.update(lines => lines.map(line => line.allocationId === allocationId
      ? { ...line, bags: line.bags.map((bag, i) => i === index ? { ...bag, condition } : bag) }
      : line));
  }

  removeInspectionBag(allocationId: number, index: number): void {
    this.inspectionLines.update(lines => lines.map(line => line.allocationId === allocationId
      ? { ...line, bags: line.bags.filter((_, i) => i !== index) }
      : line));
  }

  updateInspection(
    allocationId: number,
    field: keyof InspectionLine,
    value: string | number,
  ): void {
    this.inspectionLines.update((lines) =>
      lines.map((line) => {
        if (line.allocationId !== allocationId) return line;
        const numericFields: (keyof InspectionLine)[] = [
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
        return { ...line, [field]: nextValue } as InspectionLine;
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
        line.quantityGood < 0 ||
        line.quantityDamaged < 0 ||
        line.quantityRejected < 0 ||
        line.creditQuantity < 0 ||
        Math.abs(classified - line.quantityReturned) > 0.001
      ) {
        await this.message(
          "Số lượng chưa khớp",
          `Tổng phân loại của lô ${line.lotCode} phải bằng ${this.fmtWeight(line.quantityReturned)}.`,
          "warning",
        );
        return;
      }
      if (line.creditQuantity > line.quantityGood + line.quantityDamaged) {
        await this.message(
          "Số lượng hoàn tiền không hợp lệ",
          `Lô ${line.lotCode} chỉ được hoàn tối đa ${this.fmtWeight(line.quantityGood + line.quantityDamaged)} theo lượng nhận lại.`,
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
        await this.message("Cân bao chưa khớp", `Tổng cân bao đạt/hỏng của lô ${line.lotCode} phải khớp số kg phân loại.`, "warning");
        return;
      }
      if (line.quantityGood > 0 && !line.restockLocationId) {
        await this.message(
          "Thiếu vị trí",
          `Chọn vị trí nhập lại cho lô ${line.lotCode}.`,
          "warning",
        );
        return;
      }
      if (line.quantityDamaged > 0 && !line.quarantineLocationId) {
        await this.message(
          "Thiếu vị trí",
          `Chọn vị trí cách ly cho lô ${line.lotCode}.`,
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
          `Nhập lý do xử lý lô ${line.lotCode}.`,
          "warning",
        );
        return;
      }
      if (line.quantityRejected > 0 && (!line.rejectedLocationId || !line.rejectionReason.trim())) {
        await this.message(
          "Thiếu thông tin hàng trả lại",
          `Chọn vị trí và nhập lý do trả lại khách cho lô ${line.lotCode}.`,
          "warning",
        );
        return;
      }
    }

    const items = new Map<number, InspectCustomerReturnItemPayload>();
    lines.forEach((line) => {
      const current = items.get(line.itemId) || {
        customerReturnOrderItemId: line.itemId,
        qualityStatus: "GOOD",
        damageReason: null,
        allocations: [],
      };
      if (
        line.quantityRejected > 0 &&
        line.quantityGood === 0 &&
        line.quantityDamaged === 0
      ) {
        current.qualityStatus = "EXPIRED";
      } else if (line.quantityDamaged > 0 || line.quantityRejected > 0) {
        current.qualityStatus = "DAMAGED";
      }
      if (line.damageReason.trim()) {
        current.damageReason = [current.damageReason, line.damageReason.trim()]
          .filter(Boolean)
          .join("; ");
      }
      current.allocations.push({
        returnAllocationId: line.allocationId,
        quantityGood: line.quantityGood,
        quantityDamaged: line.quantityDamaged,
        quantityRejected: line.quantityRejected,
        creditQuantity: line.creditQuantity,
        restockLocationId: line.restockLocationId,
        quarantineLocationId: line.quarantineLocationId,
        rejectedLocationId: line.rejectedLocationId,
        rejectionReason: line.rejectionReason.trim() || null,
        note: line.note.trim() || null,
        bags: line.bags.map(x => ({ weightKg: Number(x.weightKg), condition: x.condition })),
      });
      items.set(line.itemId, current);
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
    this.receiveQuantities.set(Object.fromEntries(
      current.items.flatMap(item => item.allocations.map(allocation => [allocation.id, allocation.quantityReturned])),
    ));
    this.receiveOpen.set(true);
  }

  updateReceived(allocationId: number, value: string | number): void {
    this.receiveQuantities.update(values => ({ ...values, [allocationId]: Number(value) || 0 }));
  }

  async submitReceive(): Promise<void> {
    const current = this.detail();
    if (!current) return;
    const allocations = current.items.flatMap(item => item.allocations);
    for (const allocation of allocations) {
      const received = this.receiveQuantities()[allocation.id] ?? 0;
      if (received < 0 || received > allocation.quantityReturned) {
        await this.message(
          "Số lượng thực nhận không hợp lệ",
          `${allocation.paddyLotCode}: thực nhận phải từ 0 đến ${this.fmtWeight(allocation.quantityReturned)}.`,
          "warning",
        );
        return;
      }
    }
    await this.runAction(
      () => this.service.receive({
        id: current.id,
        allocations: allocations.map(allocation => ({
          returnAllocationId: allocation.id,
          quantityReceived: this.receiveQuantities()[allocation.id] ?? 0,
        })),
      }),
      "Đã ghi nhận hàng trả thực nhận.",
    );
    this.receiveOpen.set(false);
  }

  async registerRefund(): Promise<void> {
    const current = this.detail();
    if (!current || current.statusCode !== CUSTOMER_RETURN_STATUS.CONFIRMED || current.refundPendingAmount <= 0) return;
    const result = await Swal.fire({
      title: "Ghi nhận hoàn tiền",
      html: `<input id="refund-amount" class="swal2-input" type="number" min="1" max="${current.refundPendingAmount}" value="${current.refundPendingAmount}" placeholder="Số tiền"><input id="refund-reference" class="swal2-input" maxlength="100" placeholder="Mã giao dịch / tham chiếu"><textarea id="refund-note" class="swal2-textarea" maxlength="300" placeholder="Ghi chú (không bắt buộc)"></textarea>`,
      showCancelButton: true,
      confirmButtonText: "Ghi nhận",
      cancelButtonText: "Đóng",
      preConfirm: () => {
        const amount = Number((document.getElementById("refund-amount") as HTMLInputElement)?.value);
        const paymentReference = (document.getElementById("refund-reference") as HTMLInputElement)?.value.trim();
        const note = (document.getElementById("refund-note") as HTMLTextAreaElement)?.value.trim();
        if (!(amount > 0) || amount > current.refundPendingAmount || !paymentReference) {
          Swal.showValidationMessage("Nhập số tiền hợp lệ và mã tham chiếu.");
          return false;
        }
        return { amount, paymentReference, note: note || null };
      },
    });
    if (result.isConfirmed && result.value) {
      await this.runAction(
        () => this.service.registerRefund(current.id, result.value),
        "Đã ghi nhận giao dịch hoàn tiền.",
      );
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

  locationLabelById(id: number | null | undefined): string {
    if (!id) return '';
    const loc = this.locations().find((l) => l.id === id);
    return this.locationLabel(loc);
  }

  sourceCode(row: CustomerReturnRow | CustomerReturnDetail): string {
    return row.salesOrderCode || row.outboundOrderCode || "Đơn xuất gốc";
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
      CONFIRMED: "Đã hoàn tất",
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
