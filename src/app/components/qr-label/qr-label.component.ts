import { CommonModule } from "@angular/common";
import { HasPermissionDirective } from "../../directives/has-permission.directive";
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom } from "rxjs";
import Swal from "sweetalert2";

import {
  ApiResponse,
  DTResponse,
  LocationRow,
  PaddyLotRow,
  ProductVariantRow,
  QrLabelFormat,
  QrLabelHistoryItem,
  QrLabelHistoryResult,
  QrLabelPreview,
  QrLabelPreviewData,
  QrLabelSummary,
  QrLabelTemplate,
  QrLabelType,
} from "../../models";
import { LocationService } from "../../services/location.service";
import { PaddyLotService } from "../../services/paddy-lot.service";
import { ProductVariantService } from "../../services/product-variant.service";
import { QrLabelService } from "../../services/qr-label.service";
import {
  FilterSelectComponent,
  FilterSelectOption,
} from "../shared/filter-select.component";

@Component({
  selector: "app-qr-label",
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent, HasPermissionDirective],
  templateUrl: "./qr-label.component.html",
  styleUrl: "./qr-label.component.css",
})
export class QrLabelComponent implements OnInit, OnDestroy {
  private readonly qrService = inject(QrLabelService);
  private readonly lotService = inject(PaddyLotService);
  private readonly locationService = inject(LocationService);
  private readonly variantService = inject(ProductVariantService);
  private readonly route = inject(ActivatedRoute);

  readonly pageSize = 10;
  readonly page = signal(1);
  readonly searchInput = signal("");
  readonly search = signal("");
  readonly historyType = signal<QrLabelType | null>(null);
  readonly dateFrom = signal<string | null>(null);
  readonly dateTo = signal<string | null>(null);

  readonly summary = signal<QrLabelSummary>({
    totalLabelsThisMonth: 0,
    totalJobsThisMonth: 0,
    printMode: "BROWSER",
  });
  readonly history = signal<QrLabelHistoryItem[]>([]);
  readonly historyTotal = signal(0);
  readonly loading = signal(false);
  readonly historyLoading = signal(false);
  readonly loadError = signal("");

  readonly showCreate = signal(false);
  readonly reprintItem = signal<QrLabelHistoryItem | null>(null);
  readonly labelType = signal<QrLabelType>("PADDY_LOT");
  readonly selectedIds = signal<number[]>([]);
  readonly template = signal<QrLabelTemplate>("MEDIUM");
  readonly format = signal<QrLabelFormat>("PDF");
  readonly copiesPerLabel = signal(1);
  readonly preview = signal<QrLabelPreviewData | null>(null);
  readonly previewLoading = signal(false);
  readonly generating = signal(false);
  readonly formError = signal("");

  readonly isReprint = computed(() => this.reprintItem() !== null);

  readonly lots = signal<PaddyLotRow[]>([]);
  readonly locations = signal<LocationRow[]>([]);
  readonly variants = signal<ProductVariantRow[]>([]);

  private searchTimer?: ReturnType<typeof setTimeout>;
  private previewSequence = 0;

  readonly labelTypeOptions: FilterSelectOption[] = [
    { id: "PADDY_LOT", name: "Lô lúa/gạo" },
    { id: "BAG", name: "Bao gạo (SKU + lô)" },
    { id: "LOCATION", name: "Vị trí kho" },
    { id: "SKU", name: "SKU sản phẩm" },
  ];
  readonly templateOptions: FilterSelectOption[] = [
    { id: "SMALL", name: "Nhỏ · 50 × 30 mm" },
    { id: "MEDIUM", name: "Vừa · 70 × 50 mm" },
    { id: "LARGE", name: "Lớn · 100 × 70 mm" },
  ];
  readonly formatOptions: FilterSelectOption[] = [
    { id: "PDF", name: "PDF · Mở để in" },
    { id: "PNG", name: "PNG · Tải file ZIP" },
  ];
  readonly historyTypeOptions = this.labelTypeOptions;

