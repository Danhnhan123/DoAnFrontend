import { Component, OnDestroy, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { lastValueFrom } from "rxjs";
import { Router } from "@angular/router";
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from "@tanstack/angular-query-experimental";
import { keepPreviousData } from "@tanstack/query-core";
import Swal from "sweetalert2";

import {
  ApiResponse,
  ConfirmPaddyPurchaseReceiptPayload,
  CreatePaddyPurchaseReceiptDto,
  CreatePaddyPurchaseScheduleDto,
  DTResponse,
  FarmerDetailDto,
  PaddyPurchaseReceiptRow,
  PaddyPurchaseScheduleRow,
  PaddyQualitySnapshot,
  PaddyScheduleStatusCode,
  PaddyScheduleStatusOption,
  PaddyVariantOption,
  RiceVarietyDetailDto,
  UpdatePaddyPurchaseReceiptDto,
  UpdatePaddyPurchaseScheduleDto,
  WarehouseDetailDto,
} from "../../models";
import { PaddyPurchaseService } from "../../services/paddy-purchase.service";
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

type PurchaseTab = "schedule" | "receipt";
type WeightUnit = "ton" | "quintal" | "yen" | "kg";

type SaveScheduleVariables =
  | { mode: "create"; payload: CreatePaddyPurchaseScheduleDto }
  | { mode: "update"; payload: UpdatePaddyPurchaseScheduleDto };

type SaveReceiptVariables =
  | { mode: "create"; payload: CreatePaddyPurchaseReceiptDto }
  | { mode: "update"; payload: UpdatePaddyPurchaseReceiptDto };

interface ScheduleFormState {
  id?: number;
  organizationId?: number | null;
  farmerId: number | null;
  statusId: number;
  riceVarietyId: number | null;
  scheduleDate: string;
  location: string;
  estimatedWeight: number | null;
  estimatedWeightUnit: WeightUnit;
  expectedPrice: number | null;
  assignedUserId: number | null;
  note: string;
}

interface ReceiptFormState {
  id?: number;
  organizationId?: number | null;
  scheduleId: number | null;
  farmerId: number | null;
  riceVarietyId: number | null;
  productVariantId: number | null;
  warehouseId: number | null;
  actualWeight: number | null;
  actualWeightUnit: WeightUnit;
  bagCount: number | null;
  agreedPrice: number | null;
  paidAmount: number | null;
  moisturePercent: number | null;
  qualityGrade: string;
  qualityNote: string;
  priceAdjustReason: string;
  receiptDate: string;
  isConfirmed: boolean;
}

@Component({
  selector: "app-rice-purchase",
  standalone: true,
  imports: [
    HasPermissionDirective,
    ReadonlyIfDirective,
    CommonModule,
    FormsModule,
    FilterSelectComponent,
  ],
  templateUrl: "./rice-purchase.component.html",
  styleUrl: "./rice-purchase.component.css",
})
export class RicePurchaseComponent implements OnDestroy {
  private readonly purchaseService = inject(PaddyPurchaseService);
  readonly perm = inject(PermissionService);
  // Chỉ-xem khi đang sửa mà không có quyền UPDATE (RICE_PURCHASE).
  readonly scheduleViewOnly = computed(() => !!this.editingSchedule() && !this.perm.canUpdate('RICE_PURCHASE'));
  readonly receiptViewOnly = computed(() => !!this.editingReceipt() && !this.perm.canUpdate('RICE_PURCHASE'));
  private readonly queryClient = inject(QueryClient);
  private readonly router = inject(Router);

  readonly statuses: PaddyScheduleStatusOption[] = [
    { id: 1, code: "NEW", name: "Mới tạo", color: "#6B7280" },
    { id: 2, code: "CONFIRMED", name: "Đã xác nhận", color: "#3B82F6" },
    { id: 3, code: "COLLECTING", name: "Đang đi thu", color: "#F59E0B" },
    { id: 4, code: "WEIGHED", name: "Đã cân hàng", color: "#8B5CF6" },
    {
      id: 7,
      code: "PARTIALLY_STOCKED",
      name: "Nhập một phần",
      color: "#06B6D4",
    },
    { id: 5, code: "STOCKED", name: "Đã nhập kho", color: "#10B981" },
    { id: 6, code: "CANCELLED", name: "Hủy", color: "#EF4444" },
  ];
  readonly weightUnits: ReadonlyArray<{
    value: WeightUnit;
    label: string;
    multiplierToKg: number;
  }> = [
    { value: "ton", label: "Tấn", multiplierToKg: 1000 },
    { value: "quintal", label: "Tạ", multiplierToKg: 100 },
    { value: "yen", label: "Yến", multiplierToKg: 10 },
    { value: "kg", label: "kg", multiplierToKg: 1 },
  ];

  activeTab = signal<PurchaseTab>("schedule");
  schedulePage = signal(1);
  receiptPage = signal(1);
  readonly pageSize = 10;

  scheduleSearchInput = signal("");
  receiptSearchInput = signal("");
  scheduleSearch = signal("");
  receiptSearch = signal("");

  confirmingReceiptId = signal<number | null>(null);
  updatingScheduleId = signal<number | null>(null);
  showScheduleModal = signal(false);
  showReceiptModal = signal(false);
  editingSchedule = signal<PaddyPurchaseScheduleRow | null>(null);
  editingReceipt = signal<PaddyPurchaseReceiptRow | null>(null);
  scheduleForm = signal<ScheduleFormState>(this.defaultScheduleForm());
  receiptForm = signal<ReceiptFormState>(this.defaultReceiptForm());

  private scheduleSearchTimer?: ReturnType<typeof setTimeout>;
  private receiptSearchTimer?: ReturnType<typeof setTimeout>;

  private readonly farmersQuery = injectQuery(() => ({
    queryKey: ["rice-purchase", "farmers"],
    queryFn: async () =>
      this.unwrap(
        await lastValueFrom(this.purchaseService.getFarmers()),
        "Không tải được danh sách nông dân.",
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly riceVarietiesQuery = injectQuery(() => ({
    queryKey: ["rice-purchase", "rice-varieties"],
    queryFn: async () =>
      this.unwrap(
        await lastValueFrom(this.purchaseService.getRiceVarieties()),
        "Không tải được danh sách giống lúa.",
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly productVariantsQuery = injectQuery(() => ({
    queryKey: ["rice-purchase", "product-variants"],
    queryFn: async () =>
      this.unwrap(
        await lastValueFrom(this.purchaseService.getProductVariants()),
        "Không tải được danh sách sản phẩm.",
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly warehousesQuery = injectQuery(() => ({
    queryKey: ["rice-purchase", "warehouses"],
    queryFn: async () =>
      this.unwrap(
        await lastValueFrom(this.purchaseService.getWarehouses()),
        "Không tải được danh sách kho.",
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly scheduleOptionsQuery = injectQuery(() => ({
    queryKey: ["rice-purchase", "schedules", "all"],
    queryFn: async () =>
      this.unwrap(
        await lastValueFrom(this.purchaseService.getSchedules()),
        "Không tải được danh sách lịch thu mua.",
      ),
    staleTime: 30_000,
  }));

  readonly receiptScheduleOptions = computed(() => {
  // Khi xem phiếu cũ, vẫn giữ lịch đang liên kết để không bị trống select.
  const editingScheduleId = this.editingReceipt()?.scheduleId ?? null;

  return this.scheduleOptions().filter((schedule) => {
    const statusCode = this.statusOf(schedule.statusId).code;

    const canCreateReceipt =
      statusCode !== "CANCELLED" &&
      statusCode !== "STOCKED" &&
      statusCode !== "PARTIALLY_STOCKED";

    return canCreateReceipt || schedule.id === editingScheduleId;
  });
});

  private readonly receiptStatsQuery = injectQuery(() => ({
    queryKey: ["rice-purchase", "receipts", "summary"],

    queryFn: async () => {
      const pageSize = 500;

      const loadPage = async (
        page: number,
      ): Promise<DTResponse<PaddyPurchaseReceiptRow>> => {
        const body = this.purchaseService.buildReceiptPagedBody({
          page,
          pageSize,
          search: "",
          sortField: "createdDate",
          sortDir: "desc",
        });

        return this.unwrap(
          await lastValueFrom(this.purchaseService.getReceiptsPaged(body)),
          "Không tải được dữ liệu tổng hợp phiếu mua.",
        ) as DTResponse<PaddyPurchaseReceiptRow>;
      };

      const firstPage = await loadPage(1);

      const totalRecords = Number(
        firstPage.recordsFiltered ??
          firstPage.recordsTotal ??
          firstPage.data?.length ??
          0,
      );

      const totalPages = Math.ceil(totalRecords / pageSize);

      if (totalPages <= 1) {
        return firstPage.data || [];
      }

      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          loadPage(index + 2),
        ),
      );

      return [
        ...(firstPage.data || []),
        ...remainingPages.flatMap((page) => page.data || []),
      ];
    },

    staleTime: 30_000,
  }));

  private readonly schedulesPagedQuery = injectQuery(() => ({
    queryKey: [
      "rice-purchase",
      "schedules",
      "paged",
      this.schedulePage(),
      this.scheduleSearch(),
    ],
    queryFn: async () => {
      const body = this.purchaseService.buildSchedulePagedBody({
        page: this.schedulePage(),
        pageSize: this.pageSize,
        search: this.scheduleSearch(),
        sortField: "createdDate",
        sortDir: "desc",
      });
      return this.unwrap(
        await lastValueFrom(this.purchaseService.getSchedulesPaged(body)),
        "Không tải được lịch thu mua.",
      ) as DTResponse<PaddyPurchaseScheduleRow>;
    },
    placeholderData: keepPreviousData,
  }));

  private readonly receiptsPagedQuery = injectQuery(() => ({
    queryKey: [
      "rice-purchase",
      "receipts",
      "paged",
      this.receiptPage(),
      this.receiptSearch(),
    ],
    queryFn: async () => {
      const body = this.purchaseService.buildReceiptPagedBody({
        page: this.receiptPage(),
        pageSize: this.pageSize,
        search: this.receiptSearch(),
        sortField: "createdDate",
        sortDir: "desc",
      });
      return this.unwrap(
        await lastValueFrom(this.purchaseService.getReceiptsPaged(body)),
        "Không tải được phiếu mua lúa.",
      ) as DTResponse<PaddyPurchaseReceiptRow>;
    },
    placeholderData: keepPreviousData,
  }));

  private readonly saveScheduleMutation = injectMutation(() => ({
    mutationFn: async (variables: SaveScheduleVariables) => {
      const request =
        variables.mode === "create"
          ? this.purchaseService.createSchedule(variables.payload)
          : this.purchaseService.updateSchedule(variables.payload);
      return this.ensureSucceeded(
        await lastValueFrom(request),
        "Không lưu được lịch thu mua.",
      );
    },
    onSuccess: async () => this.invalidateScheduleQueries(),
  }));

  private readonly scheduleStatusMutation = injectMutation(() => ({
    mutationFn: async (variables: {
      id: number;
      statusCode: PaddyScheduleStatusCode;
    }) =>
      this.ensureSucceeded(
        await lastValueFrom(
          this.purchaseService.updateScheduleStatus(
            variables.id,
            variables.statusCode,
          ),
        ),
        "Không cập nhật được trạng thái lịch.",
      ),
    onSuccess: async () => this.invalidateScheduleQueries(),
  }));

  private readonly saveReceiptMutation = injectMutation(() => ({
    mutationFn: async (variables: SaveReceiptVariables) => {
      const request =
        variables.mode === "create"
          ? this.purchaseService.createReceipt(variables.payload)
          : this.purchaseService.updateReceipt(variables.payload);
      return this.ensureSucceeded(
        await lastValueFrom(request),
        "Không lưu được phiếu mua lúa.",
      );
    },
    onSuccess: async () => this.invalidateReceiptQueries(),
  }));

  private readonly confirmReceiptMutation = injectMutation(() => ({
    mutationFn: async (vars: {
      id: number;
      payload: ConfirmPaddyPurchaseReceiptPayload;
    }) =>
      this.ensureSucceeded(
        await lastValueFrom(
          this.purchaseService.confirmReceipt(vars.id, vars.payload),
        ),
        "Không chốt được phiếu mua lúa.",
      ),
    onSuccess: async () => {
      await Promise.all([
        this.invalidateReceiptQueries(),
        this.invalidateScheduleQueries(),
      ]);
    },
  }));

  readonly farmers = computed(() =>
    [...(this.farmersQuery.data() || [])]
      .filter((x) => x.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "vi")),
  );
  readonly riceVarieties = computed(() =>
    [...(this.riceVarietiesQuery.data() || [])]
      .filter((x) => x.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "vi")),
  );
  readonly warehouses = computed(() =>
    [...(this.warehousesQuery.data() || [])]
      .filter((x) => x.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "vi")),
  );

  // ---- Options cho dropdown dùng chung (app-filter-select) ----
  readonly weightUnitSelectOptions: FilterSelectOption[] = this.weightUnits.map(
    (u) => ({ id: u.value, name: u.label }),
  );
  readonly qualityGradeSelectOptions: FilterSelectOption[] = [
    { id: "Xuất sắc", name: "Xuất sắc" },
    { id: "Tốt", name: "Tốt" },
    { id: "Đạt", name: "Đạt" },
    { id: "Cần xử lý", name: "Cần xử lý" },
    { id: "Cách ly", name: "Cách ly" },
  ];
  readonly farmerScheduleSelectOptions = computed<FilterSelectOption[]>(() =>
    this.farmers().map((f) => ({ id: f.id, name: `${f.name} · ${f.code}` })),
  );
  readonly farmerReceiptSelectOptions = computed<FilterSelectOption[]>(() =>
    this.farmers().map((f) => ({
      id: f.id,
      name: `${f.name} · ${f.phone || f.code}`,
    })),
  );
  readonly varietySelectOptions = computed<FilterSelectOption[]>(() =>
    this.riceVarieties().map((v) => ({
      id: v.id,
      name: `${v.name} · ${v.code}`,
    })),
  );
  // Biến thể sản phẩm đang hoạt động (dùng để lọc theo giống lúa trên phiếu).
  readonly productVariants = computed<PaddyVariantOption[]>(() =>
    [...(this.productVariantsQuery.data() || [])].filter(
      (v) => v.isActive !== false,
    ),
  );
  // Options sản phẩm cho phiếu mua: chỉ những biến thể gắn đúng giống lúa đang chọn.
  readonly receiptVariantSelectOptions = computed<FilterSelectOption[]>(() => {
    const varietyId = this.receiptForm().riceVarietyId;
    if (!varietyId) return [];
    return this.productVariants()
      .filter((v) => v.riceVarietyId === varietyId)
      .map((v) => ({
        id: v.id,
        name: v.sku ? `${v.name} · ${v.sku}` : v.name,
      }));
  });
  readonly warehouseSelectOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({
      id: w.id,
      name: `${w.name} · ${w.code}`,
    })),
  );
  readonly scheduleSelectOptions = computed<FilterSelectOption[]>(() =>
    this.receiptScheduleOptions().map((s) => ({
      id: s.id,
      name: `${s.scheduleCode} · ${s.farmerName} · ${this.formatDate(s.scheduleDate)}`,
    })),
  );
  readonly scheduleOptions = computed(() =>
    [...(this.scheduleOptionsQuery.data() || [])].sort(
      (a, b) =>
        new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
    ),
  );
  readonly scheduleRows = computed(
    () => this.schedulesPagedQuery.data()?.data || [],
  );
  readonly receiptRows = computed(
    () => this.receiptsPagedQuery.data()?.data || [],
  );
  readonly receiptStatsRows = computed(
    () => this.receiptStatsQuery.data() || [],
  );
  readonly scheduleTotal = computed(() =>
    Number(
      this.schedulesPagedQuery.data()?.recordsFiltered ??
        this.schedulesPagedQuery.data()?.recordsTotal ??
        0,
    ),
  );
  readonly receiptTotal = computed(() =>
    Number(
      this.receiptsPagedQuery.data()?.recordsFiltered ??
        this.receiptsPagedQuery.data()?.recordsTotal ??
        0,
    ),
  );
  readonly loadingReference = computed(
    () =>
      this.farmersQuery.isPending() ||
      this.riceVarietiesQuery.isPending() ||
      this.productVariantsQuery.isPending() ||
      this.warehousesQuery.isPending() ||
      this.scheduleOptionsQuery.isPending(),
  );
  readonly loadingSchedules = computed(() =>
    this.schedulesPagedQuery.isPending(),
  );
  readonly loadingReceipts = computed(() =>
    this.receiptsPagedQuery.isPending(),
  );
  readonly savingSchedule = computed(() =>
    this.saveScheduleMutation.isPending(),
  );
  readonly savingReceipt = computed(() => this.saveReceiptMutation.isPending());

  readonly scheduleFarmer = computed(() =>
    this.farmers().find((x) => x.id === this.scheduleForm().farmerId),
  );
  readonly selectedReceiptSchedule = computed(() =>
    this.scheduleOptions().find((x) => x.id === this.receiptForm().scheduleId),
  );
  readonly scheduleStateReady = computed(() =>
    this.scheduleOptionsQuery.isSuccess(),
  );
  readonly scheduleFormLocked = computed(() =>
    this.isScheduleLocked(this.editingSchedule()) || this.scheduleViewOnly(),
  );
  readonly receiptFormCancelled = computed(() =>
    this.isScheduleCancelled(this.receiptForm().scheduleId),
  );
  readonly receiptFormLocked = computed(
    () =>
      this.receiptForm().isConfirmed ||
      this.receiptFormCancelled() ||
      (!!this.receiptForm().scheduleId && !this.scheduleStateReady()) ||
      this.receiptViewOnly(),
  );

  readonly receiptTotalAmount = computed(() =>
    this.roundMoney(
      this.toKilograms(
        this.receiptForm().actualWeight,
        this.receiptForm().actualWeightUnit,
      ) *
        Number(this.receiptForm().agreedPrice || 0),
    ),
  );
  readonly receiptDebtAmount = computed(() =>
    Math.max(
      0,
      this.roundMoney(
        this.receiptTotalAmount() - Number(this.receiptForm().paidAmount || 0),
      ),
    ),
  );

  readonly stockedReceiptStatsRows = computed(() => {
    if (!this.scheduleStateReady()) return [];

    return this.receiptStatsRows().filter((row) => this.isReceiptStocked(row));
  });
  readonly totalPurchaseThisWeekKg = computed(() => {
    const { start, end } = this.currentWeekRange();
    return this.stockedReceiptStatsRows()
      .filter((x) => {
        const date = new Date(x.receiptDate);
        return !Number.isNaN(date.getTime()) && date >= start && date <= end;
      })
      .reduce((sum, x) => sum + Number(x.actualWeightKg || 0), 0);
  });
  readonly averagePurchasePrice = computed(() => {
    const rows = this.stockedReceiptStatsRows();
    const totalWeight = rows.reduce(
      (sum, x) => sum + Number(x.actualWeightKg || 0),
      0,
    );
    const totalAmount = rows.reduce(
      (sum, x) => sum + Number(x.totalAmount || 0),
      0,
    );
    return totalWeight > 0 ? totalAmount / totalWeight : 0;
  });
  readonly totalPurchaseCost = computed(() =>
    this.stockedReceiptStatsRows().reduce(
      (sum, x) => sum + Number(x.totalAmount || 0),
      0,
    ),
  );
  readonly totalFarmerDebt = computed(() =>
    this.stockedReceiptStatsRows().reduce(
      (sum, x) => sum + Number(x.debtAmount || 0),
      0,
    ),
  );

  ngOnDestroy(): void {
    if (this.scheduleSearchTimer) clearTimeout(this.scheduleSearchTimer);
    if (this.receiptSearchTimer) clearTimeout(this.receiptSearchTimer);
  }

  switchTab(tab: PurchaseTab): void {
    this.activeTab.set(tab);
  }

  // ───────────────────────── TÌM KIẾM / PHÂN TRANG ────────────────

  onScheduleSearch(value: string): void {
    this.scheduleSearchInput.set(value);
    if (this.scheduleSearchTimer) clearTimeout(this.scheduleSearchTimer);
    this.scheduleSearchTimer = setTimeout(() => {
      this.schedulePage.set(1);
      this.scheduleSearch.set(value.trim());
    }, 350);
  }

  onReceiptSearch(value: string): void {
    this.receiptSearchInput.set(value);
    if (this.receiptSearchTimer) clearTimeout(this.receiptSearchTimer);
    this.receiptSearchTimer = setTimeout(() => {
      this.receiptPage.set(1);
      this.receiptSearch.set(value.trim());
    }, 350);
  }

  setSchedulePage(page: number): void {
    if (page >= 1 && page <= this.scheduleTotalPages())
      this.schedulePage.set(page);
  }

  setReceiptPage(page: number): void {
    if (page >= 1 && page <= this.receiptTotalPages())
      this.receiptPage.set(page);
  }

  scheduleTotalPages(): number {
    return Math.max(1, Math.ceil(this.scheduleTotal() / this.pageSize));
  }
  receiptTotalPages(): number {
    return Math.max(1, Math.ceil(this.receiptTotal() / this.pageSize));
  }

  // ───────────────────────── FORM LỊCH THU MUA ────────────────────

  openCreateSchedule(): void {
    this.editingSchedule.set(null);
    this.scheduleForm.set(this.defaultScheduleForm());
    this.showScheduleModal.set(true);
  }

  openEditSchedule(row: PaddyPurchaseScheduleRow): void {
    const estimatedWeight = this.fromKilograms(row.estimatedQtyKg, "ton");
    this.editingSchedule.set(row);
    this.scheduleForm.set({
      id: row.id,
      organizationId: row.organizationId ?? null,
      farmerId: row.farmerId,
      statusId: row.statusId,
      riceVarietyId: row.riceVarietyId ?? null,
      scheduleDate: this.toDateInput(row.scheduleDate),
      location: row.location || "",
      estimatedWeight: estimatedWeight.value,
      estimatedWeightUnit: estimatedWeight.unit,
      expectedPrice: row.expectedPrice ?? null,
      assignedUserId: row.assignedUserId ?? null,
      note: row.note || "",
    });
    this.showScheduleModal.set(true);
  }

  closeScheduleModal(): void {
    if (this.savingSchedule()) return;
    this.showScheduleModal.set(false);
    this.editingSchedule.set(null);
    this.scheduleForm.set(this.defaultScheduleForm());
  }

  setScheduleField<K extends keyof ScheduleFormState>(
    field: K,
    value: ScheduleFormState[K],
  ): void {
    this.scheduleForm.update((current) => ({ ...current, [field]: value }));
  }

  async saveSchedule(): Promise<void> {
    if (this.scheduleFormLocked()) {
      this.showError(
        "Lich thu mua da huy hoac da nhap kho nen khong the chinh sua.",
      );
      return;
    }

    const form = this.scheduleForm();
    const validationMessage = this.validateSchedule(form);
    if (validationMessage) {
      this.showError(validationMessage);
      return;
    }

    const wasEditing = !!this.editingSchedule();
    const accepted = await this.askConfirm(
      wasEditing ? "Cập nhật lịch thu mua?" : "Tạo lịch thu mua?",
      wasEditing
        ? "Các thông tin lịch hẹn sẽ được cập nhật theo dữ liệu vừa nhập."
        : "Hệ thống sẽ tạo mã lịch tự động và lưu trạng thái Mới tạo.",
    );
    if (!accepted) return;

    const base: CreatePaddyPurchaseScheduleDto = {
      organizationId: form.organizationId ?? null,
      farmerId: Number(form.farmerId),
      statusId: form.statusId || 1,
      riceVarietyId: form.riceVarietyId || null,
      scheduleDate: this.toApiDate(form.scheduleDate),
      location: form.location.trim(),
      estimatedQtyKg:
        form.estimatedWeight != null
          ? this.toKilograms(
              form.estimatedWeight,
              form.estimatedWeightUnit,
            )
          : null,
      expectedPrice: form.expectedPrice ?? null,
      assignedUserId: form.assignedUserId ?? null,
      note: form.note.trim() || null,
    };

    try {
      const response = await this.saveScheduleMutation.mutateAsync(
        wasEditing
          ? {
              mode: "update",
              payload: { ...base, id: this.editingSchedule()!.id },
            }
          : { mode: "create", payload: base },
      );
      this.showScheduleModal.set(false);
      this.editingSchedule.set(null);
      this.scheduleForm.set(this.defaultScheduleForm());
      await this.showSuccess(
        wasEditing
          ? "Cập nhật lịch thu mua thành công."
          : response.message || "Tạo lịch thu mua thành công.",
      );
    } catch (err) {
      this.showError(this.apiError(err, "Không lưu được lịch thu mua."));
    }
  }

  async advanceSchedule(row: PaddyPurchaseScheduleRow): Promise<void> {
    if (this.isScheduleLocked(row)) return;

    const next = this.nextStatus(row.statusId);
    if (!next) return;

    const accepted = await this.askConfirm(
      `Chuyển sang “${next.name}”?`,
      `Lịch ${row.scheduleCode} sẽ được cập nhật trạng thái.`,
    );
    if (!accepted) return;

    this.updatingScheduleId.set(row.id);
    try {
      const response = await this.scheduleStatusMutation.mutateAsync({
        id: row.id,
        statusCode: next.code,
      });
      if (!response.isSucceeded) {
        throw new Error(response.message || "Không cập nhật được trạng thái.");
      }
      await this.showSuccess(response.message || "Đã cập nhật trạng thái.");
    } catch (err) {
      this.showError(this.apiError(err, "Không cập nhật được trạng thái."));
    } finally {
      this.updatingScheduleId.set(null);
    }
  }

  async cancelSchedule(row: PaddyPurchaseScheduleRow): Promise<void> {
    if (this.isScheduleLocked(row)) return;
    const accepted = await this.askConfirm(
      "Hủy lịch thu mua?",
      `Lịch ${row.scheduleCode} sẽ chuyển sang trạng thái Hủy.`,
    );
    if (!accepted) return;

    this.updatingScheduleId.set(row.id);
    try {
      const response = await this.scheduleStatusMutation.mutateAsync({
        id: row.id,
        statusCode: "CANCELLED",
      });
      if (!response.isSucceeded) throw new Error(response.message);
      this.showScheduleModal.set(false);
      this.editingSchedule.set(null);
      this.scheduleForm.set(this.defaultScheduleForm());
      await this.showSuccess("Đã hủy lịch thu mua.");
    } catch (err) {
      this.showError(this.apiError(err, "Không hủy được lịch thu mua."));
    } finally {
      this.updatingScheduleId.set(null);
    }
  }

  // ───────────────────────── FORM PHIẾU MUA LÚA ──────────────────

  openCreateReceipt(schedule?: PaddyPurchaseScheduleRow): void {
    if (schedule && this.isScheduleLocked(schedule)) {
      this.showError(
        "Lịch thu mua đã hủy hoặc đã nhập kho nên không thể tạo phiếu mua liên kết.",
      );
      return;
    }
    this.editingReceipt.set(null);
    const form = this.defaultReceiptForm();
    if (schedule) {
      form.scheduleId = schedule.id;
      form.farmerId = schedule.farmerId;
      form.riceVarietyId = schedule.riceVarietyId ?? null;
    }
    this.receiptForm.set(form);
    this.activeTab.set("receipt");
    this.showReceiptModal.set(true);
  }

  openEditReceipt(row: PaddyPurchaseReceiptRow): void {
    const quality = this.parseQuality(row.qualityJson);
    this.editingReceipt.set(row);
    this.receiptForm.set({
      id: row.id,
      organizationId: row.organizationId ?? null,
      scheduleId: row.scheduleId ?? null,
      farmerId: row.farmerId,
      riceVarietyId: row.riceVarietyId ?? null,
      productVariantId: row.productVariantId ?? null,
      warehouseId: row.warehouseId,
      actualWeight: Number(row.actualWeightKg),
      actualWeightUnit: "kg",
      bagCount: row.bagCount ?? null,
      agreedPrice: Number(row.agreedPrice),
      paidAmount: Number(row.paidAmount),
      moisturePercent: quality.moisturePercent ?? null,
      qualityGrade: quality.grade || "",
      qualityNote: quality.note || "",
      priceAdjustReason: row.priceAdjustReason || "",
      receiptDate: this.toDateInput(row.receiptDate),
      isConfirmed: !!row.isConfirmed,
    });
    this.showReceiptModal.set(true);
  }

  closeReceiptModal(): void {
    if (this.savingReceipt()) return;
    this.showReceiptModal.set(false);
    this.editingReceipt.set(null);
    this.receiptForm.set(this.defaultReceiptForm());
  }

  setReceiptField<K extends keyof ReceiptFormState>(
    field: K,
    value: ReceiptFormState[K],
  ): void {
    this.receiptForm.update((current) => ({ ...current, [field]: value }));
  }

  // Đổi giống lúa → reset sản phẩm đã chọn vì danh sách sản phẩm lọc theo giống.
  onReceiptVarietyChange(rawValue: number | string | null): void {
    const id = rawValue ? Number(rawValue) : null;
    this.receiptForm.update((current) => ({
      ...current,
      riceVarietyId: id,
      productVariantId: null,
    }));
  }

 onReceiptScheduleChange(
  rawValue: number | string | null,): void {
  const id = rawValue ? Number(rawValue) : null;
  const schedule = this.scheduleOptions().find(
    (item) => item.id === id,
  );

  if (schedule) {
    const statusCode = this.statusOf(schedule.statusId).code;

    if (
      statusCode === "CANCELLED" ||
      statusCode === "STOCKED" ||
      statusCode === "PARTIALLY_STOCKED"
    ) {
      this.showError(
        "Lịch thu mua này đã hủy hoặc đã bắt đầu nhập kho nên không thể tạo phiếu mới.",
      );
      return;
    }
  }

    this.receiptForm.update((current) => {
      const nextVarietyId = schedule?.riceVarietyId ?? current.riceVarietyId;
      return {
        ...current,
        scheduleId: id,
        farmerId: schedule?.farmerId ?? current.farmerId,
        riceVarietyId: nextVarietyId,
        // Giống lúa đổi theo lịch → bỏ chọn sản phẩm cũ nếu khác giống.
        productVariantId:
          nextVarietyId === current.riceVarietyId
            ? current.productVariantId
            : null,
      };
    });
  }

  async saveReceipt(): Promise<void> {
    const form = this.receiptForm();
    if (form.scheduleId && !this.scheduleStateReady()) {
      this.showError("Đang tải trạng thái lịch liên kết, vui lòng thử lại.");
      return;
    }
    if (this.receiptFormCancelled()) {
      this.showError("Phiếu liên kết với lịch đã hủy nên không thể sửa.");
      return;
    }
    if (form.isConfirmed) {
      this.showError("Phiếu đã chốt nên không thể chỉnh sửa.");
      return;
    }

    const validationMessage = this.validateReceipt(form);
    if (validationMessage) {
      this.showError(validationMessage);
      return;
    }

    const accepted = await this.askConfirm(
      this.editingReceipt() ? "Cập nhật phiếu mua lúa?" : "Tạo phiếu mua lúa?",
      "Phiếu được lưu trước. Tồn kho chỉ tăng sau khi bạn chọn và xác nhận vị trí lưu.",
    );
    if (!accepted) return;

    const base: CreatePaddyPurchaseReceiptDto = {
      organizationId: form.organizationId ?? null,
      scheduleId: form.scheduleId || null,
      farmerId: Number(form.farmerId),
      riceVarietyId: form.riceVarietyId || null,
      productVariantId: form.productVariantId || null,
      warehouseId: Number(form.warehouseId),
      actualWeightKg: this.toKilograms(
        form.actualWeight,
        form.actualWeightUnit,
      ),
      bagCount: form.bagCount ?? null,
      agreedPrice: this.roundMoney(Number(form.agreedPrice)),
      totalAmount: this.receiptTotalAmount(),
      paidAmount: this.roundMoney(Number(form.paidAmount || 0)),
      debtAmount: this.receiptDebtAmount(),
      qualityJson: this.buildQualityJson(form),
      priceAdjustReason: form.priceAdjustReason.trim() || null,
      receiptDate: this.toApiDate(form.receiptDate),
    };

    try {
      const response = await this.saveReceiptMutation.mutateAsync(
        this.editingReceipt()
          ? {
              mode: "update",
              payload: { ...base, id: this.editingReceipt()!.id },
            }
          : { mode: "create", payload: base },
      );
      this.showReceiptModal.set(false);
      this.editingReceipt.set(null);
      this.receiptForm.set(this.defaultReceiptForm());
      await this.showSuccess(response.message || "Đã lưu phiếu mua lúa.");
    } catch (err) {
      this.showError(this.apiError(err, "Không lưu được phiếu mua lúa."));
    }
  }

  async chooseLocationForReceipt(row: PaddyPurchaseReceiptRow): Promise<void> {
    if (row.scheduleId && !this.scheduleStateReady()) {
      this.showError("Đang tải trạng thái lịch liên kết, vui lòng thử lại.");
      return;
    }
    if (this.isReceiptCancelled(row)) {
      this.showError(
        "Phiếu liên kết với lịch đã hủy nên không thể chọn vị trí.",
      );
      return;
    }

    if (row.isConfirmed) {
      await this.router.navigate(["/admin/quality-inspections"]);
      return;
    }

    const hasDebt = Number(row.debtAmount || 0) > 0;
    const confirm = await this.askConfirmReceipt(row, hasDebt);
    if (!confirm.confirmed) return;

    const payload: ConfirmPaddyPurchaseReceiptPayload = hasDebt
      ? { dueDate: confirm.dueDate }
      : {};

    this.confirmingReceiptId.set(row.id);
    try {
      const response = await this.confirmReceiptMutation.mutateAsync({
        id: row.id,
        payload,
      });
      if (!response.isSucceeded) {
        throw new Error(response.message || "Không thể chốt phiếu mua lúa.");
      }
      await this.router.navigate(["/admin/quality-inspections"]);
    } catch (err) {
      this.showError(
        this.apiError(err, "Không thể tạo phiếu kiểm định chất lượng."),
      );
    } finally {
      this.confirmingReceiptId.set(null);
    }
  }

  // ───────────────────────── HIỂN THỊ / TIỆN ÍCH ─────────────────

  farmerPhone(farmerId: number): string {
    return this.farmers().find((x) => x.id === farmerId)?.phone || "—";
  }

  riceVarietyName(id?: number | null): string {
    if (!id) return "Chưa chọn";
    return this.riceVarieties().find((x) => x.id === id)?.name || "Chưa rõ";
  }

  statusOf(statusId: number): PaddyScheduleStatusOption {
    return (
      this.statuses.find((x) => x.id === statusId) || {
        id: statusId,
        code: "NEW" as PaddyScheduleStatusCode,
        name: "Không xác định",
        color: "#6B7280",
      }
    );
  }

  nextStatus(statusId: number): PaddyScheduleStatusOption | null {
    const nextMap: Record<number, PaddyScheduleStatusCode | null> = {
      1: "CONFIRMED",
      2: "COLLECTING",
      3: "WEIGHED",
      4: null,
      5: null,
      6: null,
      7: null,
    };
    const code = nextMap[statusId];
    return code ? this.statuses.find((x) => x.code === code) || null : null;
  }

  statusClass(statusId: number): string {
    return `status-${this.statusOf(statusId).code.toLowerCase()}`;
  }

  isScheduleLocked(
    row?: Pick<PaddyPurchaseScheduleRow, "statusId"> | null,
  ): boolean {
    if (!row) return false;
    const code = this.statusOf(row.statusId).code;
    return (
      code === "PARTIALLY_STOCKED" || code === "STOCKED" || code === "CANCELLED"
    );
  }

  isScheduleStocked(
    row?: Pick<PaddyPurchaseScheduleRow, "statusId"> | null,
  ): boolean {
    return !!row && this.statusOf(row.statusId).code === "STOCKED";
  }

  isScheduleCancelledRow(
    row?: Pick<PaddyPurchaseScheduleRow, "statusId"> | null,
  ): boolean {
    return !!row && this.statusOf(row.statusId).code === "CANCELLED";
  }

  isScheduleCancelled(scheduleId?: number | null): boolean {
    if (!scheduleId) return false;
    const schedule = this.scheduleOptions().find((x) => x.id === scheduleId);
    return !!schedule && this.statusOf(schedule.statusId).code === "CANCELLED";
  }

  isReceiptCancelled(
    row: Pick<PaddyPurchaseReceiptRow, "scheduleId">,
  ): boolean {
    return this.isScheduleCancelled(row.scheduleId);
  }

  isReceiptStocked(
    row: Pick<PaddyPurchaseReceiptRow, "isConfirmed" | "scheduleId">,
  ): boolean {
    // Chưa chốt phiếu thì chưa nhập kho.
    if (row.isConfirmed !== true) {
      return false;
    }

    // Phiếu không liên kết lịch không có trạng thái store-in trong dữ liệu danh sách,
    // vì vậy không suy đoán "đã nhập kho" chỉ từ isConfirmed.
    if (!row.scheduleId) {
      return false;
    }

    const schedule = this.scheduleOptions().find(
      (item) => item.id === row.scheduleId,
    );

    // Phiếu có lịch chỉ được tổng hợp khi lịch ở trạng thái STOCKED.
    return !!schedule && this.statusOf(schedule.statusId).code === "STOCKED";
  }

  receiptStatusLabel(row: PaddyPurchaseReceiptRow): string {
    if (this.isReceiptCancelled(row)) return "Đã hủy";
    return row.isConfirmed ? "Đã chốt" : "Chưa chốt";
  }

  receiptStatusClass(row: PaddyPurchaseReceiptRow): string {
    if (this.isReceiptCancelled(row)) return "receipt-cancelled";
    return row.isConfirmed ? "receipt-confirmed" : "receipt-draft";
  }

  qualityOf(row: PaddyPurchaseReceiptRow): PaddyQualitySnapshot {
    return this.parseQuality(row.qualityJson);
  }

  moistureClass(value?: number | null): string {
    if (value == null) return "moisture-neutral";
    if (value > 15) return "moisture-high";
    if (value >= 14.6) return "moisture-warning";
    return "moisture-good";
  }

  formatDate(value?: string | null): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  formatWeightKg(value?: number | null): string {
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 2,
    }).format(Number(value || 0))} kg`;
  }

  formatTonFromKg(value?: number | null): string {
    const ton = Number(value || 0) / 1000;
    return `${new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: ton % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(ton)} tấn`;
  }

  formatPrice(value?: number | null): string {
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(Number(value || 0))} đ/kg`;
  }

  formatCompactMoney(value?: number | null): string {
    const amount = Number(value || 0);
    if (Math.abs(amount) >= 1_000_000_000) {
      return `${this.compactNumber(amount / 1_000_000_000)} tỷ`;
    }
    if (Math.abs(amount) >= 1_000_000) {
      return `${this.compactNumber(amount / 1_000_000)} tr`;
    }
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(amount)} đ`;
  }

  formatMoney(value?: number | null): string {
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(Number(value || 0))} đ`;
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  private defaultScheduleForm(): ScheduleFormState {
    return {
      farmerId: null,
      statusId: 1,
      riceVarietyId: null,
      scheduleDate: this.todayInput(),
      location: "",
      estimatedWeight: null,
      estimatedWeightUnit: "ton",
      expectedPrice: null,
      assignedUserId: null,
      note: "",
    };
  }

  private defaultReceiptForm(): ReceiptFormState {
    return {
      scheduleId: null,
      farmerId: null,
      riceVarietyId: null,
      productVariantId: null,
      warehouseId: null,
      actualWeight: null,
      actualWeightUnit: "kg",
      bagCount: null,
      agreedPrice: null,
      paidAmount: 0,
      moisturePercent: null,
      qualityGrade: "",
      qualityNote: "",
      priceAdjustReason: "",
      receiptDate: this.todayInput(),
      isConfirmed: false,
    };
  }

  private validateSchedule(form: ScheduleFormState): string | null {
    if (!form.farmerId) return "Vui lòng chọn nông dân.";
    if (!form.location.trim()) return "Vui lòng nhập khu vực ruộng/điểm hẹn.";
    if (!form.scheduleDate) return "Vui lòng chọn ngày hẹn.";
    if (
      form.estimatedWeight != null &&
      (!Number.isFinite(Number(form.estimatedWeight)) ||
        this.toKilograms(
          form.estimatedWeight,
          form.estimatedWeightUnit,
        ) <= 0)
    ) {
      return "Sản lượng dự kiến phải lớn hơn 0.";
    }
    return null;
  }

  private validateReceipt(form: ReceiptFormState): string | null {
    if (!form.farmerId) return "Vui lòng chọn nông dân.";
    if (!form.warehouseId) return "Vui lòng chọn kho nhập.";
    if (!form.riceVarietyId) return "Vui lòng chọn giống lúa.";
    if (!form.productVariantId) return "Vui lòng chọn sản phẩm theo giống lúa.";
    if (!form.receiptDate) return "Vui lòng chọn ngày mua thực tế.";
    if (
      !form.actualWeight ||
      !Number.isFinite(Number(form.actualWeight)) ||
      this.toKilograms(form.actualWeight, form.actualWeightUnit) <= 0
    ) {
      return "Thực cân phải lớn hơn 0.";
    }
    if (!form.agreedPrice || Number(form.agreedPrice) <= 0) {
      return "Giá mua phải lớn hơn 0 đồng/kg.";
    }
    if (Number(form.paidAmount || 0) < 0) {
      return "Số tiền đã trả không được âm.";
    }
    if (Number(form.paidAmount || 0) > this.receiptTotalAmount()) {
      return "Số tiền đã trả không được lớn hơn thành tiền.";
    }
    if (
      form.moisturePercent != null &&
      (Number(form.moisturePercent) < 0 || Number(form.moisturePercent) > 100)
    ) {
      return "Độ ẩm phải nằm trong khoảng 0–100%.";
    }
    return null;
  }

  private buildQualityJson(form: ReceiptFormState): string | null {
    const quality: PaddyQualitySnapshot = {
      moisturePercent:
        form.moisturePercent != null ? Number(form.moisturePercent) : null,
      grade: form.qualityGrade.trim() || null,
      note: form.qualityNote.trim() || null,
    };

    return quality.moisturePercent == null && !quality.grade && !quality.note
      ? null
      : JSON.stringify(quality);
  }

  private parseQuality(value?: string | null): PaddyQualitySnapshot {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return {
          moisturePercent:
            parsed.moisturePercent ?? parsed.moisture ?? parsed.doAm ?? null,
          grade: parsed.grade ?? parsed.quality ?? parsed.chatLuong ?? null,
          note: parsed.note ?? null,
        };
      }
    } catch {
      // Dữ liệu cũ có thể là text thuần; giữ lại để vẫn hiển thị được.
    }
    return { grade: value };
  }

  private currentWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    const dayFromMonday = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - dayFromMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private todayInput(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }

  private toDateInput(value?: string | null): string {
    if (!value) return this.todayInput();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 10);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000)
      .toISOString()
      .slice(0, 10);
  }

  private toApiDate(value: string): string {
    return `${value}T00:00:00`;
  }

  private roundWeight(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toKilograms(value: number | null, unit: WeightUnit): number {
    const multiplier =
      this.weightUnits.find((item) => item.value === unit)?.multiplierToKg ?? 1;

    return this.roundWeight(Number(value || 0) * multiplier);
  }

  private fromKilograms(
    value: number | null | undefined,
    fallbackUnit: WeightUnit,
  ): { value: number | null; unit: WeightUnit } {
    if (value == null || !Number.isFinite(Number(value))) {
      return { value: null, unit: fallbackUnit };
    }

    const kilograms = Number(value);
    const absoluteKilograms = Math.abs(kilograms);
    const unit: WeightUnit =
      absoluteKilograms >= 1000
        ? "ton"
        : absoluteKilograms >= 100
          ? "quintal"
          : absoluteKilograms >= 10
            ? "yen"
            : "kg";
    const multiplier =
      this.weightUnits.find((item) => item.value === unit)?.multiplierToKg ?? 1;

    return {
      value: kilograms / multiplier,
      unit,
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private compactNumber(value: number): string {
    return new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private async invalidateScheduleQueries(): Promise<void> {
    await this.queryClient.invalidateQueries({
      queryKey: ["rice-purchase", "schedules"],
    });
  }

  private async invalidateReceiptQueries(): Promise<void> {
    await this.queryClient.invalidateQueries({
      queryKey: ["rice-purchase", "receipts"],
    });
  }

  private unwrap<T>(response: ApiResponse<T>, fallback: string): T {
    if (!response.isSucceeded) throw new Error(response.message || fallback);
    return response.resources;
  }

  private ensureSucceeded<T>(
    response: ApiResponse<T>,
    fallback: string,
  ): ApiResponse<T> {
    if (!response.isSucceeded) throw new Error(response.message || fallback);
    return response;
  }

  private async askConfirm(title: string, text: string): Promise<boolean> {
    const result = await Swal.fire({
      title,
      text,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Đồng ý",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#159947",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    return result.isConfirmed;
  }

  /**
   * Popup chốt phiếu mua lúa.
   * - Không phát sinh nợ: hỏi Đồng ý/Hủy như bình thường.
   * - Phát sinh nợ (debtAmount > 0): bắt buộc chọn "Hạn thanh toán",
   *   không cho chọn ngày trước hôm nay.
   */
  private async askConfirmReceipt(
    row: PaddyPurchaseReceiptRow,
    hasDebt: boolean,
  ): Promise<{ confirmed: boolean; dueDate?: string }> {
    const baseText =
      "Hệ thống sẽ sinh lô và phiếu kiểm định chất lượng (chờ kiểm định). " +
      "Sau khi kiểm định Đạt/Cách ly ở màn Chất lượng & cách ly mới sinh phiếu nhập kho.";

    if (!hasDebt) {
      const confirmed = await this.askConfirm("Chốt phiếu mua lúa?", baseText);
      return { confirmed };
    }

    const today = this.todayIso();
    const debt = this.formatMoney(Number(row.debtAmount || 0));
    const result = await Swal.fire({
      title: "Chốt phiếu mua lúa?",
      icon: "question",
      html:
        `<p style="margin:0 0 8px;text-align:left">${baseText}</p>` +
        `<p style="margin:0 0 10px;text-align:left">Phiếu phát sinh <b>công nợ phải trả ${debt}</b>. ` +
        `Vui lòng chọn hạn thanh toán cho nhà cung cấp.</p>` +
        `<label style="display:block;text-align:left;font-weight:600;margin-bottom:4px" for="ppr-due-date">Hạn thanh toán</label>` +
        `<input type="date" id="ppr-due-date" class="swal2-input" style="margin:0" min="${today}" value="${today}">`,
      showCancelButton: true,
      confirmButtonText: "Chốt & tạo phiếu kiểm định",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#159947",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusConfirm: false,
      preConfirm: () => {
        const input = document.getElementById(
          "ppr-due-date",
        ) as HTMLInputElement | null;
        const value = input?.value ?? "";
        if (!value) {
          Swal.showValidationMessage("Vui lòng chọn hạn thanh toán.");
          return false;
        }
        if (value < today) {
          Swal.showValidationMessage("Hạn thanh toán không được trước hôm nay.");
          return false;
        }
        return value;
      },
    });

    return result.isConfirmed
      ? { confirmed: true, dueDate: result.value as string }
      : { confirmed: false };
  }

  /** Ngày hôm nay dạng yyyy-MM-dd (theo giờ địa phương) cho input date. */
  private todayIso(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  private showSuccess(message: string): Promise<any> {
    return Swal.fire({
      title: "Thành công",
      text: message,
      icon: "success",
      confirmButtonColor: "#159947",
    });
  }

  private showError(message: string): void {
    Swal.fire({
      title: "Không thể thực hiện",
      text: message,
      icon: "error",
      confirmButtonColor: "#159947",
    });
  }

  private apiError(error: any, fallback: string): string {
    const api = error?.error;
    if (api?.message) return api.message;
    if (error?.message) return error.message;
    return fallback;
  }
}
