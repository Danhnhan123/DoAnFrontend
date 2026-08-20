import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectQuery, injectQueryClient, keepPreviousData } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  ApiResponse,
  BAG_DISPOSITION,
  BagDisposition,
  BagQualityResult,
  CreateStockTakePayload,
  STOCK_TAKE_STATUS,
  StockTakeBagTargetSuggestion,
  StockTakeDetail,
  StockTakeItem,
  StockTakeItemBag,
  StockTakeRow,
  StockTakeScopeOptions,
  StockTakeStatusAdvancedRow,
  StockTakeSummary,
  StockTakeThresholds,
  WarehouseRow,
} from '../../models';
import { PermissionService } from '../../services/permission.service';
import { StockTakeStatusService } from '../../services/stock-take-status.service';
import { StockTakeService } from '../../services/stock-take.service';
import { WarehouseService } from '../../services/warehouse.service';
import { FilterSelectComponent, FilterSelectOption } from '../shared/filter-select.component';

/**
 * Một BAO trong bảng kiểm đếm.
 * `itemId` là dòng (lô) mà bao thuộc về ở phía backend — màn hình KHÔNG hiện
 * theo lô nữa, nhưng vẫn phải giữ để gửi kết quả về đúng dòng.
 */
interface CountBagLine {
  id: number;
  itemId: number;
  paddyLotBagId: number;
  bagNo: number;
  systemWeightKg: number;
  pickSequence: number;
  restowSequence: number;
  counted: boolean;
  countedWeightKg: number | null;
  qualityResult: BagQualityResult | null;
  moldLevel: string | null;
  pestLevel: string | null;
  packagingStatus: string | null;
  qualityNote: string;
  disposition: BagDisposition;
  targetLocationId: number | null;
  targetLocationCode: string | null;
  targetZoneName: string | null;
  dispositionNote: string;
  isUnexpected: boolean;
  scannedByQr: boolean;
}

interface CountLine {
  id: number;
  hasBags: boolean;
  /** Chỉ dùng cho dòng tồn kho cũ chưa quản lý theo bao. */
  actualQuantity: number | null;
  systemBagCount: number;
  systemQuantity: number;
  lotCode: string | null;
  bags: CountBagLine[];
}

/** Lý do lệch + chỉnh lý: nhập MỘT lần cho cả cột, không bắt gõ lại theo từng lô. */
interface ColumnDecision {
  varianceReason: string;
  adjustedBagCount: number | null;
  adjustedWeightKg: number | null;
  recountConfirmed: boolean;
}

interface CreateForm {
  warehouseId: number | null;
  locationId: number | null;
  note: string;
  /** Kiểm kê lại khu cách ly: dropdown chỉ liệt kê ô cách ly. */
  quarantineOnly: boolean;
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
  private readonly statusService = inject(StockTakeStatusService);
  private readonly queryClient = injectQueryClient();
  readonly perm = inject(PermissionService);
  readonly status = STOCK_TAKE_STATUS;
  readonly disposition = BAG_DISPOSITION;

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
  readonly decision = signal<ColumnDecision>({ varianceReason: '', adjustedBagCount: null, adjustedWeightKg: null, recountConfirmed: false });
  readonly bagTargets = signal<Record<number, StockTakeBagTargetSuggestion[]>>({});
  readonly createForm = signal<CreateForm>({ warehouseId: null, locationId: null, note: '', quarantineOnly: false });
  private searchTimer?: ReturnType<typeof setTimeout>;

  private readonly warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouse-options', 'stock-take'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
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

  /** Chỉ liệt kê cột ĐANG CÓ BAO — cột rỗng thì không có gì để đếm. */
  private readonly scopeOptionsQuery = injectQuery(() => ({
    queryKey: ['stock-take-columns', this.createForm().warehouseId, this.createForm().quarantineOnly],
    enabled: this.showCreate() && !!this.createForm().warehouseId,
    queryFn: () => lastValueFrom(this.service.getScopeOptions(
      this.createForm().warehouseId!,
      this.createForm().quarantineOnly ? true : null,
    )),
  }));

