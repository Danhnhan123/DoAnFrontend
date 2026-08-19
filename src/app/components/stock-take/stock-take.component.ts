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
  StockTakeScopeType,
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

/** Một BAO trong bảng kiểm đếm — đơn vị kiểm kê thật sự. */
interface CountBagLine {
  id: number;
  paddyLotBagId: number;
  bagNo: number;
  qrCode: string | null;
  lotCode: string | null;
  systemWeightKg: number;
  pickSequence: number;
  restowSequence: number;
  counted: boolean;
  scannedByQr: boolean;
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
}

interface CountLine {
  id: number;
  hasBags: boolean;
  /** Chỉ dùng cho dòng tồn kho cũ chưa quản lý theo bao. */
  actualQuantity: number | null;
  note: string;
  varianceReason: string;
  adjustedBagCount: number | null;
  adjustedWeightKg: number | null;
  recountConfirmed: boolean;
  systemBagCount: number;
  systemQuantity: number;
  bags: CountBagLine[];
}

interface CreateForm {
  warehouseId: number | null;
  scopeType: StockTakeScopeType;
  scopeValue: string | number | null;
  note: string;
  /** Kiểm kê khu cách ly: chỉ liệt kê ô cách ly trong dropdown. */
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
  readonly expandedItems = signal<Set<number>>(new Set());
  readonly bagTargets = signal<Record<number, StockTakeBagTargetSuggestion[]>>({});
  readonly scanInput = signal('');
  readonly scanWeight = signal<number | null>(null);
  readonly scanMessage = signal<string>('');
  readonly scopeQrInput = signal('');
  readonly createForm = signal<CreateForm>({ warehouseId: null, scopeType: 'COLUMN', scopeValue: null, note: '', quarantineOnly: false });
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

  /** Nguồn dropdown phạm vi: chỉ khu/cột/lô ĐANG CÓ BAO — kiểm kê theo bao thì cột rỗng không có gì để đếm. */
  private readonly scopeOptionsQuery = injectQuery(() => ({
    queryKey: ['stock-take-scope-options', this.createForm().warehouseId, this.createForm().quarantineOnly],
    enabled: this.showCreate() && !!this.createForm().warehouseId,
    queryFn: () => lastValueFrom(this.service.getScopeOptions(
      this.createForm().warehouseId!,
      this.createForm().quarantineOnly ? true : null,
    )),
  }));

  readonly warehouses = computed<WarehouseRow[]>(() => this.resourceArray<WarehouseRow>(this.warehousesQuery.data()).filter(x => x.isActive));
  readonly warehouseOptions = computed<FilterSelectOption[]>(() => this.warehouses().map(x => ({ id: x.id, name: `${x.code} — ${x.name}` })));
  readonly scopeData = computed<StockTakeScopeOptions>(() =>
    (this.scopeOptionsQuery.data() as ApiResponse<StockTakeScopeOptions> | undefined)?.resources ?? { zones: [], columns: [], lots: [] });

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

  readonly scopeTypeOptions: FilterSelectOption[] = [
    { id: 'ZONE', name: 'Theo khu' },
    { id: 'COLUMN', name: 'Theo cột/vị trí' },
    { id: 'LOT', name: 'Theo lô' },
    { id: 'WAREHOUSE', name: 'Toàn kho' },
  ];
  readonly pageSizeOptions: FilterSelectOption[] = [
    { id: 10, name: '10 / trang' }, { id: 20, name: '20 / trang' }, { id: 50, name: '50 / trang' },
  ];
  readonly qualityOptions: FilterSelectOption[] = [
    { id: 'PASS', name: 'Đạt' },
    { id: 'ISSUE_DETECTED', name: 'Có vấn đề' },
  ];
  readonly moldOptions: FilterSelectOption[] = [
    { id: 'Không', name: 'Mốc: Không' }, { id: 'Nhẹ', name: 'Mốc: Nhẹ' }, { id: 'Nặng', name: 'Mốc: Nặng' },
  ];
  readonly pestOptions: FilterSelectOption[] = [
    { id: 'Không', name: 'Mọt: Không' }, { id: 'Có dấu hiệu', name: 'Mọt: Có dấu hiệu' }, { id: 'Cần xử lý', name: 'Mọt: Cần xử lý' },
  ];
  readonly packagingOptions: FilterSelectOption[] = [
    { id: 'Nguyên', name: 'Bao bì: Nguyên' }, { id: 'Rách', name: 'Bao bì: Rách' }, { id: 'Ẩm', name: 'Bao bì: Ẩm' },
  ];

