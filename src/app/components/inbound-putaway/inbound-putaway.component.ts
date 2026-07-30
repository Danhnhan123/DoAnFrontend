import { CommonModule } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  QueryClient,
  injectMutation,
  injectQuery,
} from "@tanstack/angular-query-experimental";
import { lastValueFrom } from "rxjs";
import Swal from "sweetalert2";

import {
  InboundOrderDetailDto,
  InboundOrderItemDto,
  PutawaySuggestionDto,
} from "../../models/inbound-order";
import { LocationDetailDto } from "../../models/location";
import { AuthService } from "../../services/auth.service";
import { InboundOrderService } from "../../services/inbound-order.service";
import { LocationService } from "../../services/location.service";
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

interface InboundPutawayLine {
  order: InboundOrderDetailDto;
  item: InboundOrderItemDto;
}

interface InboundPutawayData {
  lines: InboundPutawayLine[];
  locations: LocationDetailDto[];
  warning: string;
}

interface PreparePutawayVariables {
  line: InboundPutawayLine;
  weight: number;
}

interface ConfirmPutawayVariables {
  line: InboundPutawayLine;
  locationId: number;
  weightKg: number;
  isOverride: boolean;
  overrideReason: string | null;
}

type ScreenStatus =
  | "loading"
  | "waiting"
  | "suggested"
  | "split"
  | "override"
  | "capacity"
  | "conflict"
  | "completed"
  | "error";