  readonly warehouses = computed<WarehouseRow[]>(() => this.resourceArray<WarehouseRow>(this.warehousesQuery.data()).filter(x => x.isActive));
  readonly warehouseOptions = computed<FilterSelectOption[]>(() => this.warehouses().map(x => ({ id: x.id, name: `${x.code} — ${x.name}` })));
  readonly scopeData = computed<StockTakeScopeOptions>(() =>
    (this.scopeOptionsQuery.data() as ApiResponse<StockTakeScopeOptions> | undefined)?.resources ?? { columns: [] });
  readonly columnOptions = computed<FilterSelectOption[]>(() => this.scopeData().columns.map(x => ({
    id: x.locationId,
    name: `${x.isQuarantine ? '🚧 ' : ''}${x.zoneName} / ${x.locationCode || `#${x.locationId}`} — ${x.bagCount} bao`,
  })));
  readonly columnsLoading = computed(() => this.scopeOptionsQuery.isPending() || this.scopeOptionsQuery.isFetching());

  readonly statusOptions = computed<FilterSelectOption[]>(() => {
    const response = this.statusesQuery.data() as ApiResponse<any> | undefined;
    const rows: StockTakeStatusAdvancedRow[] = response?.resources?.data ?? [];
    const canonicalOrder = [this.status.DRAFT, this.status.SUBMITTED, this.status.APPROVED, this.status.REJECTED];
    return rows
      .filter(x => canonicalOrder.includes(String(x.code || '').toUpperCase() as typeof canonicalOrder[number]))
      .sort((a, b) =>
        canonicalOrder.indexOf(String(a.code || '').toUpperCase() as typeof canonicalOrder[number]) -
        canonicalOrder.indexOf(String(b.code || '').toUpperCase() as typeof canonicalOrder[number])
      )
      .map(x => ({ id: x.id, name: x.name }));
  });

  readonly pageSizeOptions: FilterSelectOption[] = [
    { id: 10, name: '10 / trang' }, { id: 20, name: '20 / trang' }, { id: 50, name: '50 / trang' },
  ];
  readonly qualityOptions: FilterSelectOption[] = [
    { id: 'PASS', name: 'Đạt' },
    { id: 'ISSUE_DETECTED', name: 'Có vấn đề' },
  ];
  readonly moldOptions: FilterSelectOption[] = [
    { id: 'Không', name: 'Không mốc' }, { id: 'Nhẹ', name: 'Mốc nhẹ' }, { id: 'Nặng', name: 'Mốc nặng' },
  ];
  readonly pestOptions: FilterSelectOption[] = [
    { id: 'Không', name: 'Không mọt' }, { id: 'Có dấu hiệu', name: 'Có dấu hiệu mọt' }, { id: 'Cần xử lý', name: 'Mọt cần xử lý' },
  ];
  readonly packagingOptions: FilterSelectOption[] = [
    { id: 'Nguyên', name: 'Bao nguyên' }, { id: 'Rách', name: 'Bao rách' }, { id: 'Ẩm', name: 'Bao ẩm' },
  ];