  readonly subjectOptions = computed<FilterSelectOption[]>(() => {
    if (this.labelType() === "LOCATION") {
      return this.locations().map((item) => ({
        id: item.id,
        name: `${item.slotCode || item.zoneName} · ${item.warehouseName || "Kho #" + item.warehouseId}`,
      }));
    }
    if (this.labelType() === "SKU") {
      return this.variants().map((item) => ({
        id: item.id,
        name: `${item.sku} · ${item.name}`,
      }));
    }
    return this.lots().map((item) => ({
      id: item.id,
      name: `${item.lotCode} · ${item.sku || item.productVariantName || item.lotType}`,
    }));
  });

  readonly totalLabels = computed(
    () =>
      this.selectedIds().length *
      Math.max(0, Number(this.copiesPerLabel()) || 0),
  );
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.historyTotal() / this.pageSize)),
  );
  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const count = Math.min(5, total);
    const start = Math.max(1, Math.min(this.page() - 2, total - count + 1));
    return Array.from({ length: count }, (_, index) => start + index);
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadReferenceData(), this.reloadDashboard()]);
    this.applyRouteDefaults();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  async reloadDashboard(): Promise<void> {
    this.loadError.set("");
    await Promise.all([this.loadSummary(), this.loadHistory()]);
  }

  async loadSummary(): Promise<void> {
    try {
      const response = await lastValueFrom(this.qrService.getSummary());
      this.summary.set(this.unwrap(response, "Không tải được số liệu tem QR."));
    } catch (error) {
      this.loadError.set(
        this.errorMessage(error, "Không tải được số liệu tem QR."),
      );
    }
  }

  async loadHistory(): Promise<void> {
    this.historyLoading.set(true);
    try {
      const response = await lastValueFrom(
        this.qrService.getHistory({
          page: this.page(),
          pageSize: this.pageSize,
          search: this.search(),
          labelType: this.historyType(),
          dateFrom: this.dateFrom(),
          dateTo: this.dateTo(),
        }),
      );
      const result = this.unwrap<QrLabelHistoryResult>(
        response,
        "Không tải được lịch sử tạo tem.",
      );
      this.history.set(result.items || []);
      this.historyTotal.set(Number(result.total || 0));
      if (this.page() > this.totalPages()) this.page.set(this.totalPages());
    } catch (error) {
      this.history.set([]);
      this.loadError.set(
        this.errorMessage(error, "Không tải được lịch sử tạo tem."),
      );
    } finally {
      this.historyLoading.set(false);
    }
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.search.set(value.trim());
      this.page.set(1);
      void this.loadHistory();
    }, 350);
  }

  applyHistoryFilter(): void {
    this.page.set(1);
    void this.loadHistory();
  }

  resetHistoryFilter(): void {
    this.searchInput.set("");
    this.search.set("");
    this.historyType.set(null);
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.page.set(1);
    void this.loadHistory();
  }

  setPage(page: number): void {
    const next = Math.max(1, Math.min(page, this.totalPages()));
    if (next === this.page()) return;
    this.page.set(next);
    void this.loadHistory();
  }

  openCreateModal(): void {
    this.reprintItem.set(null);
    this.formError.set("");
    this.preview.set(null);
    this.selectedIds.set([]);
    this.copiesPerLabel.set(1);
    this.template.set("MEDIUM");
    this.format.set("PDF");
    this.showCreate.set(true);
  }

  openReprintModal(item: QrLabelHistoryItem): void {
    const ids = item.targetIds
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (!ids.length) {
      void Swal.fire({
        title: "Không thể xem lại tem",
        text: "Lệnh in cũ không còn thông tin đối tượng để khôi phục.",
        icon: "error",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#15803d",
      });
      return;
    }

    const savedTemplate = this.templateOptions.some(
      (option) => option.id === item.template,
    )
      ? (item.template as QrLabelTemplate)
      : "MEDIUM";
    const savedFormat: QrLabelFormat =
      item.labelType === "SKU" || item.format !== "PNG" ? "PDF" : "PNG";
    const copies = Math.max(1, Math.round(item.quantity / ids.length));

    this.formError.set("");
    this.preview.set(null);
    this.reprintItem.set(item);
    this.labelType.set(item.labelType);
    this.selectedIds.set(ids);
    this.template.set(savedTemplate);
    this.format.set(savedFormat);
    this.copiesPerLabel.set(copies);
    this.showCreate.set(true);
    void this.loadPreview();
  }

  closeCreateModal(): void {
    if (this.generating()) return;
    this.showCreate.set(false);
    this.reprintItem.set(null);
    this.formError.set("");
    this.preview.set(null);
  }

  changeLabelType(value: QrLabelType): void {
    this.labelType.set(value);
    this.selectedIds.set([]);
    this.preview.set(null);
    this.formError.set("");
    if (value === "SKU") this.format.set("PDF");
  }

  changeSubjects(value: number[]): void {
    this.selectedIds.set((value || []).map(Number).filter(Number.isFinite));
    this.formError.set("");
    void this.loadPreview();
  }

  changeTemplate(value: QrLabelTemplate): void {
    this.template.set(value);
    void this.loadPreview();
  }

  changeFormat(value: QrLabelFormat): void {
    this.format.set(this.labelType() === "SKU" ? "PDF" : value);
  }

  changeCopies(value: number | string): void {
    const parsed = Math.trunc(Number(value));
    this.copiesPerLabel.set(Number.isFinite(parsed) ? parsed : 0);
    this.formError.set("");
  }

  async loadPreview(): Promise<void> {
    const id = this.selectedIds()[0];
    if (!id) {
      this.preview.set(null);
      return;
    }

    const sequence = ++this.previewSequence;
    this.previewLoading.set(true);
    try {
      const response = await lastValueFrom(
        this.qrService.getPreview(this.labelType(), id, this.template()),
      );
      const result = this.unwrap<QrLabelPreview>(
        response,
        "Không thể tải đối tượng cần in nhãn.",
      );
      if (sequence === this.previewSequence)
        this.preview.set(result.label || null);
    } catch (error) {
      if (sequence === this.previewSequence) {
        this.preview.set(null);
        this.formError.set(
          this.errorMessage(error, "Không thể tải đối tượng cần in nhãn."),
        );
      }
    } finally {
      if (sequence === this.previewSequence) this.previewLoading.set(false);
    }
  }

  async generateLabels(): Promise<void> {
    const ids = this.selectedIds();
    const copies = this.copiesPerLabel();
    if (!ids.length) {
      this.formError.set("Vui lòng chọn ít nhất một đối tượng cần in.");
      return;
    }
    if (copies < 1 || copies > 500) {
      this.formError.set("Số bản trên mỗi nhãn phải nằm trong khoảng 1–500.");
      return;
    }
    if (this.totalLabels() > 500) {
      this.formError.set(
        "Tổng số tem của một lần tạo không được vượt quá 500.",
      );
      return;
    }
    if (!this.preview()) {
      this.formError.set(
        "Vui lòng chờ xem trước tem hợp lệ trước khi tạo file.",
      );
      return;
    }

    this.formError.set("");
    const reprinting = this.isReprint();
    this.generating.set(true);
    try {
      const response = await lastValueFrom(
        this.qrService.generateFile(this.labelType(), {
          ids,
          format: this.labelType() === "SKU" ? "PDF" : this.format(),
          template: this.template(),
          copiesPerLabel: copies,
        }),
      );
      if (!response.body || response.body.size === 0) {
        throw new Error("File tem trả về rỗng.");
      }

      const actualFormat = this.labelType() === "SKU" ? "PDF" : this.format();
      this.openOrDownloadBlob(
        response.body,
        actualFormat,
        response.headers.get("content-disposition"),
      );
      this.showCreate.set(false);
      await this.reloadDashboard();

      await Swal.fire({
        title: reprinting ? "Đã mở tem để in lại" : "Đã tạo file tem",
        text:
          actualFormat === "PDF"
            ? reprinting
              ? "File PDF dùng lại đúng mã QR cũ đã được mở. Chọn In trong trình duyệt để in lại."
              : "File PDF đã được mở. Bạn có thể xem lại và chọn In trong trình duyệt."
            : reprinting
              ? "File ZIP dùng lại đúng mã QR cũ đã được tải xuống."
              : "File ZIP chứa ảnh PNG đã được tải xuống.",
        icon: "success",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#15803d",
      });
      this.reprintItem.set(null);
    } catch (error) {
      this.formError.set(
        this.errorMessage(error, "Không thể tạo file tem QR."),
      );
    } finally {
      this.generating.set(false);
    }
  }

  labelTypeName(type: string): string {
    return this.labelTypeOptions.find((item) => item.id === type)?.name || type;
  }

  statusName(status: string): string {
    return status === "GENERATED" ? "Đã tạo file" : status;
  }

  templateName(template: string): string {
    return (
      this.templateOptions.find((item) => item.id === template)?.name ||
      template
    );
  }

  formatDate(value?: string | null): string {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
  }

  private async loadReferenceData(): Promise<void> {
    this.loading.set(true);
    try {
      const variantBody = this.variantService.buildPagedBody({
        page: 1,
        pageSize: 1000,
        search: "",
        sortField: "createdDate",
        sortDir: "desc",
        colMap: { createdDate: 7 },
        filterProductId: null,
      });
      const [lotsResponse, locationsResponse, variantsResponse] =
        await Promise.all([
          lastValueFrom(this.lotService.getAll()),
          lastValueFrom(this.locationService.getAll()),
          lastValueFrom(this.variantService.getPagedAdvanced(variantBody)),
        ]);
      this.lots.set(this.unwrapList<PaddyLotRow>(lotsResponse));
      this.locations.set(this.unwrapList<LocationRow>(locationsResponse));
      this.variants.set(
        this.unwrap<DTResponse<ProductVariantRow>>(
          variantsResponse,
          "Không tải được danh sách SKU.",
        ).data || [],
      );
    } catch (error) {
      this.loadError.set(
        this.errorMessage(error, "Không tải được dữ liệu chọn tem."),
      );
    } finally {
      this.loading.set(false);
    }
  }

  private applyRouteDefaults(): void {
    const type = this.route.snapshot.queryParamMap
      .get("labelType")
      ?.toUpperCase() as QrLabelType | undefined;
    const subjectId = Number(
      this.route.snapshot.queryParamMap.get("subjectId"),
    );
    if (!type || !this.labelTypeOptions.some((item) => item.id === type))
      return;

    this.labelType.set(type);
    this.format.set("PDF");
    this.selectedIds.set(
      Number.isFinite(subjectId) && subjectId > 0 ? [subjectId] : [],
    );
    this.showCreate.set(true);
    if (this.selectedIds().length) void this.loadPreview();
  }

  private openOrDownloadBlob(
    blob: Blob,
    format: QrLabelFormat,
    disposition: string | null,
  ): void {
    const url = URL.createObjectURL(blob);
    const filename =
      this.filenameFromDisposition(disposition) ||
      `qr-labels-${new Date().toISOString().slice(0, 10)}.${format === "PDF" ? "pdf" : "zip"}`;

    if (format === "PDF") {
      const opened = window.open(url, "_blank");
      if (opened) opened.opener = null;
      if (!opened) this.downloadUrl(url, filename);
    } else {
      this.downloadUrl(url, filename);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private downloadUrl(url: string, filename: string): void {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  }

  private filenameFromDisposition(disposition: string | null): string | null {
    if (!disposition) return null;
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (utf8) return decodeURIComponent(utf8.replace(/["']/g, ""));
    return disposition.match(/filename="?([^";]+)"?/i)?.[1] || null;
  }

  private unwrap<T>(response: ApiResponse<T> | any, fallback: string): T {
    if (response?.isSucceeded === false)
      throw new Error(response.message || fallback);
    const resource = response?.resources ?? response?.data;
    if (resource === undefined || resource === null)
      throw new Error(response?.message || fallback);
    return resource as T;
  }

  private unwrapList<T>(response: ApiResponse<T[]> | any): T[] {
    const value = this.unwrap<any>(
      response,
      "Không tải được danh sách dữ liệu.",
    );
    return Array.isArray(value) ? value : value?.data || value?.items || [];
  }

  private errorMessage(error: any, fallback: string): string {
    return error?.error?.message || error?.message || fallback;
  }
}