  /** Phiếu kiểm kê ô cách ly mới có lựa chọn "Rút về khu thường". */
  readonly dispositionOptions = computed<FilterSelectOption[]>(() => {
    const quarantineScope = this.detail()?.isQuarantineScope === true;
    return quarantineScope
      ? [
          { id: BAG_DISPOSITION.KEEP, name: 'Giữ trong khu cách ly' },
          { id: BAG_DISPOSITION.RELEASE, name: 'Đạt — rút về khu thường' },
          { id: BAG_DISPOSITION.DISPOSE, name: 'Bao hỏng — bỏ cả bao' },
        ]
      : [
          { id: BAG_DISPOSITION.KEEP, name: 'Giữ nguyên vị trí' },
          { id: BAG_DISPOSITION.QUARANTINE, name: 'Chuyển sang khu cách ly' },
          { id: BAG_DISPOSITION.DISPOSE, name: 'Bao hỏng — bỏ cả bao' },
        ];
  });

  readonly scopeValueOptions = computed<FilterSelectOption[]>(() => {
    const data = this.scopeData();
    switch (this.createForm().scopeType) {
      case 'ZONE':
        return data.zones.map(x => ({
          id: x.zoneName,
          name: `${x.isQuarantine ? '🚧 ' : ''}${x.zoneName} — ${x.columnCount} cột, ${x.bagCount} bao`,
        }));
      case 'COLUMN':
        return data.columns.map(x => ({
          id: x.locationId,
          name: `${x.isQuarantine ? '🚧 ' : ''}${x.zoneName} / ${x.locationCode || `#${x.locationId}`} — ${x.bagCount} bao`,
        }));
      case 'LOT':
        return data.lots.map(x => ({
          id: x.paddyLotId,
          name: `${x.lotCode} — ${x.bagCount} bao / ${x.columnCount} cột`,
        }));
      default:
        return [];
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
    this.isStatus(this.detail()?.stockTakeStatusCode, this.status.DRAFT) && this.perm.canUpdate('STOCKTAKE'));

  constructor() {
    effect(() => {
      const current = this.detail();
      if (!current || current.id !== this.selectedId()) return;
      this.countLines.set(current.stockTakeItems.map(item => this.toCountLine(item)));
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void { if (this.searchTimer) clearTimeout(this.searchTimer); }

  private toCountLine(item: StockTakeItem): CountLine {
    return {
      id: item.id,
      hasBags: (item.bags?.length ?? 0) > 0,
      actualQuantity: item.actualQuantity == null ? null : Number(item.actualQuantity),
      note: item.note || '',
      varianceReason: item.varianceReason || '',
      adjustedBagCount: item.adjustedBagCount ?? null,
      adjustedWeightKg: item.adjustedWeightKg == null ? null : Number(item.adjustedWeightKg),
      recountConfirmed: item.recountConfirmed,
      systemBagCount: item.systemBagCount ?? 0,
      systemQuantity: Number(item.systemQuantity || 0),
      bags: (item.bags || []).map(bag => this.toBagLine(bag)),
    };
  }

  private toBagLine(bag: StockTakeItemBag): CountBagLine {
    return {
      id: bag.id,
      paddyLotBagId: bag.paddyLotBagId,
      bagNo: bag.bagNo,
      qrCode: bag.qrCode ?? null,
      lotCode: bag.lotCode ?? null,
      systemWeightKg: Number(bag.systemWeightKg || 0),
      pickSequence: bag.pickSequence,
      restowSequence: bag.restowSequence,
      counted: bag.counted,
      scannedByQr: bag.scannedByQr,
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
  openDetail(id: number): void { this.selectedId.set(id); this.expandedItems.set(new Set()); this.scanMessage.set(''); }
  closeDetail(): void { if (!this.actionLoading()) this.selectedId.set(null); }

  // ── Tạo phiếu ──────────────────────────────────────────────────────────────
  openCreateForm(): void {
    this.createForm.set({ warehouseId: null, scopeType: 'COLUMN', scopeValue: null, note: '', quarantineOnly: false });
    this.scopeQrInput.set('');
    this.showCreate.set(true);
  }
  closeCreateForm(): void { if (!this.saving()) this.showCreate.set(false); }
  setCreateWarehouse(value: number | null): void { this.createForm.update(x => ({ ...x, warehouseId: value, scopeValue: null })); }
  setScopeType(value: StockTakeScopeType | null): void { this.createForm.update(x => ({ ...x, scopeType: value || 'COLUMN', scopeValue: null })); }
  setScopeValue(value: string | number | null): void { this.createForm.update(x => ({ ...x, scopeValue: value })); }
  setCreateNote(value: string): void { this.createForm.update(x => ({ ...x, note: value })); }
  toggleQuarantineOnly(value: boolean): void { this.createForm.update(x => ({ ...x, quarantineOnly: value, scopeValue: null })); }

  /** Quét (hoặc dán) QR dán trên cột/khu/lô để chọn phạm vi thay vì mò dropdown. */
  async resolveScopeQr(): Promise<void> {
    const code = this.scopeQrInput().trim();
    if (!code) return;
    const form = this.createForm();
    try {
      const response = await lastValueFrom(this.service.resolveScopeQr(code, form.warehouseId));
      const data = response.resources;
      if (!response.isSucceeded || !data?.matched) { this.alert(data?.message || 'Mã QR không khớp cột/khu hay lô nào.', false); return; }
      this.createForm.update(x => ({
        ...x,
        warehouseId: data.warehouseId ?? x.warehouseId,
        scopeType: (data.scopeType as StockTakeScopeType) || x.scopeType,
        scopeValue: data.scopeType === 'LOT' ? (data.paddyLotId ?? null) : (data.locationId ?? null),
        quarantineOnly: data.isQuarantine,
      }));
      this.scopeQrInput.set('');
      this.alert(`${data.message} (${data.bagCount} bao)`);
    } catch (error) { this.alert(this.errorText(error), false); }
  }

  async createStockTake(): Promise<void> {
    const form = this.createForm();
    if (!form.warehouseId) return this.alert('Vui lòng chọn kho.', false);
    if (form.scopeType !== 'WAREHOUSE' && (form.scopeValue == null || form.scopeValue === ''))
      return this.alert('Vui lòng chọn khu, cột hoặc lô cần kiểm kê.', false);
    const payload: CreateStockTakePayload = {
      warehouseId: form.warehouseId, stockTakeStatusId: 0, scopeType: form.scopeType,
      note: form.note.trim() || null, stockTakeItems: [],
      zoneName: form.scopeType === 'ZONE' ? String(form.scopeValue) : null,
      locationId: form.scopeType === 'COLUMN' ? Number(form.scopeValue) : null,
      paddyLotId: form.scopeType === 'LOT' ? Number(form.scopeValue) : null,
      productVariantId: null,
    };
    this.saving.set(true);
    try {
      const response = await lastValueFrom(this.service.create(payload));
      if (!response.isSucceeded) throw new Error(response.message);
      this.showCreate.set(false);
      await this.refresh();
      this.alert(response.message || 'Đã tạo phiếu và chụp danh sách bao trong phạm vi.');
    } catch (error) { this.alert(this.errorText(error), false); }
    finally { this.saving.set(false); }
  }

  // ── Kiểm đếm theo bao ──────────────────────────────────────────────────────
  lineFor(item: StockTakeItem): CountLine | undefined { return this.countLines().find(x => x.id === item.id); }

  isExpanded(itemId: number): boolean { return this.expandedItems().has(itemId); }
  toggleExpand(itemId: number): void {
    this.expandedItems.update(set => {
      const next = new Set(set);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  updateLine(itemId: number, field: keyof CountLine, value: unknown): void {
    this.countLines.update(lines => lines.map(line => line.id !== itemId ? line : {
      ...line,
      [field]: (field === 'actualQuantity' || field === 'adjustedWeightKg' || field === 'adjustedBagCount')
        ? (value === '' || value == null ? null : Number(value))
        : value,
    }));
  }

  updateBag(itemId: number, bagId: number, field: keyof CountBagLine, value: unknown): void {
    this.countLines.update(lines => lines.map(line => line.id !== itemId ? line : {
      ...line,
      bags: line.bags.map(bag => {
        if (bag.id !== bagId) return bag;
        const next: CountBagLine = {
          ...bag,
          [field]: field === 'countedWeightKg'
            ? (value === '' || value == null ? null : Number(value))
            : value,
        } as CountBagLine;
        // Chọn cách xử lý nghĩa là đã cầm bao trên tay → tự tick "tìm thấy".
        if (field === 'disposition' && next.disposition !== BAG_DISPOSITION.KEEP) next.counted = true;
        // Đổi cách xử lý thì vị trí đích cũ không còn hợp lệ (ô cách ly vs cột thường).
        if (field === 'disposition' && next.disposition !== bag.disposition) next.targetLocationId = null;
        return next;
      }),
    }));
    if (field === 'disposition' && (value === BAG_DISPOSITION.QUARANTINE || value === BAG_DISPOSITION.RELEASE)) {
      void this.loadBagTargets(bagId);
    }
  }

  /** Số bao tìm thấy của dòng (đã tính chỉnh lý nếu thủ kho chốt lại). */
  countedBagsOf(line?: CountLine): number | null {
    if (!line) return null;
    if (!line.hasBags) return null;
    if (line.adjustedBagCount != null) return line.adjustedBagCount;
    if (!line.bags.some(x => x.counted || x.countedWeightKg != null || x.isUnexpected)) return null;
    return line.bags.filter(x => x.counted).length;
  }

  /** Tổng kg tìm thấy của dòng — bao không cân thì giữ kg sổ sách. */
  foundKgOf(line?: CountLine): number | null {
    if (!line) return null;
    if (!line.hasBags) return line.actualQuantity;
    if (line.adjustedWeightKg != null) return line.adjustedWeightKg;
    if (!line.bags.some(x => x.counted || x.countedWeightKg != null || x.isUnexpected)) return null;
    return line.bags.filter(x => x.counted).reduce((sum, x) => sum + (x.countedWeightKg ?? x.systemWeightKg), 0);
  }

  bagDiffOf(line?: CountLine): number | null {
    const counted = this.countedBagsOf(line);
    return counted == null || !line ? null : counted - line.systemBagCount;
  }

  kgDiffOf(line?: CountLine): number | null {
    const found = this.foundKgOf(line);
    return found == null || !line ? null : found - line.systemQuantity;
  }

  dispositionCount(line: CountLine | undefined, value: BagDisposition): number {
    return line ? line.bags.filter(x => x.disposition === value).length : 0;
  }

  /** Lệch SỐ BAO luôn là LARGE — mất nguyên một bao là sự cố an ninh kho, không phải sai số cân. */
  lineSeverity(item: StockTakeItem): string {
    const line = this.lineFor(item);
    const bagDiff = this.bagDiffOf(line);
    if (bagDiff != null && bagDiff !== 0) return 'LARGE';
    const kgDiff = this.kgDiffOf(line);
    if (kgDiff == null) return 'NONE';
    const abs = Math.abs(kgDiff);
    if (abs === 0) return 'NONE';
    const system = Number(item.systemQuantity) || 0;
    const pct = system === 0 ? Number.POSITIVE_INFINITY : (abs / Math.abs(system)) * 100;
    const t = this.thresholds();
    if (pct > t.mediumVariancePercent || abs > t.mediumVarianceKg) return 'LARGE';
    if (pct > t.smallVariancePercent || abs > t.smallVarianceKg) return 'MEDIUM';
    return 'SMALL';
  }

  hasVariance(item: StockTakeItem): boolean {
    const line = this.lineFor(item);
    const bagDiff = this.bagDiffOf(line);
    const kgDiff = this.kgDiffOf(line);
    return (bagDiff != null && bagDiff !== 0) || (kgDiff != null && Math.abs(kgDiff) > 0.001);
  }

  // ── Quét QR bao ────────────────────────────────────────────────────────────
  async scanBag(): Promise<void> {
    const current = this.detail();
    const code = this.scanInput().trim();
    if (!current || !code) return;
    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(this.service.scanBag(current.id, {
        qrCode: code,
        countedWeightKg: this.scanWeight(),
      }));
      const data = response.resources;
      this.scanMessage.set(data?.message || response.message || '');
      if (data?.matched && data.stockTakeItemId) this.toggleExpandOn(data.stockTakeItemId);
      this.scanInput.set('');
      this.scanWeight.set(null);
      await this.refreshDetail(current.id);
    } catch (error) { this.alert(this.errorText(error), false); }
    finally { this.actionLoading.set(false); }
  }

  private toggleExpandOn(itemId: number): void {
    this.expandedItems.update(set => new Set(set).add(itemId));
  }

  // ── Gợi ý vị trí đích ──────────────────────────────────────────────────────
  async loadBagTargets(bagId: number): Promise<void> {
    const current = this.detail();
    if (!current || this.bagTargets()[bagId]) return;
    try {
      const response = await lastValueFrom(this.service.getBagTargetSuggestions(current.id, bagId));
      this.bagTargets.update(map => ({ ...map, [bagId]: response.resources ?? [] }));
    } catch { this.bagTargets.update(map => ({ ...map, [bagId]: [] })); }
  }

  bagTargetOptions(bagId: number): FilterSelectOption[] {
    return (this.bagTargets()[bagId] ?? []).map(x => ({
      id: x.locationId,
      name: `${x.isRecommended ? '★ ' : ''}${x.zoneName} / ${x.locationCode || `#${x.locationId}`} — ${x.reason}`,
    }));
  }

  needsTarget(bag: CountBagLine): boolean {
    return bag.disposition === BAG_DISPOSITION.QUARANTINE || bag.disposition === BAG_DISPOSITION.RELEASE;
  }

  // ── Lưu / gửi duyệt ────────────────────────────────────────────────────────
  async saveCounts(showSuccess = true): Promise<boolean> {
    const current = this.detail();
    if (!current) return false;
    if (this.countLines().some(line => line.bags.some(bag => bag.countedWeightKg != null && bag.countedWeightKg < 0))) {
      this.alert('Khối lượng cân của bao không được âm.', false); return false;
    }
    this.actionLoading.set(true);
    try {
      const response = await lastValueFrom(this.service.saveCounts(current.id, {
        note: current.note || null,
        items: this.countLines().map(line => ({
          id: line.id,
          actualQuantity: line.hasBags ? null : line.actualQuantity,
          note: line.note.trim() || null,
          varianceReason: line.varianceReason.trim() || null,
          adjustedBagCount: line.adjustedBagCount,
          adjustedWeightKg: line.adjustedWeightKg,
          recountConfirmed: line.recountConfirmed,
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

    const untouched = this.countLines().find(line =>
      line.hasBags ? this.countedBagsOf(line) == null : line.actualQuantity == null);
    if (untouched) return this.alert('Còn dòng chưa kiểm bao nào. Vui lòng kiểm đủ trước khi gửi duyệt.', false);

    const missingReason = current.stockTakeItems.find(item =>
      this.hasVariance(item) && !this.lineFor(item)?.varianceReason.trim());
    if (missingReason) return this.alert('Dòng có chênh lệch bao hoặc kg phải nêu lý do.', false);

    const missingRecount = current.stockTakeItems.find(item =>
      this.lineSeverity(item) === 'LARGE' && !this.lineFor(item)?.recountConfirmed);
    if (missingRecount) return this.alert('Dòng chênh lệch LARGE phải xác nhận đã kiểm đếm lại.', false);

    const missingTarget = this.countLines()
      .flatMap(line => line.bags)
      .find(bag => this.needsTarget(bag) && bag.targetLocationId == null);
    if (missingTarget) return this.alert(`Bao #${missingTarget.bagNo} chưa chọn vị trí đích.`, false);

    const missingDisposeNote = this.countLines()
      .flatMap(line => line.bags)
      .find(bag => bag.disposition === BAG_DISPOSITION.DISPOSE && !bag.dispositionNote.trim());
    if (missingDisposeNote) return this.alert(`Bao #${missingDisposeNote.bagNo} bị bỏ vì hỏng — phải ghi rõ lý do.`, false);

    const confirmed = await Swal.fire({
      title: 'Gửi phiếu để duyệt?',
      text: 'Sau khi gửi, kết quả kiểm đếm theo bao sẽ bị khóa.',
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
  dispositionLabel(value?: string | null): string {
    switch (value) {
      case BAG_DISPOSITION.QUARANTINE: return 'Cách ly';
      case BAG_DISPOSITION.DISPOSE: return 'Bỏ bao hỏng';
      case BAG_DISPOSITION.RELEASE: return 'Rút về khu thường';
      default: return 'Giữ nguyên';
    }
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