  /** Phiếu kiểm kê ô cách ly mới có lựa chọn "Rút về khu thường". */
  readonly dispositionOptions = computed<FilterSelectOption[]>(() =>
    this.detail()?.isQuarantineScope === true
      ? [
          { id: BAG_DISPOSITION.KEEP, name: 'Giữ trong khu cách ly' },
          { id: BAG_DISPOSITION.RELEASE, name: 'Đạt — rút về khu thường' },
          { id: BAG_DISPOSITION.DISPOSE, name: 'Bao hỏng — bỏ cả bao' },
        ]
      : [
          { id: BAG_DISPOSITION.KEEP, name: 'Giữ nguyên vị trí' },
          { id: BAG_DISPOSITION.QUARANTINE, name: 'Chuyển sang khu cách ly' },
          { id: BAG_DISPOSITION.DISPOSE, name: 'Bao hỏng — bỏ cả bao' },
        ]);

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
    this.isStatus(this.detail()?.stockTakeStatusCode, this.status.DRAFT) && this.perm.canUpdate('STOCKTAKE'));

  // ── Danh sách BAO phẳng: kiểm kê theo cột nên không tách theo lô ───────────
  readonly bags = computed<CountBagLine[]>(() =>
    this.countLines()
      .flatMap(line => line.bags)
      .sort((a, b) => a.pickSequence - b.pickSequence || a.bagNo - b.bagNo));

  /** Dòng tồn kho cũ chưa quản lý theo bao — vẫn cho nhập tổng kg. */
  readonly legacyLines = computed<CountLine[]>(() => this.countLines().filter(x => !x.hasBags));

  readonly systemBagCount = computed(() => this.countLines().reduce((sum, x) => sum + x.systemBagCount, 0));
  readonly systemKg = computed(() => this.countLines().reduce((sum, x) => sum + x.systemQuantity, 0));
  readonly countedBagCount = computed(() =>
    this.decision().adjustedBagCount ?? this.bags().filter(x => x.counted).length);
  readonly countedKg = computed(() =>
    this.decision().adjustedWeightKg ??
    (this.bags().filter(x => x.counted).reduce((sum, x) => sum + (x.countedWeightKg ?? x.systemWeightKg), 0)
      + this.legacyLines().reduce((sum, x) => sum + (x.actualQuantity ?? 0), 0)));
  readonly bagVariance = computed(() => this.countedBagCount() - this.systemBagCount());
  readonly kgVariance = computed(() => this.countedKg() - this.systemKg());
  readonly touched = computed(() =>
    this.bags().some(x => x.counted || x.countedWeightKg != null) ||
    this.legacyLines().some(x => x.actualQuantity != null));

  readonly quarantineCount = computed(() => this.bags().filter(x => x.disposition === BAG_DISPOSITION.QUARANTINE).length);
  readonly disposeCount = computed(() => this.bags().filter(x => x.disposition === BAG_DISPOSITION.DISPOSE).length);
  readonly releaseCount = computed(() => this.bags().filter(x => x.disposition === BAG_DISPOSITION.RELEASE).length);
  readonly issueCount = computed(() => this.bags().filter(x => x.qualityResult === 'ISSUE_DETECTED').length);

  /** Chỉnh lý tổng chỉ hiện khi cột có đúng một lô — nhiều lô thì không chia được. */
  readonly canAdjustTotals = computed(() => this.countLines().filter(x => x.hasBags).length <= 1);

  /** Lệch SỐ BAO luôn là LARGE: mất nguyên một bao là sự cố an ninh kho. */
  readonly severity = computed(() => {
    if (!this.touched()) return 'NONE';
    if (this.bagVariance() !== 0) return 'LARGE';
    const abs = Math.abs(this.kgVariance());
    if (abs < 0.001) return 'NONE';
    const system = this.systemKg();
    const pct = system === 0 ? Number.POSITIVE_INFINITY : (abs / Math.abs(system)) * 100;
    const t = this.thresholds();
    if (pct > t.mediumVariancePercent || abs > t.mediumVarianceKg) return 'LARGE';
    if (pct > t.smallVariancePercent || abs > t.smallVarianceKg) return 'MEDIUM';
    return 'SMALL';
  });

  readonly hasVariance = computed(() =>
    this.touched() && (this.bagVariance() !== 0 || Math.abs(this.kgVariance()) > 0.001));

  constructor() {
    effect(() => {
      const current = this.detail();
      if (!current || current.id !== this.selectedId()) return;
      this.countLines.set(current.stockTakeItems.map(item => this.toCountLine(item)));
      const withReason = current.stockTakeItems.find(x => (x.varianceReason || '').trim());
      const withAdjust = current.stockTakeItems.find(x => x.adjustedBagCount != null || x.adjustedWeightKg != null);
      this.decision.set({
        varianceReason: withReason?.varianceReason || '',
        adjustedBagCount: withAdjust?.adjustedBagCount ?? null,
        adjustedWeightKg: withAdjust?.adjustedWeightKg == null ? null : Number(withAdjust.adjustedWeightKg),
        recountConfirmed: current.stockTakeItems.some(x => x.recountConfirmed),
      });
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void { if (this.searchTimer) clearTimeout(this.searchTimer); }

  private toCountLine(item: StockTakeItem): CountLine {
    return {
      id: item.id,
      hasBags: (item.bags?.length ?? 0) > 0,
      actualQuantity: item.actualQuantity == null ? null : Number(item.actualQuantity),
      systemBagCount: item.systemBagCount ?? 0,
      systemQuantity: Number(item.systemQuantity || 0),
      lotCode: item.lotCode ?? null,
      bags: (item.bags || []).map(bag => this.toBagLine(bag, item.id)),
    };
  }

  private toBagLine(bag: StockTakeItemBag, itemId: number): CountBagLine {
    return {
      id: bag.id,
      itemId,
      paddyLotBagId: bag.paddyLotBagId,
      bagNo: bag.bagNo,
      systemWeightKg: Number(bag.systemWeightKg || 0),
      pickSequence: bag.pickSequence,
      restowSequence: bag.restowSequence,
      counted: bag.counted,
      countedWeightKg: bag.countedWeightKg == null ? null : Number(bag.countedWeightKg),
      qualityResult: bag.qualityResult ?? null,
      moldLevel: bag.moldLevel ?? null,
      pestLevel: bag.pestLevel ?? null,
      packagingStatus: bag.packagingStatus ?? null,
      qualityNote: bag.qualityNote || '',
      disposition: bag.disposition || BAG_DISPOSITION.KEEP,
      targetLocationId: bag.targetLocationId ?? null,
      targetLocationCode: bag.targetLocationCode ?? null,
      targetZoneName: bag.targetZoneName ?? null,
      dispositionNote: bag.dispositionNote || '',
      isUnexpected: bag.isUnexpected,
      scannedByQr: bag.scannedByQr,
    };
  }

  // ── Danh sách ──────────────────────────────────────────────────────────────
  onSearch(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.search.set(value.trim()); this.page.set(1); }, 350);
  }
  setWarehouseFilter(value: number | null): void { this.warehouseFilter.set(value); this.page.set(1); }
  setStatusFilter(value: number | null): void { this.statusFilter.set(value); this.page.set(1); }
  changePage(next: number): void { if (next >= 1 && next <= this.totalPages()) this.page.set(next); }
  changePageSize(value: number): void { this.pageSize.set(Number(value) || 10); this.page.set(1); }
  openDetail(id: number): void { this.selectedId.set(id); this.bagTargets.set({}); }
  closeDetail(): void { if (!this.actionLoading()) this.selectedId.set(null); }

  // ── Tạo phiếu ──────────────────────────────────────────────────────────────
  openCreateForm(): void {
    this.createForm.set({ warehouseId: null, locationId: null, note: '', quarantineOnly: false });
    this.showCreate.set(true);
  }
  closeCreateForm(): void { if (!this.saving()) this.showCreate.set(false); }
  setCreateWarehouse(value: number | null): void { this.createForm.update(x => ({ ...x, warehouseId: value, locationId: null })); }
  setCreateLocation(value: number | null): void { this.createForm.update(x => ({ ...x, locationId: value })); }
  setCreateNote(value: string): void { this.createForm.update(x => ({ ...x, note: value })); }
  toggleQuarantineOnly(value: boolean): void { this.createForm.update(x => ({ ...x, quarantineOnly: value, locationId: null })); }

  async createStockTake(): Promise<void> {
    const form = this.createForm();
    if (!form.warehouseId) return this.alert('Vui lòng chọn kho.', false);
    if (!form.locationId) return this.alert('Vui lòng chọn cột cần kiểm kê.', false);
    const payload: CreateStockTakePayload = {
      warehouseId: form.warehouseId,
      stockTakeStatusId: 0,
      scopeType: 'COLUMN',
      note: form.note.trim() || null,
      stockTakeItems: [],
      locationId: form.locationId,
    };
    this.saving.set(true);
    try {
      const response = await lastValueFrom(this.service.create(payload));
      if (!response.isSucceeded) throw new Error(response.message);
      this.showCreate.set(false);
      await this.refresh();
      this.alert(response.message || 'Đã tạo phiếu và chụp danh sách bao của cột.');
    } catch (error) { this.alert(this.errorText(error), false); }
    finally { this.saving.set(false); }
  }

  // ── Kiểm đếm theo bao ──────────────────────────────────────────────────────
  updateBag(bagId: number, field: keyof CountBagLine, value: unknown): void {
    this.countLines.update(lines => lines.map(line => ({
      ...line,
      bags: line.bags.map(bag => {
        if (bag.id !== bagId) return bag;
        const next: CountBagLine = {
          ...bag,
          [field]: field === 'countedWeightKg'
            ? (value === '' || value == null ? null : Number(value))
            : value,
        } as CountBagLine;
        // Chấm chất lượng hay chọn cách xử lý nghĩa là đã cầm bao trên tay.
        if ((field === 'disposition' || field === 'qualityResult') && value != null && value !== BAG_DISPOSITION.KEEP) {
          next.counted = true;
        }
        // Bỏ tích "tìm thấy" thì mọi quyết định trên bao đó không còn hiệu lực.
        if (field === 'counted' && value === false) {
          next.countedWeightKg = null;
          next.disposition = BAG_DISPOSITION.KEEP;
          next.targetLocationId = null;
        }
        // Đổi cách xử lý thì vị trí đích cũ không còn hợp lệ (ô cách ly vs cột thường).
        if (field === 'disposition' && next.disposition !== bag.disposition) next.targetLocationId = null;
        return next;
      }),
    })));
    if (field === 'disposition' && (value === BAG_DISPOSITION.QUARANTINE || value === BAG_DISPOSITION.RELEASE)) {
      void this.loadBagTargets(bagId);
    }
  }

  updateLegacyLine(itemId: number, value: unknown): void {
    this.countLines.update(lines => lines.map(line => line.id !== itemId ? line : {
      ...line,
      actualQuantity: value === '' || value == null ? null : Number(value),
    }));
  }

  updateDecision(field: keyof ColumnDecision, value: unknown): void {
    this.decision.update(current => ({
      ...current,
      [field]: (field === 'adjustedBagCount' || field === 'adjustedWeightKg')
        ? (value === '' || value == null ? null : Number(value))
        : value,
    }));
  }

  markAll(counted: boolean): void {
    this.countLines.update(lines => lines.map(line => ({
      ...line,
      bags: line.bags.map(bag => counted
        ? { ...bag, counted: true }
        : { ...bag, counted: false, countedWeightKg: null, disposition: BAG_DISPOSITION.KEEP, targetLocationId: null }),
    })));
  }

  needsTarget(bag: CountBagLine): boolean {
    return bag.disposition === BAG_DISPOSITION.QUARANTINE || bag.disposition === BAG_DISPOSITION.RELEASE;
  }

  bagKgDiff(bag: CountBagLine): number | null {
    if (!bag.counted) return -bag.systemWeightKg;
    if (bag.countedWeightKg == null) return null;
    return bag.countedWeightKg - bag.systemWeightKg;
  }

  // ── Gợi ý vị trí đích ──────────────────────────────────────────────────────
  async loadBagTargets(bagId: number): Promise<void> {
    const current = this.detail();
    if (!current || this.bagTargets()[bagId]) return;
    try {
      const response = await lastValueFrom(this.service.getBagTargetSuggestions(current.id, bagId));
      const targets = response.resources ?? [];
      this.bagTargets.update(map => ({ ...map, [bagId]: targets }));
      // Vẫn để backend chọn sẵn vị trí đầu danh sách cho đỡ một thao tác, nhưng
      // KHÔNG gắn nhãn "gợi ý/★" ra màn hình: khi bảo vệ, chữ đó dễ bị hiểu nhầm
      // là hệ thống dùng AI để quyết định thay người.
      const recommended = targets[0];
      if (recommended) {
        this.countLines.update(lines => lines.map(line => ({
          ...line,
          bags: line.bags.map(bag =>
            bag.id === bagId && bag.targetLocationId == null
              ? { ...bag, targetLocationId: recommended.locationId }
              : bag),
        })));
      }
    } catch { this.bagTargets.update(map => ({ ...map, [bagId]: [] })); }
  }

  bagTargetOptions(bagId: number): FilterSelectOption[] {
    return (this.bagTargets()[bagId] ?? []).map(x => ({
      id: x.locationId,
      name: `${x.zoneName} / ${x.locationCode || `#${x.locationId}`}`,
    }));
  }

  // ── Lưu / gửi duyệt ────────────────────────────────────────────────────────
  async saveCounts(showSuccess = true): Promise<boolean> {
    const current = this.detail();
    if (!current) return false;
    if (this.bags().some(bag => bag.countedWeightKg != null && bag.countedWeightKg < 0)) {
      this.alert('Khối lượng cân của bao không được âm.', false); return false;
    }
    const decision = this.decision();
    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(this.service.saveCounts(current.id, {
        note: current.note || null,
        items: this.countLines().map(line => ({
          id: line.id,
          actualQuantity: line.hasBags ? null : line.actualQuantity,
          note: null,
          // Lý do lệch nhập một lần cho cả cột rồi áp cho mọi lô trong cột đó.
          varianceReason: decision.varianceReason.trim() || null,
          adjustedBagCount: this.canAdjustTotals() ? decision.adjustedBagCount : null,
          adjustedWeightKg: this.canAdjustTotals() ? decision.adjustedWeightKg : null,
          recountConfirmed: decision.recountConfirmed,
          bags: line.bags.map(bag => ({
            id: bag.id,
            paddyLotBagId: bag.paddyLotBagId,
            counted: bag.counted,
            scannedByQr: bag.scannedByQr,
            countedWeightKg: bag.countedWeightKg,
            qualityResult: bag.qualityResult,
            moldLevel: bag.moldLevel,
            pestLevel: bag.pestLevel,
            packagingStatus: bag.packagingStatus,
            qualityNote: bag.qualityNote.trim() || null,
            disposition: bag.disposition,
            targetLocationId: bag.targetLocationId,
            dispositionNote: bag.dispositionNote.trim() || null,
          })),
        })),
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

    if (!this.touched()) return this.alert('Chưa kiểm bao nào. Vui lòng kiểm đếm trước khi gửi duyệt.', false);
    if (this.legacyLines().some(x => x.actualQuantity == null))
      return this.alert('Còn dòng chưa nhập khối lượng thực tế.', false);
    if (this.hasVariance() && !this.decision().varianceReason.trim())
      return this.alert('Cột có chênh lệch bao hoặc kg — bắt buộc nêu lý do.', false);
    if (this.severity() === 'LARGE' && !this.decision().recountConfirmed)
      return this.alert('Chênh lệch mức LARGE — bắt buộc xác nhận đã kiểm đếm lại.', false);

    const missingTarget = this.bags().find(bag => this.needsTarget(bag) && bag.targetLocationId == null);
    if (missingTarget) return this.alert(`Bao #${missingTarget.bagNo} chưa chọn vị trí đích.`, false);

    const missingDisposeNote = this.bags().find(bag => bag.disposition === BAG_DISPOSITION.DISPOSE && !bag.dispositionNote.trim());
    if (missingDisposeNote) return this.alert(`Bao #${missingDisposeNote.bagNo} bị bỏ vì hỏng — phải ghi rõ lý do.`, false);

    const confirmed = await Swal.fire({
      title: 'Gửi phiếu để duyệt?',
      text: `Đã kiểm ${this.countedBagCount()}/${this.systemBagCount()} bao. Sau khi gửi, kết quả sẽ bị khóa.`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Gửi duyệt', cancelButtonText: 'Hủy',
    });
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
    const result = await Swal.fire({
      title: `Duyệt ${current.stCode}?`,
      text: 'Duyệt sẽ đồng bộ bao vật lý (bao mất, bao hỏng, bao chuyển cách ly) rồi tính lại tồn kho.',
      input: 'textarea', inputLabel: 'Ghi chú duyệt (không bắt buộc)',
      showCancelButton: true, confirmButtonText: 'Duyệt & điều chỉnh tồn', cancelButtonText: 'Hủy', confirmButtonColor: '#15803d',
    });
    if (!result.isConfirmed) return;
    await this.runAction(() => this.service.approve(current.id, result.value), 'Đã duyệt và điều chỉnh tồn kho.');
  }

  async reject(): Promise<void> {
    const current = this.detail(); if (!current) return;
    const result = await Swal.fire({
      title: `Từ chối ${current.stCode}?`, input: 'textarea', inputLabel: 'Lý do từ chối',
      inputValidator: value => value?.trim() ? undefined : 'Vui lòng nhập lý do.',
      showCancelButton: true, confirmButtonText: 'Từ chối', cancelButtonText: 'Hủy', confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    await this.runAction(() => this.service.reject(current.id, result.value), 'Đã từ chối phiếu kiểm kê.');
  }

  // ── Tiện ích hiển thị ──────────────────────────────────────────────────────
  statusClass(code?: string | null): string { return `status-${String(code || '').toLowerCase()}`; }
  isStatus(code: string | null | undefined, expected: string): boolean {
    return String(code || '').trim().toUpperCase() === expected.trim().toUpperCase();
  }
  severityClass(value?: string | null): string { return `severity-${String(value || 'NONE').toLowerCase()}`; }
  dispositionClass(value?: string | null): string { return `disp-${String(value || 'KEEP').toLowerCase()}`; }
  dispositionLabel(value?: string | null): string {
    switch (value) {
      case BAG_DISPOSITION.QUARANTINE: return 'Cách ly';
      case BAG_DISPOSITION.DISPOSE: return 'Bỏ bao hỏng';
      case BAG_DISPOSITION.RELEASE: return 'Rút về khu thường';
      default: return 'Giữ nguyên';
    }
  }
  qualityLabel(value?: string | null): string {
    return value === 'ISSUE_DETECTED' ? 'Có vấn đề' : (value === 'PASS' ? 'Đạt' : '—');
  }
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