@Component({
  selector: "app-inbound-putaway",
  standalone: true,
  imports: [HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: "./inbound-putaway.component.html",
  styleUrl: "./inbound-putaway.component.css",
})
export class InboundPutawayComponent {
  private readonly authService = inject(AuthService);
  private readonly inboundService = inject(InboundOrderService);
  private readonly locationService = inject(LocationService);
  private readonly queryClient = inject(QueryClient);

  private readonly inboundQueryKey = ["inbound-putaway", "orders"] as const;
  private readonly suggestionQueryKey = [
    "inbound-putaway",
    "suggestions",
  ] as const;

  readonly selectedLine = signal<InboundPutawayLine | null>(null);
  readonly suggestions = signal<PutawaySuggestionDto[]>([]);
  readonly activeStatus = signal<ScreenStatus>("waiting");
  readonly message = signal("");
  readonly selectedLocationId = signal<number | null>(null);
  readonly placementWeightKg = signal<number>(0);
  readonly manualOverride = signal(false);
  readonly manualLocationId = signal<number | null>(null);
  readonly overrideReason = signal("");

  readonly inboundQuery = injectQuery(() => ({
    queryKey: this.inboundQueryKey,
    queryFn: () => this.fetchInboundPutawayData(),
    staleTime: 30_000,
    retry: 1,
  }));

  readonly lines = computed(() => this.inboundQuery.data()?.lines ?? []);
  readonly locations = computed(
    () => this.inboundQuery.data()?.locations ?? [],
  );
  readonly loading = computed(
    () => this.inboundQuery.isPending() || this.inboundQuery.isFetching(),
  );
  readonly loadWarning = computed(() => {
    if (this.inboundQuery.isError()) {
      return this.apiError(
        this.inboundQuery.error(),
        "Không tải được phiếu nhập kho.",
      );
    }
    return this.inboundQuery.data()?.warning ?? "";
  });

  readonly advanceOrderMutation = injectMutation(() => ({
    mutationKey: ["inbound-putaway", "advance-order"],
    mutationFn: async (line: InboundPutawayLine): Promise<string> => {
      const status = this.normalizedStatus(line.order.inboundOrderStatusName);

      if (status === "draft") {
        await lastValueFrom(this.inboundService.submit(line.order.id));
        return "Đã gửi phiếu nhập kho để duyệt.";
      }
      if (status === "submitted") {
        await lastValueFrom(this.inboundService.approve(line.order.id));
        return "Đã phê duyệt phiếu nhập kho.";
      }
      if (status === "approved") {
        await lastValueFrom(
          this.inboundService.startReceipt(line.order.id, line.item.id),
        );
        return "Đã bắt đầu quá trình nhận hàng.";
      }

      throw new Error("Trạng thái phiếu không cho phép chuyển bước.");
    },
    onSettled: () => this.invalidateInboundData(),
  }));

  readonly preparePutawayMutation = injectMutation(() => ({
    mutationKey: ["inbound-putaway", "prepare"],
    mutationFn: async ({
      line,
      weight,
    }: PreparePutawayVariables): Promise<void> => {
      const status = this.normalizedStatus(line.order.inboundOrderStatusName);

      if (status === "approved") {
        await lastValueFrom(
          this.inboundService.startReceipt(line.order.id, line.item.id),
        );
      }

      const quantityAlreadyCaptured = [
        "QuantityEntered",
        "WeightVerified",
        "PutawaySelected",
      ].includes(line.item.receiptStatus);

      if (!quantityAlreadyCaptured) {
        await lastValueFrom(
          this.inboundService.recordQuantity(
            line.order.id,
            line.item.id,
            weight,
          ),
        );
      }
    },
    onSettled: () => this.invalidateInboundData(),
  }));

  readonly confirmPutawayMutation = injectMutation(() => ({
    mutationKey: ["inbound-putaway", "confirm"],
    mutationFn: async ({
      line,
      locationId,
      weightKg,
      isOverride,
      overrideReason,
    }: ConfirmPutawayVariables): Promise<void> => {
      await lastValueFrom(
        this.inboundService.selectPutaway(line.order.id, line.item.id, {
          locationId,
          isOverride,
          overrideReason,
          weightKg,
        }),
      );
      await lastValueFrom(
        this.inboundService.confirmReceipt(
          line.order.id,
          line.item.id,
          this.operationKey(),
        ),
      );
    },
    onSettled: () => this.invalidateInboundData(),
  }));

  readonly actionPending = computed(
    () =>
      this.advanceOrderMutation.isPending() ||
      this.preparePutawayMutation.isPending() ||
      this.confirmPutawayMutation.isPending(),
  );

  readonly isAdmin = computed(() =>
    this.hasRole(["ADMIN"], ["quản trị viên", "system admin", "admin"], [1001]),
  );
  readonly isOwner = computed(() =>
    this.hasRole(
      ["OWNER"],
      ["chủ kho", "chủ cơ sở", "chủ hộ kinh doanh", "warehouse owner", "owner"],
    ),
  );
  readonly isWarehouseStaff = computed(() =>
    this.hasRole(
      ["WAREHOUSE"],
      ["nhân viên kho", "warehouse staff", "warehouse"],
      [1008],
    ),
  );
  readonly canManageInbound = computed(() => this.isAdmin() || this.isOwner());
  readonly canOperateInbound = computed(
    () => this.isAdmin() || this.isOwner() || this.isWarehouseStaff(),
  );

  readonly pendingLines = computed(() =>
    this.lines().filter((line) => {
      const orderStatus = this.normalizedStatus(
        line.order.inboundOrderStatusName,
      );
      return (
        this.remaining(line.item) > 0 &&
        !["cancelled", "rejected", "confirmed"].includes(orderStatus) &&
        line.item.receiptStatus !== "Cancelled"
      );
    }),
  );

  private readonly syncSelectedLineEffect = effect(() => {
    const pending = this.pendingLines();
    const current = this.selectedLine();

    if (current) {
      const refreshedCurrent = pending.find(
        (line) => line.item.id === current.item.id,
      );
      if (refreshedCurrent) {
        if (refreshedCurrent !== current) {
          this.selectedLine.set(refreshedCurrent);
        }
        return;
      }
    }

    const nextLine = pending[0] ?? null;
    if (nextLine !== current) {
      void this.selectLine(nextLine);
    }
  });

  readonly warehouseLocations = computed(() => {
    const warehouseId = this.selectedLine()?.order.warehouseId;
    if (!warehouseId) return [];
    const needsQuarantine =
      this.selectedLine()?.item.paddyQualityStatus?.toUpperCase() === "FAILED";

    return this.locations()
      .filter((location) => {
        const max = Number(location.maxCapacity ?? 0);
        const occupied = Number(location.currentOccupancy ?? 0);
        return (
          location.warehouseId === warehouseId &&
          location.isActive &&
          max > occupied &&
          Boolean(location.isQuarantine) === needsQuarantine
        );
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  });

  readonly manualOverrideLocations = computed(() => {
    const selectedSuggestionId = this.selectedLocationId();
    return this.warehouseLocations().filter(
      (location) => location.id !== selectedSuggestionId,
    );
  });

  readonly manualLocationSelectOptions = computed<FilterSelectOption[]>(() =>
    this.manualOverrideLocations().map((location) => ({
      id: location.id,
      name:
        `${this.manualLocationLabel(location)} · còn ` +
        `${this.formatKg((location.maxCapacity || 0) - (location.currentOccupancy || 0))}` +
        ` · ưu tiên ${location.priority}`,
    }))
  );

  readonly pendingWeightKg = computed(() =>
    this.pendingLines().reduce(
      (total, line) => total + this.remaining(line.item),
      0,
    ),
  );

  readonly quarantineCount = computed(
    () =>
      this.pendingLines().filter(
        (line) => line.item.paddyQualityStatus?.toUpperCase() === "FAILED",
      ).length,
  );

  readonly availableLocationCount = computed(
    () => this.suggestions().length || this.warehouseLocations().length,
  );

  readonly proposedOccupancy = computed(() => {
    const suggestion = this.selectedSuggestion();
    if (!suggestion) return 0;
    const max = suggestion.currentOccupancy + suggestion.availableCapacity;
    if (max <= 0) return 0;
    return Math.round((suggestion.currentOccupancy / max) * 100);
  });

  readonly selectedSuggestion = computed(
    () =>
      this.suggestions().find(
        (item) => item.locationId === this.selectedLocationId(),
      ) ?? null,
  );

  readonly selectedStatus = computed(() =>
    this.normalizedStatus(this.selectedLine()?.order.inboundOrderStatusName),
  );

  /**
   * Nút "Làm mới": dữ liệu nạp qua TanStack Query (fetchInboundPutawayData),
   * nên chỉ cần invalidate để query tự refetch — không thao tác trực tiếp signal.
   */
  async loadOrders(): Promise<void> {
    await this.invalidateInboundData();
  }

  async selectLine(line: InboundPutawayLine | null): Promise<void> {
    this.selectedLine.set(line);
    this.suggestions.set([]);
    this.selectedLocationId.set(null);
    this.manualOverride.set(false);
    this.manualLocationId.set(null);
    this.overrideReason.set("");
    this.message.set("");

    if (!line) return;
    const remaining = this.remaining(line.item);
    this.placementWeightKg.set(
      Math.min(line.item.quantityEntered || remaining, remaining),
    );

    if (
      this.canOperateInbound() &&
      ["QuantityEntered", "WeightVerified", "PutawaySelected"].includes(
        line.item.receiptStatus,
      )
    ) {
      await this.fetchSuggestions();
    }
  }

  async advanceOrder(): Promise<void> {
    const line = this.selectedLine();
    if (!line || this.actionPending()) return;
    if (!this.canAdvanceOrder()) {
      await this.showPermissionDenied(this.transitionPermissionMessage());
      return;
    }

    try {
      const successMessage = await this.advanceOrderMutation.mutateAsync(line);
      await this.success(successMessage);
    } catch (error) {
      this.showError(error, "Không thể chuyển bước phiếu nhập.");
    }
  }

  async prepareSuggestions(preferredLocationId?: number): Promise<void> {
    const line = this.selectedLine();
    if (!line || this.actionPending()) return;
    if (!this.canOperateInbound()) {
      await this.showPermissionDenied(
        "Chỉ Quản trị viên, Chủ kho hoặc Nhân viên kho được xử lý nhận và xếp hàng.",
      );
      return;
    }

    const weight = Number(this.placementWeightKg());
    const remaining = this.remaining(line.item);
    if (!Number.isFinite(weight) || weight <= 0 || weight > remaining) {
      await Swal.fire({
        icon: "warning",
        title: "Khối lượng không hợp lệ",
        text: `Khối lượng phải lớn hơn 0 và không vượt quá ${this.formatKg(
          remaining,
        )}.`,
        confirmButtonColor: "#16a34a",
      });
      return;
    }

    try {
      await this.preparePutawayMutation.mutateAsync({ line, weight });
      await this.fetchSuggestions(preferredLocationId);
    } catch (error) {
      this.showError(error, "Không thể tải gợi ý xếp vị trí.");
    }
  }

  private async fetchSuggestions(preferredLocationId?: number): Promise<void> {
    const line = this.selectedLine();
    if (!line) return;

    try {
      const response = await this.queryClient.fetchQuery({
        queryKey: [...this.suggestionQueryKey, line.order.id, line.item.id],
        queryFn: () =>
          lastValueFrom(
            this.inboundService.getPutawaySuggestions(
              line.order.id,
              line.item.id,
            ),
          ),
        staleTime: 0,
      });
      const suggestions = this.unwrap<PutawaySuggestionDto[]>(response) ?? [];
      this.suggestions.set(suggestions);
      const selected =
        suggestions.find(
          (suggestion) => suggestion.locationId === preferredLocationId,
        ) ??
        suggestions[0] ??
        null;
      this.selectedLocationId.set(selected?.locationId ?? null);
      if (selected) {
        this.placementWeightKg.set(selected.recommendedWeightKg);
        this.activeStatus.set(selected.canFitWhole ? "suggested" : "split");
        this.message.set(
          preferredLocationId && selected.locationId !== preferredLocationId
            ? "Khu/cột vừa chọn không đạt đủ điều kiện. Hệ thống đã chọn vị trí phù hợp nhất."
            : response.message ||
                (selected.canFitWhole
                  ? "Đã tìm thấy vị trí phù hợp."
                  : "Lô cần được tách qua nhiều vị trí."),
        );
      } else {
        this.activeStatus.set("capacity");
        this.message.set(
          response.message || "Không còn vị trí phù hợp đủ sức chứa.",
        );
      }
    } catch (error) {
      this.suggestions.set([]);
      this.selectedLocationId.set(null);
      this.activeStatus.set("error");
      this.message.set(this.apiError(error, "Không tải được vị trí gợi ý."));
    }
  }

  chooseSuggestion(suggestion: PutawaySuggestionDto): void {
    if (!this.canOperateInbound()) return;
    this.selectedLocationId.set(suggestion.locationId);
    this.placementWeightKg.set(suggestion.recommendedWeightKg);
    this.manualOverride.set(false);
    this.activeStatus.set(suggestion.canFitWhole ? "suggested" : "split");
  }

  async chooseWarehouseLocation(location: LocationDetailDto): Promise<void> {
    const line = this.selectedLine();
    if (!line || this.actionPending()) return;
    if (!this.canOperateInbound()) {
      await this.showPermissionDenied(
        "Bạn chỉ được xem thông tin. Vai trò hiện tại không được chọn khu/cột.",
      );
      return;
    }

    const status = this.selectedStatus();
    if (status === "draft" || status === "submitted") {
      this.message.set(
        status === "draft"
          ? "Cần gửi duyệt phiếu trước khi chọn khu/cột."
          : "Cần phê duyệt phiếu trước khi chọn khu/cột.",
      );
      await Swal.fire({
        icon: "info",
        title: "Phiếu chưa sẵn sàng nhận hàng",
        text: this.message(),
        confirmButtonColor: "#16a34a",
      });
      return;
    }

    const freeCapacity =
      Number(location.maxCapacity ?? 0) -
      Number(location.currentOccupancy ?? 0);
    this.selectedLocationId.set(location.id);
    this.placementWeightKg.set(
      Math.min(this.remaining(line.item), freeCapacity),
    );

    if (this.canPrepare()) {
      await this.prepareSuggestions(location.id);
    }
  }

  async toggleManualOverride(): Promise<void> {
    if (!this.canManageInbound()) {
      await this.showPermissionDenied(
        "Chỉ Quản trị viên hoặc Chủ kho được ghi đè vị trí đề xuất.",
      );
      return;
    }
    this.manualOverride.update((value) => !value);
    this.manualLocationId.set(null);
    this.overrideReason.set("");
    this.activeStatus.set(this.manualOverride() ? "override" : "suggested");
  }

  selectManualLocation(locationId: number | null): void {
    const normalizedId = Number(locationId);
    this.manualLocationId.set(normalizedId > 0 ? normalizedId : null);

    const line = this.selectedLine();
    const location = this.manualOverrideLocations().find(
      (item) => item.id === normalizedId,
    );
    if (!line || !location) return;

    const freeCapacity =
      Number(location.maxCapacity ?? 0) -
      Number(location.currentOccupancy ?? 0);
    this.placementWeightKg.set(
      Math.min(this.remaining(line.item), freeCapacity),
    );
  }

  manualLocationLabel(location: LocationDetailDto): string {
    return [
      `Khu ${location.zoneName}`,
      location.shelfRow && `Cột ${location.shelfRow}`,
      location.shelfLevel && `Lớp ${location.shelfLevel}`,
      location.slotCode && `Ô ${location.slotCode}`,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  async confirmPutaway(): Promise<void> {
    const line = this.selectedLine();
    if (!line || this.actionPending()) return;
    if (!this.canOperateInbound()) {
      await this.showPermissionDenied(
        "Chỉ Quản trị viên, Chủ kho hoặc Nhân viên kho được xác nhận nhập kho.",
      );
      return;
    }
    if (this.manualOverride() && !this.canManageInbound()) {
      await this.showPermissionDenied(
        "Chỉ Quản trị viên hoặc Chủ kho được xác nhận vị trí ghi đè.",
      );
      return;
    }

    const locationId = this.manualOverride()
      ? Number(this.manualLocationId())
      : Number(this.selectedLocationId());
    if (!locationId) {
      await Swal.fire({
        icon: "warning",
        title: "Chưa chọn vị trí",
        text: "Vui lòng chọn một vị trí đề xuất hoặc nhập vị trí ghi đè.",
        confirmButtonColor: "#16a34a",
      });
      return;
    }
    if (this.manualOverride() && !this.overrideReason().trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Thiếu lý do ghi đè",
        text: "Vui lòng nhập lý do chọn vị trí ngoài danh sách đề xuất.",
        confirmButtonColor: "#16a34a",
      });
      return;
    }

    const accepted = await Swal.fire({
      icon: "question",
      title: "Xác nhận nhập kho?",
      text: `Hệ thống sẽ tăng tồn kho ${this.formatKg(
        this.placementWeightKg(),
      )} tại vị trí đã chọn.`,
      showCancelButton: true,
      confirmButtonText: "Xác nhận",
      cancelButtonText: "Quay lại",
      confirmButtonColor: "#16a34a",
    });
    if (!accepted.isConfirmed) return;

    const weightKg = Number(this.placementWeightKg());
    const remainingBeforeConfirm = this.remaining(line.item);
    const isPartialPutaway = weightKg < remainingBeforeConfirm;

    try {
      await this.confirmPutawayMutation.mutateAsync({
        line,
        locationId,
        weightKg,
        isOverride: this.manualOverride(),
        overrideReason: this.manualOverride()
          ? this.overrideReason().trim()
          : null,
      });

      await this.success(
        isPartialPutaway
          ? "Đã nhập một phần lô. Chọn vị trí tiếp theo để nhập phần còn lại."
          : "Đã hoàn tất nhập kho lô hàng.",
      );
    } catch (error: any) {
      if (error?.status === 409) this.activeStatus.set("conflict");
      else this.activeStatus.set("error");
      this.showError(error, "Không thể xác nhận vị trí nhập kho.");
    }
  }

  actionLabel(): string {
    const status = this.selectedStatus();
    if (status === "draft") return "Gửi duyệt phiếu";
    if (status === "submitted") return "Phê duyệt phiếu";
    if (status === "approved") return "Bắt đầu nhận hàng";
    return "";
  }

  canAdvanceOrder(): boolean {
    const status = this.selectedStatus();
    if (status === "submitted") return this.canManageInbound();
    if (status === "draft" || status === "approved") {
      return this.canOperateInbound();
    }
    return false;
  }

  transitionPermissionMessage(): string {
    if (this.selectedStatus() === "submitted") {
      return "Phiếu đang chờ duyệt. Chỉ Quản trị viên hoặc Chủ kho được phê duyệt.";
    }
    return "Chỉ Quản trị viên, Chủ kho hoặc Nhân viên kho được chuyển bước nhận hàng.";
  }

  canPrepare(): boolean {
    return ["approved", "receiving", "partially received"].includes(
      this.selectedStatus(),
    );
  }

  remaining(item: InboundOrderItemDto): number {
    return Math.max(0, item.quantityOrdered - item.quantityReceived);
  }

  occupancyPercent(suggestion: PutawaySuggestionDto): number {
    const max = suggestion.currentOccupancy + suggestion.availableCapacity;
    return max <= 0
      ? 0
      : Math.min(100, Math.round((suggestion.currentOccupancy / max) * 100));
  }

  locationLabel(suggestion: PutawaySuggestionDto): string {
    return [
      suggestion.zoneName && `Khu ${suggestion.zoneName}`,
      suggestion.shelfRow && `Cột ${suggestion.shelfRow}`,
      suggestion.shelfLevel && `Lớp ${suggestion.shelfLevel}`,
      suggestion.slotCode && `Ô ${suggestion.slotCode}`,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  formatKg(value: number): string {
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 2,
    }).format(value)} kg`;
  }

  lineTitle(line: InboundPutawayLine): string {
    return `${line.item.paddyLotCode || line.order.poCode} · ${
      line.item.productVariantName || line.item.sku || "Lúa nguyên liệu"
    }`;
  }

  private async fetchInboundPutawayData(): Promise<InboundPutawayData> {
    // 1 request gộp: BE trả sẵn phiếu lúa/gạo chờ xếp kho + item đã hydrate,
    // chạy song song với load vị trí kho (thay list 100 phiếu + N getById gây N+1).
    const [ordersResponse, locations] = await Promise.all([
      lastValueFrom(this.inboundService.getPutawayPending()),
      (async (): Promise<LocationDetailDto[]> => {
        try {
          const locationsResponse = await lastValueFrom(
            this.locationService.getAll(),
          );
          return this.unwrap<LocationDetailDto[]>(locationsResponse) ?? [];
        } catch {
          return [];
        }
      })(),
    ]);

    const details =
      this.unwrap<InboundOrderDetailDto[]>(ordersResponse) ?? [];
    const allLines = details.flatMap((order: InboundOrderDetailDto) =>
      order.items.map((item: InboundOrderItemDto) => ({ order, item })),
    );
    const paddyLines = allLines.filter((line) => this.isPaddyLine(line));
    const hasPendingLine = paddyLines.some(
      (line) => this.remaining(line.item) > 0,
    );
    const warning =
      !hasPendingLine && paddyLines.length > 0
        ? `Tìm thấy ${paddyLines.length} dòng lúa/gạo nhưng backend đã đánh dấu ` +
          "đã nhận đủ hoặc hoàn tất. Hãy kiểm tra backend đang chạy đúng bản mới: " +
          "phiếu sinh từ Rice Purchase phải là Draft và QuantityReceived phải bằng 0."
        : "";

    return {
      lines: paddyLines,
      locations,
      warning,
    };
  }

  private async invalidateInboundData(): Promise<void> {
    await Promise.all([
      this.queryClient.invalidateQueries({
        queryKey: this.inboundQueryKey,
      }),
      this.queryClient.invalidateQueries({
        queryKey: this.suggestionQueryKey,
      }),
    ]);
  }

  private isPaddyLine(line: InboundPutawayLine): boolean {
    const sourceType = line.order.sourceType?.trim().toUpperCase();
    if (sourceType === "RECEIPT" || sourceType === "PADDY_PURCHASE") {
      return true;
    }

    if (
      line.order.paddyPurchaseReceiptId != null ||
      Boolean(line.order.paddyPurchaseReceiptCode) ||
      line.item.paddyLotId != null ||
      Boolean(line.item.paddyLotCode)
    ) {
      return true;
    }

    const searchableText = [
      line.order.note,
      line.item.productVariantName,
      line.item.sku,
    ]
      .filter(Boolean)
      .join(" ");
    return /(lúa|lua|thóc|thoc|gạo|gao|paddy|rice)/i.test(searchableText);
  }

  private hasRole(
    codes: string[],
    names: string[],
    fallbackIds: number[] = [],
  ): boolean {
    const normalizedCodes = codes.map((value) => value.toUpperCase());
    const normalizedNames = names.map((value) =>
      this.normalizeRoleValue(value),
    );

    return (this.authService.currentUser()?.roles ?? []).some((role) => {
      const roleCode = String((role as any).code ?? "").toUpperCase();
      const roleName = this.normalizeRoleValue(role.name);
      return (
        fallbackIds.includes(Number(role.id)) ||
        normalizedCodes.includes(roleCode) ||
        normalizedNames.some(
          (name) => roleName === name || roleName.includes(name),
        )
      );
    });
  }

  private normalizeRoleValue(value: unknown): string {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  private async showPermissionDenied(message: string): Promise<void> {
    await Swal.fire({
      icon: "warning",
      title: "Không có quyền thực hiện",
      text: message,
      confirmButtonColor: "#16a34a",
    });
  }

  private normalizedStatus(value?: string | null): string {
    return (value ?? "").trim().toLowerCase();
  }

  private unwrap<T>(response: any): T {
    const ok =
      response?.isSucceeded !== false &&
      (!response?.status || (response.status >= 200 && response.status < 300));
    if (!ok) throw new Error(response?.message || "Yêu cầu không thành công.");
    return (response?.resources ?? response?.data) as T;
  }

  private operationKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `inbound-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  }

  private async success(message: string): Promise<void> {
    await Swal.fire({
      icon: "success",
      title: "Thành công",
      text: message,
      timer: 1500,
      showConfirmButton: false,
    });
  }

  private showError(error: unknown, fallback: string): void {
    void Swal.fire({
      icon: "error",
      title: "Không thể thực hiện",
      text: this.apiError(error, fallback),
      confirmButtonColor: "#16a34a",
    });
  }

  private apiError(error: any, fallback: string): string {
    return (
      error?.error?.message ||
      error?.message ||
      error?.error?.errors?.[0] ||
      fallback
    );
  }
}
