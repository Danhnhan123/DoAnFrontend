import { Component, signal, inject, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';

import {
  QualityInspectionRow,
  QualityInspectionDetailDto,
  CreateQualityInspectionDto,
  UpdateQualityInspectionDto,
  PaddyLotRow,
  QualityInspectionBagDisposition,
  BagQualityResult,
  QualityInspectionBagProgressDto,
  QualityInspectionBagResultDto,
  SaveBagInspectionResultDto,
  MoistureConfigDto,
} from '../../models';
import { QualityInspectionService } from '../../services/quality-inspection.service';
import { PaddyLotService } from '../../services/paddy-lot.service';
import { AuthService } from '../../services/auth.service';
import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

interface QcForm {
  paddyLotId: number | null;
  inspectorId: number | null;
  inspectedAt: string;
  moisturePercent: number | null;
  impurityPercent: number | null;
  moldLevel: string | null;
  pestLevel: string | null;
  packagingStatus: string | null;
  passedInspection: boolean;
  handling: string | null;
  note: string;
  affectedWeightKg: number | null;
  affectedBagIds: number[];
}

interface BagQcForm {
  moisturePercent: number | null;
  impurityPercent: number | null;
  moldLevel: string | null;
  pestLevel: string | null;
  packagingStatus: string | null;
  qualityResult: BagQualityResult;
  disposition: QualityInspectionBagDisposition;
  handling: string | null;
  note: string;
}

/**
 * Quản lý chất lượng & cách ly lô (khớp thiết kế Figma "Chất lượng & cách ly").
 * Nối đủ 7 API QualityInspection: paged, GET all, GET {id}, by-lot, POST, PUT, DELETE.
 */
@Component({
  selector: 'app-quality-inspection',
  standalone: true,
  imports: [HasPermissionDirective, ReadonlyIfDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './quality-inspection.component.html',
  styleUrls: [
    '../supplier/supplier.component.css',
    './quality-inspection.component.css',
  ],
})
export class QualityInspectionComponent {
  private qcService = inject(QualityInspectionService);
  private paddyLotService = inject(PaddyLotService);
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private queryClient = injectQueryClient();

  // ----- Danh mục (đúng vocab entity backend) -----
  readonly moldOptions = this.opt(['Không', 'Nhẹ', 'Nặng']);
  readonly pestOptions = this.opt(['Không', 'Có dấu hiệu', 'Cần xử lý']);
  readonly packagingOptions = this.opt(['Nguyên', 'Rách', 'Ẩm']);
  readonly handlingOptions = this.opt([
    'Phơi',
    'Sấy',
    'Đảo kho',
    'Cách ly',
    'Bán nhanh',
  ]);
  readonly resultFilterOptions = [
    { id: true, name: 'Đạt' },
    { id: false, name: 'Cách ly / Không đạt' },
  ];
  readonly pageSizeOptions = [
    { id: 10, name: '10 / trang' },
    { id: 20, name: '20 / trang' },
    { id: 50, name: '50 / trang' },
  ];

  // ----- Bảng -----
  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('inspectedAt');
  sortDir = signal<'asc' | 'desc'>('desc');
  filterPassed = signal<boolean | null>(null);

  selectedId = signal<number | null>(null);

  // ----- Modal -----
  showModal = signal(false);
  showBagModal = signal(false);
  bagProgress = signal<QualityInspectionBagProgressDto | null>(null);
  bagProgressLoading = signal(false);
  selectedBagId = signal<number | null>(null);
  savingBagId = signal<number | null>(null);
  completingBagInspection = signal(false);
  completeNote = signal('');
  bagSaveMessage = signal('');
  bagForm = signal<BagQcForm>(this.blankBagForm());
  // Chế độ KIỂM TRA LẠI lô đang cách ly (khác luồng kiểm định lần đầu).
  recheckMode = signal(false);
  editItem = signal<QualityInspectionRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEdit() && !this.perm.canUpdate('QUALITY_INSPECTIONS'));
  bagReadOnly = computed(
    () => !!this.bagProgress()?.isCompleted || !this.perm.canUpdate('QUALITY_INSPECTIONS')
  );
  form = signal<QcForm>(this.blankForm());

  private readonly colMap: Record<string, number> = {
    lotCode: 0,
    inspectorName: 1,
    inspectedAt: 2,
    moisturePercent: 3,
    impurityPercent: 4,
    moldLevel: 5,
    pestLevel: 6,
    packagingStatus: 7,
    passedInspection: 8,
    handling: 9,
    id: 10,
  };

  // ================= Queries =================
  listQuery = injectQuery(() => ({
    queryKey: [
      'quality-inspections',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterPassed(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.qcService.getPagedAdvanced(
          this.qcService.buildPagedBody({
            page: this.page(),
            pageSize: this.pageSize(),
            search: this.search(),
            sortField: this.sortField(),
            sortDir: this.sortDir(),
            colMap: this.colMap,
            filterPassed: this.filterPassed(),
          })
        )
      ),
  }));

  // Danh sách toàn bộ lô (chỉ dùng để hiển thị loại hàng/vị trí/tồn ở bảng & chi tiết
  // cho các phiếu kiểm định đã tạo — kể cả lô đã nhập kho).
  lotsQuery = injectQuery(() => ({
    queryKey: ['qc-lot-options'],
    queryFn: () =>
      lastValueFrom(
        this.paddyLotService.getPagedAdvanced(
          this.paddyLotService.buildPagedBody({
            page: 1,
            pageSize: 1000,
            sortField: 'lotCode',
            sortDir: 'asc',
          })
        )
      ),
  }));

  // Ô "Chọn lô kiểm tra" chỉ đưa ra các lô đang CHỜ KIỂM ĐỊNH (status AWAITING_QC) — đúng
  // luồng chính: tạo phiếu mua lúa → duyệt tạo lô (trạng thái Chờ kiểm định) → kiểm tra chất
  // lượng → mới hiện ở màn Nhập kho. Trọng lượng lấy ở initialWeightKg (lô chưa nhập kho nên
  // remainingWeightKg = 0). Nguồn: GET /paddy-lots/awaiting-qc.
  pendingLotsQuery = injectQuery(() => ({
    queryKey: ['qc-awaiting-qc-lots'],
    queryFn: () => lastValueFrom(this.paddyLotService.getAwaitingQc()),
  }));

  // Lô đang CÁCH LY (QUARANTINE) — nguồn ô chọn lô khi KIỂM TRA LẠI chất lượng.
  // Nguồn: GET /paddy-lots/quarantined.
  quarantinedLotsQuery = injectQuery(() => ({
    queryKey: ['qc-quarantined-lots'],
    queryFn: () => lastValueFrom(this.paddyLotService.getQuarantined()),
  }));

  historyQuery = injectQuery(() => ({
    queryKey: ['qc-history', this.historyLotId()],
    enabled: this.historyLotId() != null,
    queryFn: () => lastValueFrom(this.qcService.getByLot(this.historyLotId()!)),
  }));

  moistureConfigQuery = injectQuery(() => ({
    queryKey: ['quality-inspections', 'moisture-config'],
    queryFn: () => lastValueFrom(this.qcService.getMoistureConfig()),
    staleTime: 5 * 60 * 1000,
  }));

  moistureConfig = computed<MoistureConfigDto | null>(() => {
    const response = this.moistureConfigQuery.data() as any;
    return (response?.resources ?? response?.data ?? null) as MoistureConfigDto | null;
  });

  detailQuery = injectQuery(() => ({
    queryKey: ['quality-inspection-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () => lastValueFrom(this.qcService.getById(this.editItem()!.id)),
  }));

  // ================= Derived =================
  private inspectionRows = computed<QualityInspectionRow[]>(() => this.unwrapDT(this.listQuery.data()));
  rows = computed<QualityInspectionRow[]>(() =>
    this.inspectionRows().flatMap((row) => {
      if (!this.wasSplit(row)) return [row];
      const child = this.findSplitChild(row);
      if (!child) return [row];

      const parent = this.lotInfo(row.paddyLotId);
      const quarantineWeight = Math.max(0, Number(row.affectedWeightKg ?? 0));
      const currentParentWeight = Math.max(0, Number(this.lotBasisWeight(parent) ?? 0));
      const splitTotalWeight = Math.max(
        Number(parent?.initialWeightKg ?? 0),
        currentParentWeight + quarantineWeight
      );
      // Khối lượng đạt là kết quả lịch sử tại thời điểm tách, không phụ thuộc
      // tồn hiện tại của lô cha sau các lần nhập/xuất kho về sau.
      const passedWeight = Math.max(0, splitTotalWeight - quarantineWeight);

      const passedPart: QualityInspectionRow = {
        ...row,
        passedInspection: true,
        affectedWeightKg: null,
        displayWeightKg: passedWeight,
        displayTotalWeightKg: splitTotalWeight,
        displayRole: 'splitPassed' as const,
        sourceInspectionId: row.id,
      };

      // Khi lô con đã được tái kiểm tra, phiếu tái kiểm tra thật của chính lô
      // -Q sẽ chịu trách nhiệm hiển thị kết quả. Luôn giữ lại dòng phần đạt của
      // phiếu tách gốc, nhưng không dựng thêm một dòng cách ly ảo đã lỗi thời.
      const childHasInspection = this.inspectionRows().some(
        (inspection) => inspection.paddyLotId === child.id
      );
      const childStillQuarantined = this.quarantinedLots().some(
        (lot) => lot.id === child.id
      );
      if (childHasInspection || !childStillQuarantined) return [passedPart];

      return [
        passedPart,
        {
          ...row,
          id: -row.id,
          paddyLotId: child.id,
          lotCode: child.lotCode,
          lotStatusCode: child.statusCode,
          passedInspection: false,
          affectedWeightKg: null,
          displayWeightKg: quarantineWeight,
          displayTotalWeightKg: splitTotalWeight,
          displayRole: 'splitQuarantine' as const,
          sourceInspectionId: row.id,
        },
      ];
    })
  );
  totalRecords = computed<number>(() => this.unwrapTotal(this.listQuery.data()));
  lotList = computed<PaddyLotRow[]>(() => this.unwrapDT(this.lotsQuery.data()));

  /**
   * Danh sách lô đang CHỜ KIỂM ĐỊNH (AWAITING_QC) — đã là PaddyLotRow đầy đủ:
   * initialWeightKg (trọng lượng lô để kiểm định), productVariantName, warehouseName...
   * Lô chưa nhập kho nên remainingWeightKg = 0 → hiển thị/validate lấy theo initialWeightKg.
   */
  pendingLots = computed<PaddyLotRow[]>(() => {
    const res: any = this.pendingLotsQuery.data();
    const d = res?.resources ?? res?.data;
    return Array.isArray(d) ? d : [];
  });

  /** Lô đang CÁCH LY — nguồn ô chọn lô khi kiểm tra lại. */
  quarantinedLots = computed<PaddyLotRow[]>(() => {
    const res: any = this.quarantinedLotsQuery.data();
    const d = res?.resources ?? res?.data;
    return Array.isArray(d) ? d : [];
  });

  /** Trọng lượng lô để hiển thị/validate: đã nhập kho dùng tồn còn lại, chưa nhập dùng trọng lượng ban đầu. */
  private lotBasisWeight(lot: PaddyLotRow | null | undefined): number | null {
    if (!lot) return null;
    return (lot.remainingWeightKg ?? 0) > 0
      ? lot.remainingWeightKg
      : lot.initialWeightKg ?? null;
  }

  /** Trọng lượng của lô đang chọn trong form (dùng cho ô "Tổng tồn" và validate kg ảnh hưởng). */
  formLotWeight = computed<number | null>(() => this.lotBasisWeight(this.formLot()));

  // lotMap ưu tiên dữ liệu lô đầy đủ (đã tồn kho) để hiển thị bảng/chi tiết; bổ sung
  // fallback từ lô chưa nhập kho để formLot tự điền được khi tạo phiếu trong luồng chính.
  lotMap = computed<Map<number, PaddyLotRow>>(() => {
    const m = new Map<number, PaddyLotRow>();
    for (const l of this.lotList()) m.set(l.id, l);
    for (const p of this.pendingLots()) m.set(p.id, { ...m.get(p.id), ...p });
    for (const q of this.quarantinedLots()) if (!m.has(q.id)) m.set(q.id, q);
    return m;
  });

  // Ô chọn lô chỉ liệt kê lô chưa nhập kho. Khi đang SỬA phiếu của một lô đã nhập kho
  // (không còn trong danh sách chờ), vẫn thêm lô đang chọn vào để hiển thị đúng.
  lotOptions = computed(() => {
    const toOpt = (x: PaddyLotRow) => ({
      id: x.id,
      name: `${x.lotCode}${x.productVariantName ? ' · ' + x.productVariantName : ''}`,
    });
    // Kiểm tra lại: chọn từ lô đang CÁCH LY; kiểm định lần đầu: chọn từ lô CHỜ KIỂM ĐỊNH.
    const base = this.recheckMode() ? this.quarantinedLots() : this.pendingLots();
    const opts = base.map(toOpt);
    const curId = this.form().paddyLotId;
    if (curId != null && !opts.some((o) => o.id === Number(curId))) {
      const lot = this.lotMap().get(Number(curId));
      if (lot) opts.unshift(toOpt(lot));
    }
    return opts;
  });

  inspectorDisplayName(): string {
    return this.viewOnly()
      ? this.editItem()?.inspectorName || '—'
      : this.auth.currentUser()?.fullName || 'Người đang đăng nhập';
  }

  historyRows = computed<QualityInspectionRow[]>(() => {
    const res = this.historyQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return Array.isArray(r) ? r : r?.data ?? [];
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());
  saving = computed(
    () =>
      this.createMutation.isPending() ||
      this.updateMutation.isPending() ||
      this.recheckMutation.isPending()
  );

  selectedRow = computed<QualityInspectionRow | null>(
    () => this.rows().find((r) => r.id === this.selectedId()) ?? null
  );
  historyLotId = computed<number | null>(
    () => this.selectedRow()?.paddyLotId ?? null
  );

  // KPI (đồng bộ bộ lọc/trang hiện tại). Phiếu nháp (chờ kiểm định) không tính vào Đạt/Cách ly.
  kpiTotal = computed(() => this.totalRecords());
  kpiDraft = computed(() => this.rows().filter((r) => this.isDraft(r)).length);
  kpiQuarantine = computed(
    () => this.rows().filter((r) => !this.isDraft(r) && !r.passedInspection).length
  );
  kpiPassed = computed(
    () => this.rows().filter((r) => !this.isDraft(r) && r.passedInspection).length
  );
  kpiHandling = computed(
    () =>
      this.rows().filter(
        (r) => r.handling && ['Phơi', 'Sấy', 'Đảo kho'].includes(r.handling)
      ).length
  );

  // Lô đang chọn trong form (auto-fill loại hàng / vị trí / tổng tồn)
  formLot = computed<PaddyLotRow | null>(() => {
    const id = this.form().paddyLotId;
    return id != null ? this.lotMap().get(Number(id)) ?? null : null;
  });

  eligibleBags = computed(() => this.formLot()?.bags ?? []);
  selectedBags = computed(() => {
    const ids = new Set(this.form().affectedBagIds);
    return this.eligibleBags().filter((bag) => ids.has(bag.id));
  });
  selectedBagWeightKg = computed(() =>
    this.selectedBags().reduce((sum, bag) => sum + Number(bag.weightKg), 0)
  );
  remainingBagWeightKg = computed(() =>
    Math.max(0, this.eligibleBags().reduce((sum, bag) => sum + Number(bag.weightKg), 0) - this.selectedBagWeightKg())
  );

  selectedBag = computed<QualityInspectionBagResultDto | null>(() => {
    const id = this.selectedBagId();
    return this.bagProgress()?.items.find((bag) => bag.bagId === id) ?? null;
  });
  bagProgressPercent = computed(() => {
    const progress = this.bagProgress();
    if (!progress?.totalBags) return 0;
    return Math.round((progress.inspectedBags / progress.totalBags) * 100);
  });
  acceptedBagCount = computed(() => {
    const progress = this.bagProgress();
    return progress ? progress.normalBags + progress.quarantineBags : 0;
  });
  bagDispositionOptions = computed<{ id: QualityInspectionBagDisposition; name: string }[]>(() => {
    const type = this.bagProgress()?.inspectionType ?? null;
    const isPass = this.bagForm().qualityResult === 'PASS';
    if (isPass) {
      switch (type) {
        case 'STORAGE':
          return [{ id: 'KEEP_STORED', name: 'Giữ nguyên trong kho' }];
        case 'RECHECK':
        case 'OUTBOUND_EXCEPTION':
          return [{ id: 'RELEASE', name: 'Giải phóng / cho phép xuất' }];
        case 'RECEIVING':
        default:
          return [{ id: 'ACCEPT_NORMAL', name: 'Chấp nhận nhập kho thường' }];
      }
    }
    switch (type) {
      case 'STORAGE':
      case 'OUTBOUND_EXCEPTION':
        return [{ id: 'QUARANTINE', name: 'Chuyển bao sang cách ly' }];
      case 'RECHECK':
        return [{ id: 'KEEP_QUARANTINE', name: 'Tiếp tục giữ cách ly' }];
      case 'RECEIVING':
      default:
        return [
          { id: 'ACCEPT_QUARANTINE', name: 'Chấp nhận nhưng cách ly' },
          { id: 'REJECT_RETURN', name: 'Từ chối và trả nhà cung cấp' },
        ];
    }
  });

  // ================= Effects =================
  private autoSelect = effect(() => {
    const rs = this.rows();
    const cur = this.selectedId();
    if (rs.length && !rs.some((r) => r.id === cur)) {
      this.selectedId.set(rs[0].id);
    } else if (!rs.length && cur != null) {
      this.selectedId.set(null);
    }
  });

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;
    const detail: QualityInspectionDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;
    this.form.set(this.rowToForm(detail));
  });

  // ================= Mutations =================
  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateQualityInspectionDto) =>
      lastValueFrom(this.qcService.create(payload)),
    onSuccess: (res: any) =>
      this.afterWrite(res, 'Tạo phiếu kiểm định thành công!'),
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateQualityInspectionDto) =>
      lastValueFrom(this.qcService.update(payload)),
    onSuccess: (res: any) =>
      this.afterWrite(res, 'Cập nhật phiếu kiểm định thành công!'),
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  recheckMutation = injectMutation(() => ({
    mutationFn: (payload: CreateQualityInspectionDto) =>
      lastValueFrom(this.qcService.recheck(payload)),
    onSuccess: (res: any, vars: CreateQualityInspectionDto) =>
      this.afterRecheck(res, vars.passedInspection),
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.qcService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
        this.showAlert('Đã xóa phiếu kiểm định!');
      } else {
        this.showAlert(res.message || 'Xóa thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi xóa', false),
  }));

  // ================= UI actions =================
  selectRow(row: QualityInspectionRow): void {
    this.selectedId.set(row.id);
  }
  onSearch(): void {
    this.page.set(1);
  }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRecords() / this.pageSize()));
  }
  visiblePages(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const pages: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++)
      pages.push(i);
    return pages;
  }

  async openBagInspection(row: QualityInspectionRow): Promise<void> {
    const inspectionId = row.sourceInspectionId ?? row.id;
    if (inspectionId <= 0) return;

    this.showBagModal.set(true);
    this.bagProgress.set(null);
    this.selectedBagId.set(null);
    this.completeNote.set('');
    this.bagSaveMessage.set('');
    await this.loadBagProgress(inspectionId);
  }

  closeBagModal(): void {
    if (this.savingBagId() != null || this.completingBagInspection()) return;
    this.showBagModal.set(false);
    this.bagProgress.set(null);
    this.selectedBagId.set(null);
    this.bagSaveMessage.set('');
  }

  selectBagForInspection(bag: QualityInspectionBagResultDto): void {
    this.selectedBagId.set(bag.bagId);
    this.bagForm.set(this.bagToForm(bag));
    this.bagSaveMessage.set('');
  }

  setBagField(field: keyof BagQcForm, value: unknown): void {
    this.bagForm.update((current) => ({ ...current, [field]: value } as BagQcForm));
    this.bagSaveMessage.set('');
  }

  setBagQualityResult(result: BagQualityResult): void {
    const disposition = this.defaultDisposition(
      this.bagProgress()?.inspectionType ?? null,
      result
    );
    this.bagForm.update((current) => ({
      ...current,
      qualityResult: result,
      disposition,
    }));
    this.bagSaveMessage.set('');
  }

  async saveCurrentBag(goToNext = false): Promise<void> {
    const progress = this.bagProgress();
    const bag = this.selectedBag();
    if (!progress || !bag || this.bagReadOnly()) return;

    const form = this.bagForm();
    const moisture = this.num(form.moisturePercent);
    const impurity = this.num(form.impurityPercent);
    if ((moisture != null && (moisture < 0 || moisture > 100)) ||
        (impurity != null && (impurity < 0 || impurity > 100))) {
      this.showAlert('Độ ẩm và tạp chất phải nằm trong khoảng 0–100%.', false);
      return;
    }

    const payload: SaveBagInspectionResultDto = {
      bagId: bag.bagId,
      moisturePercent: moisture,
      impurityPercent: impurity,
      moldLevel: form.moldLevel || null,
      pestLevel: form.pestLevel || null,
      packagingStatus: form.packagingStatus || null,
      qualityResult: form.qualityResult,
      disposition: form.disposition,
      handling: form.handling || null,
      note: form.note.trim() || null,
    };

    if (progress.inspectionType === 'RECEIVING' &&
        payload.disposition === 'REJECT_RETURN' && !payload.note) {
      this.showAlert('Vui lòng nhập lý do trả nhà cung cấp cho bao bị từ chối.', false);
      return;
    }

    this.savingBagId.set(bag.bagId);
    this.bagSaveMessage.set('');
    try {
      const response = await lastValueFrom(
        this.qcService.saveBagResult(progress.inspectionId, bag.bagId, payload)
      );
      if (!response.isSucceeded) {
        this.showAlert(response.message || 'Không thể lưu kết quả bao.', false);
        return;
      }

      await this.loadBagProgress(progress.inspectionId, bag.bagId, goToNext);
      this.bagSaveMessage.set(response.message || `Đã lưu kết quả bao #${bag.bagNo}.`);
    } catch (error: any) {
      this.showAlert(error?.error?.message || 'Không thể lưu kết quả bao.', false);
    } finally {
      this.savingBagId.set(null);
    }
  }

  async completeBagSession(): Promise<void> {
    const progress = this.bagProgress();
    if (!progress || progress.isCompleted || progress.remainingBags > 0) return;

    const isReceiving = progress.inspectionType === 'RECEIVING';
    const confirmation = await Swal.fire({
      title: 'Hoàn tất phiếu kiểm tra?',
      html: isReceiving
        ? `Hệ thống sẽ nhận mua <b>${this.acceptedBagCount()} bao</b> ` +
          `(${progress.normalBags} thường, ${progress.quarantineBags} cách ly) và trả ` +
          `<b>${progress.rejectedBags} bao</b> cho nhà cung cấp.<br><small>Bao bị trả sẽ không được tạo nhập kho hoặc tăng tồn.</small>`
        : 'Hệ thống sẽ chốt kết quả và áp dụng hướng xử lý của từng bao. Sau đó không thể sửa kết quả bao.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Hoàn tất',
      cancelButtonText: 'Kiểm tra lại',
      confirmButtonColor: '#15803d',
    });
    if (!confirmation.isConfirmed) return;

    this.completingBagInspection.set(true);
    try {
      const response = await lastValueFrom(
        this.qcService.complete(progress.inspectionId, {
          note: this.completeNote().trim() || null,
        })
      );
      if (!response.isSucceeded) {
        this.showAlert(response.message || 'Không thể hoàn tất phiếu kiểm tra.', false);
        return;
      }

      await this.loadBagProgress(progress.inspectionId, this.selectedBagId());
      this.queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
      this.queryClient.invalidateQueries({ queryKey: ['quality-inspection-detail'] });
      this.queryClient.invalidateQueries({ queryKey: ['qc-history'] });
      this.queryClient.invalidateQueries({ queryKey: ['qc-awaiting-qc-lots'] });
      this.queryClient.invalidateQueries({ queryKey: ['qc-quarantined-lots'] });
      this.showAlert(response.message || 'Đã hoàn tất phiếu kiểm tra cấp bao.');
    } catch (error: any) {
      this.showAlert(error?.error?.message || 'Không thể hoàn tất phiếu kiểm tra.', false);
    } finally {
      this.completingBagInspection.set(false);
    }
  }

  inspectionTypeText(type?: string | null): string {
    switch ((type ?? '').toUpperCase()) {
      case 'RECEIVING': return 'Kiểm tra khi nhận hàng';
      case 'STORAGE': return 'Kiểm tra định kỳ trong kho';
      case 'RECHECK': return 'Tái kiểm tra hàng cách ly';
      case 'OUTBOUND_EXCEPTION': return 'Kiểm tra ngoại lệ khi xuất';
      default: return 'Phiếu dữ liệu cũ';
    }
  }

  dispositionText(value?: string | null): string {
    const labels: Record<string, string> = {
      ACCEPT_NORMAL: 'Nhập kho thường',
      ACCEPT_QUARANTINE: 'Chấp nhận & cách ly',
      REJECT_RETURN: 'Trả nhà cung cấp',
      KEEP_STORED: 'Giữ nguyên trong kho',
      QUARANTINE: 'Chuyển cách ly',
      RELEASE: 'Giải phóng',
      KEEP_QUARANTINE: 'Tiếp tục cách ly',
    };
    return value ? labels[value] ?? value : 'Chưa có quyết định';
  }

  private async loadBagProgress(
    inspectionId: number,
    preferredBagId: number | null = null,
    advance = false
  ): Promise<void> {
    this.bagProgressLoading.set(true);
    try {
      const response = await lastValueFrom(this.qcService.getBagProgress(inspectionId));
      if (!response.isSucceeded || !response.resources) {
        this.showAlert(response.message || 'Không thể tải danh sách bao.', false);
        this.closeBagModal();
        return;
      }

      const progress = response.resources;
      this.bagProgress.set(progress);
      let next: QualityInspectionBagResultDto | undefined;
      if (advance) {
        next = progress.items.find(
          (item) => item.bagId !== preferredBagId && !item.qualityResult
        );
      }
      next ??= progress.items.find((item) => item.bagId === preferredBagId);
      next ??= progress.items.find((item) => !item.qualityResult);
      next ??= progress.items[0];
      if (next) this.selectBagForInspection(next);
    } catch (error: any) {
      this.showAlert(error?.error?.message || 'Không thể tải danh sách bao của phiếu.', false);
      this.showBagModal.set(false);
    } finally {
      this.bagProgressLoading.set(false);
    }
  }

  openCreate(): void {
    this.recheckMode.set(false);
    this.editItem.set(null);
    this.form.set(this.blankForm());
    this.showModal.set(true);
  }

  /** Mở modal KIỂM TRA LẠI cho lô đang cách ly (nguồn lô = danh sách QUARANTINE). */
  openRecheck(): void {
    this.recheckMode.set(true);
    this.editItem.set(null);
    this.form.set(this.blankForm());
    this.showModal.set(true);
  }

  async openEditSelected(): Promise<void> {
    const row = this.selectedRow();
    if (!row) return;

    // New sessions are edited exclusively through bag autosave + Complete.
    // The aggregate Create/Update form remains available for legacy records.
    if (row.inspectionType) {
      await this.openBagInspection(row);
      return;
    }

    if (row.displayRole === 'splitPassed') {
      this.showAlert('Đây là phần lô đã đạt sơ bộ sau khi tách. Hãy chọn dòng lô -Q để kiểm tra lại phần đang cách ly.');
      return;
    }

    if (row.displayRole === 'splitQuarantine') {
      this.recheckMode.set(true);
      this.editItem.set(null);
      this.form.set({
        ...this.rowToForm(row),
        passedInspection: false,
        affectedWeightKg: null,
        affectedBagIds: [],
        inspectedAt: this.toLocalInput(new Date().toISOString()),
      });
      this.showModal.set(true);
      return;
    }

    // A split inspection is immutable audit history. Editing it from the UI means
    // rechecking the quarantine child (-Q1/-Q2...), not changing the parent result.
    if (this.wasSplit(row)) {
      let quarantineLot = this.findQuarantineChild(row);
      if (!quarantineLot) {
        await this.quarantinedLotsQuery.refetch();
        quarantineLot = this.findQuarantineChild(row);
      }
      if (!quarantineLot) {
        this.showAlert(
          `Không tìm thấy lô cách ly được tách từ ${row.lotCode ?? 'phiếu này'}. Vui lòng làm mới dữ liệu và thử lại.`,
          false
        );
        return;
      }

      this.recheckMode.set(true);
      this.editItem.set(null);
      this.form.set({
        ...this.rowToForm(row),
        paddyLotId: quarantineLot.id,
        passedInspection: false,
        affectedWeightKg: null,
        affectedBagIds: [],
        inspectedAt: this.toLocalInput(new Date().toISOString()),
      });
      this.showModal.set(true);
      return;
    }

    this.recheckMode.set(false);
    this.editItem.set(row);
    this.form.set(this.rowToForm(row));
    this.showModal.set(true);
  }

  private findQuarantineChild(row: QualityInspectionRow): PaddyLotRow | undefined {
    const parentCode = row.lotCode?.trim().toUpperCase();
    return this.quarantinedLots().find((lot) =>
      lot.parentLotId === row.paddyLotId ||
      (!!parentCode && lot.lotCode.toUpperCase().startsWith(`${parentCode}-Q`))
    );
  }

  /** Tìm lô con của một lần tách trong toàn bộ lịch sử, kể cả khi -Q đã đạt và rời khu cách ly. */
  private findSplitChild(row: QualityInspectionRow): PaddyLotRow | undefined {
    const parentCode = row.lotCode?.trim().toUpperCase();
    const matches = (lot: PaddyLotRow) =>
      lot.parentLotId === row.paddyLotId ||
      (!!parentCode && lot.lotCode.toUpperCase().startsWith(`${parentCode}-Q`));

    return this.lotList().find(matches) ?? this.quarantinedLots().find(matches);
  }

  /** Phiếu đã tách lô cách ly (không đạt + có kg ảnh hưởng) — BE khóa sửa lô/kết quả/kg và cấm xóa. */
  wasSplit(row: QualityInspectionRow | null | undefined): boolean {
    return !!row && !row.passedInspection && (row.affectedWeightKg ?? 0) > 0;
  }
  editLockedSplit = computed(() => this.isEdit() && this.wasSplit(this.editItem()));
  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
    this.recheckMode.set(false);
  }
  setField(field: keyof QcForm, value: any): void {
    this.form.update((x) => ({
      ...x,
      [field]: value,
      ...(field === 'paddyLotId' ? { affectedBagIds: [], affectedWeightKg: null } : {}),
    }));
  }

  toggleAffectedBag(id: number, checked: boolean): void {
    this.form.update((current) => ({
      ...current,
      affectedBagIds: checked
        ? [...new Set([...current.affectedBagIds, id])]
        : current.affectedBagIds.filter((bagId) => bagId !== id),
    }));
  }

  /** Lưu — passed quyết định theo nút bấm (Đạt = xanh / Cách ly = vàng). */
  save(passed: boolean): void {
    const f = this.form();
    if (!f.paddyLotId) {
      this.showAlert('Vui lòng chọn Lô cần kiểm định', false);
      return;
    }
    if (!f.inspectedAt) {
      this.showAlert('Vui lòng chọn Ngày kiểm định', false);
      return;
    }

    // Luồng KIỂM TRA LẠI lô cách ly — xử lý toàn bộ lô, không tách một phần.
    if (this.recheckMode()) {
      this.saveRecheck(passed, f);
      return;
    }

    // Kg ảnh hưởng chỉ áp dụng khi CÁCH LY (không đạt) và có nhập giá trị.
    const affectedBagIds = !passed ? f.affectedBagIds : [];
    const affected = affectedBagIds.length > 0 ? this.selectedBagWeightKg() : null;
    if (affected != null) {
      const basis = this.formLotWeight();
      if (affected <= 0) {
        this.showAlert('Kg ảnh hưởng phải lớn hơn 0.', false);
        return;
      }
      if (basis != null && affected >= basis) {
        this.showAlert(
          `Kg ảnh hưởng (${affected} kg) phải nhỏ hơn trọng lượng của lô (${basis} kg). Để trống nếu cách ly toàn bộ lô.`,
          false
        );
        return;
      }
    }

    const isSplit = affected != null;
    Swal.fire({
      title: passed
        ? 'Duyệt đạt lô này?'
        : isSplit
        ? 'Tách một phần sang cách ly?'
        : 'Cách ly toàn bộ lô này?',
      text: passed
        ? 'Lô sẽ được ghi nhận ĐẠT chất lượng.'
        : isSplit
        ? `Tách ${affected} kg sang lô cách ly, phần còn lại giữ nguyên trạng thái.`
        : 'Toàn bộ lô sẽ chuyển sang CÁCH LY.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: passed ? '#15803d' : '#d97706',
    }).then((result) => {
      if (!result.isConfirmed) return;
      const base: CreateQualityInspectionDto = {
        paddyLotId: Number(f.paddyLotId),
        inspectorId: this.auth.currentUser()?.id ?? null,
        inspectedAt: new Date(f.inspectedAt).toISOString(),
        moisturePercent: this.num(f.moisturePercent),
        impurityPercent: this.num(f.impurityPercent),
        moldLevel: f.moldLevel || null,
        pestLevel: f.pestLevel || null,
        packagingStatus: f.packagingStatus || null,
        passedInspection: passed,
        handling: f.handling || null,
        note: f.note?.trim() || null,
        affectedWeightKg: affected,
        affectedBagIds,
      };
      if (this.isEdit()) {
        this.updateMutation.mutate({ ...base, id: this.editItem()!.id });
      } else {
        this.createMutation.mutate(base);
      }
    });
  }

  /** Gửi phiếu KIỂM TRA LẠI cho lô đang cách ly (toàn bộ lô). */
  private saveRecheck(passed: boolean, f: QcForm): void {
    Swal.fire({
      title: passed ? 'Kiểm tra lại đạt — xếp lại?' : 'Vẫn giữ cách ly?',
      text: passed
        ? 'Toàn bộ hàng sẽ được rút khỏi ô cách ly và tạo phiếu nhập kho để xếp lại vào ô thường.'
        : 'Lô vẫn ở trạng thái CÁCH LY, chỉ ghi nhận kết quả kiểm tra lại.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: passed ? '#15803d' : '#d97706',
    }).then((result) => {
      if (!result.isConfirmed) return;
      const payload: CreateQualityInspectionDto = {
        paddyLotId: Number(f.paddyLotId),
        inspectorId: this.auth.currentUser()?.id ?? null,
        inspectedAt: new Date(f.inspectedAt).toISOString(),
        moisturePercent: this.num(f.moisturePercent),
        impurityPercent: this.num(f.impurityPercent),
        moldLevel: f.moldLevel || null,
        pestLevel: f.pestLevel || null,
        packagingStatus: f.packagingStatus || null,
        passedInspection: passed,
        handling: f.handling || null,
        note: f.note?.trim() || null,
        affectedWeightKg: null,
      };
      this.recheckMutation.mutate(payload);
    });
  }

  private afterRecheck(res: any, passed: boolean): void {
    if (!res?.isSucceeded) {
      this.showAlert(res?.message || 'Thao tác thất bại', false);
      return;
    }
    this.closeModal();
    this.queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
    this.queryClient.invalidateQueries({ queryKey: ['qc-history'] });
    this.queryClient.invalidateQueries({ queryKey: ['qc-quarantined-lots'] });
    if (!passed) {
      this.showAlert('Đã ghi nhận kết quả kiểm tra lại. Lô vẫn ở trạng thái cách ly.');
      return;
    }
    Swal.fire({
      title: 'Kiểm tra lại đạt',
      text: 'Đã rút hàng khỏi ô cách ly và tạo phiếu nhập kho — sang màn Nhập kho để xếp lại vị trí.',
      icon: 'success',
      confirmButtonText: 'Sang Nhập kho',
      confirmButtonColor: '#15803d',
      showCancelButton: true,
      cancelButtonText: 'Ở lại',
    }).then((result) => {
      if (result.isConfirmed) this.router.navigate(['/admin/inbound-orders']);
    });
  }

  deleteSelected(): void {
    const row = this.selectedRow();
    if (!row) return;
    Swal.fire({
      title: 'Xóa phiếu kiểm định?',
      text: `Xóa phiếu của lô "${row.lotCode ?? row.paddyLotId}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then((r) => {
      if (r.isConfirmed) this.deleteMutation.mutate(row.id);
    });
  }

  // ================= Hiển thị / suy diễn =================
  lotInfo(paddyLotId: number): PaddyLotRow | null {
    return this.lotMap().get(paddyLotId) ?? null;
  }
  productName(row: QualityInspectionRow): string {
    return this.lotInfo(row.paddyLotId)?.productVariantName || '—';
  }
  locationName(row: QualityInspectionRow): string {
    const lot = this.lotInfo(row.paddyLotId);
    if (!lot) return '—';
    return lot.warehouseName || `Kho #${lot.warehouseId}`;
  }
  lotWeightKg(row: QualityInspectionRow): number | null {
    if (row.displayTotalWeightKg != null) return row.displayTotalWeightKg;

    const lot = this.lotInfo(row.paddyLotId);
    if (!lot) return null;

    const currentParentWeight = this.lotBasisWeight(lot) ?? 0;
    if (this.isOutboundException(row)) return currentParentWeight;

    const affectedWeight = Math.max(0, Number(row.affectedWeightKg ?? 0));
    if (affectedWeight <= 0) return currentParentWeight;

    // Historical total before a partial split = remaining parent + quarantine
    // child. For lots split after put-away, InitialWeightKg already contains the
    // original total, so take the larger value to support both workflows.
    return Math.max(
      Number(lot.initialWeightKg ?? 0),
      currentParentWeight + affectedWeight
    );
  }
  fmtKg(kg?: number | null): string {
    if (kg == null) return '—';
    return `${kg.toLocaleString('vi-VN')} kg`;
  }

  /** Rủi ro chính suy diễn từ chỉ số kiểm định. */
  riskText(row: QualityInspectionRow): string {
    const parts: string[] = [];
    if (this.hasMoistureRisk(row))
      parts.push(`Độ ẩm ngoài ngưỡng cấu hình (${row.moisturePercent}%)`);
    if ((row.impurityPercent ?? 0) > 3)
      parts.push(`Tạp chất cao (${row.impurityPercent}%)`);
    if (row.moldLevel && row.moldLevel !== 'Không')
      parts.push(`Mốc: ${row.moldLevel}`);
    if (row.pestLevel && row.pestLevel !== 'Không')
      parts.push(`Sâu mọt: ${row.pestLevel}`);
    if (row.packagingStatus && row.packagingStatus !== 'Nguyên')
      parts.push(`Bao ${row.packagingStatus}`);
    if (parts.length === 0) return row.note?.trim() || 'Không phát hiện';
    return parts.join(' · ');
  }

  /** Phiếu kiểm định nháp (chờ nhập kết quả) — lô đang ở trạng thái AWAITING_QC. */
  isDraft(row: QualityInspectionRow | null | undefined): boolean {
    if (row?.inspectionType) return !row.completedAt;
    return (row?.lotStatusCode ?? '').toUpperCase() === 'AWAITING_QC';
  }

  isSession(row: QualityInspectionRow | null | undefined): boolean {
    return !!row?.inspectionType;
  }

  isOutboundException(row: QualityInspectionRow | null | undefined): boolean {
    return (row?.inspectionType ?? '').toUpperCase() === 'OUTBOUND_EXCEPTION';
  }

  targetedBagCountText(row: QualityInspectionRow): string {
    return row.targetedBagCount != null ? `${row.targetedBagCount} bao` : 'Bao được báo lỗi';
  }

  /** Mức độ: {label, cls} — Cao/Trung bình/Thấp. */
  severity(row: QualityInspectionRow): { label: string; cls: string } {
    if (this.isDraft(row)) return { label: 'Chờ kiểm định', cls: 'lvl-mid' };
    if (!row.passedInspection) return { label: 'Cao', cls: 'lvl-high' };
    const risky =
      (row.moldLevel && row.moldLevel !== 'Không') ||
      (row.pestLevel && row.pestLevel !== 'Không') ||
      this.hasMoistureRisk(row) ||
      (row.impurityPercent ?? 0) > 3;
    return risky
      ? { label: 'Trung bình', cls: 'lvl-mid' }
      : { label: 'Thấp', cls: 'lvl-low' };
  }

  private hasMoistureRisk(row: QualityInspectionRow): boolean {
    if (row.moisturePercent == null) return false;
    const config = this.moistureConfig();
    const type = (row.inspectionType || '').toUpperCase();
    if (type === 'STORAGE') {
      return config?.storageQcMoistureWarningPercent != null &&
        row.moisturePercent > config.storageQcMoistureWarningPercent;
    }
    return (config?.receivingMoistureMinPercent != null && row.moisturePercent < config.receivingMoistureMinPercent) ||
      (config?.receivingMoistureMaxPercent != null && row.moisturePercent > config.receivingMoistureMaxPercent);
  }
  statusText(row: QualityInspectionRow): string {
    if (row.displayRole === 'splitPassed') return 'Đạt sơ bộ';
    if (row.displayRole === 'splitQuarantine') return 'Cần cách ly';
    if (this.isDraft(row)) return 'Chờ kiểm định';
    return row.passedInspection ? 'Đạt' : 'Cách ly';
  }

  /** Phạm vi xử lý: Tách một phần / Toàn bộ lô / —. */
  scopeText(row: QualityInspectionRow): string {
    if (row.displayRole === 'splitPassed') return 'Phần đạt sau tách';
    if (row.displayRole === 'splitQuarantine') return 'Phần cách ly đã tách';
    if (this.isOutboundException(row)) return this.targetedBagCountText(row);
    if (row.passedInspection) return '—';
    return (row.affectedWeightKg ?? 0) > 0 ? 'Tách một phần' : 'Toàn bộ lô';
  }
  /** Cột "SỐ LƯỢNG": kg bị ảnh hưởng nếu tách, ngược lại tồn còn lại của lô. */
  affectedMain(row: QualityInspectionRow): string {
    if (row.displayWeightKg != null) return this.fmtKg(row.displayWeightKg);
    if (this.isOutboundException(row)) return this.fmtKg(row.targetedWeightKg);
    if ((row.affectedWeightKg ?? 0) > 0) return this.fmtKg(row.affectedWeightKg);
    return this.fmtKg(this.lotWeightKg(row));
  }
  affectedSub(row: QualityInspectionRow): string {
    if (row.displayRole)
      return `Tách • tổng lô ${this.fmtKg(this.lotWeightKg(row))}`;
    if (this.isOutboundException(row)) return `${this.targetedBagCountText(row)} cần kiểm`;
    if ((row.affectedWeightKg ?? 0) > 0)
      return `Tách • tổng lô ${this.fmtKg(this.lotWeightKg(row))}`;
    return row.passedInspection ? 'Toàn lô' : 'Toàn bộ lô';
  }

  // ================= Helpers =================
  private afterWrite(res: any, okMsg: string): void {
    if (res.isSucceeded) {
      this.closeModal();
      this.queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
      this.queryClient.invalidateQueries({ queryKey: ['qc-history'] });
      // Lô vừa kiểm định rời khỏi danh sách "chờ kiểm định" và đã sinh phiếu nhập kho.
      this.queryClient.invalidateQueries({ queryKey: ['qc-awaiting-qc-lots'] });
      Swal.fire({
        title: 'Thành công',
        text: `${okMsg} Đã tạo phiếu nhập kho — chuyển sang màn Nhập kho để xếp vị trí.`,
        icon: 'success',
        confirmButtonText: 'Sang Nhập kho',
        confirmButtonColor: '#15803d',
        showCancelButton: true,
        cancelButtonText: 'Ở lại',
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/admin/inbound-orders']);
        }
      });
    } else {
      this.showAlert(res.message || 'Thao tác thất bại', false);
    }
  }

  private opt(arr: string[]): { id: string; name: string }[] {
    return arr.map((x) => ({ id: x, name: x }));
  }

  private unwrapDT(res: any): any[] {
    const r = (res as any)?.resources ?? (res as any)?.data;
    if (Array.isArray(r)) return r;
    return r?.data ?? [];
  }
  private unwrapTotal(res: any): number {
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? (Array.isArray(r) ? r.length : 0);
  }

  private rowToForm(r: QualityInspectionRow | QualityInspectionDetailDto): QcForm {
    return {
      paddyLotId: r.paddyLotId ?? null,
      inspectorId: r.inspectorId ?? null,
      inspectedAt: this.toLocalInput(r.inspectedAt),
      moisturePercent: r.moisturePercent ?? null,
      impurityPercent: r.impurityPercent ?? null,
      moldLevel: r.moldLevel || null,
      pestLevel: r.pestLevel || null,
      packagingStatus: r.packagingStatus || null,
      passedInspection: r.passedInspection ?? true,
      handling: r.handling || null,
      note: r.note || '',
      affectedWeightKg: r.affectedWeightKg ?? null,
      affectedBagIds: [],
    };
  }

  private bagToForm(bag: QualityInspectionBagResultDto): BagQcForm {
    const qualityResult = bag.qualityResult ?? 'PASS';
    return {
      moisturePercent: bag.moisturePercent ?? null,
      impurityPercent: bag.impurityPercent ?? null,
      moldLevel: bag.moldLevel || null,
      pestLevel: bag.pestLevel || null,
      packagingStatus: bag.packagingStatus || null,
      qualityResult,
      disposition:
        bag.disposition ??
        this.defaultDisposition(this.bagProgress()?.inspectionType ?? null, qualityResult),
      handling: bag.handling || null,
      note: bag.note || '',
    };
  }

  private blankBagForm(): BagQcForm {
    return {
      moisturePercent: null,
      impurityPercent: null,
      moldLevel: null,
      pestLevel: null,
      packagingStatus: null,
      qualityResult: 'PASS',
      disposition: 'ACCEPT_NORMAL',
      handling: null,
      note: '',
    };
  }

  private defaultDisposition(
    type: string | null,
    result: BagQualityResult
  ): QualityInspectionBagDisposition {
    if (result === 'PASS') {
      if (type === 'STORAGE') return 'KEEP_STORED';
      if (type === 'RECHECK' || type === 'OUTBOUND_EXCEPTION') return 'RELEASE';
      return 'ACCEPT_NORMAL';
    }
    if (type === 'STORAGE' || type === 'OUTBOUND_EXCEPTION') return 'QUARANTINE';
    if (type === 'RECHECK') return 'KEEP_QUARANTINE';
    return 'ACCEPT_QUARANTINE';
  }

  private blankForm(): QcForm {
    return {
      paddyLotId: null,
      inspectorId: null,
      inspectedAt: this.toLocalInput(new Date().toISOString()),
      moisturePercent: null,
      impurityPercent: null,
      moldLevel: null,
      pestLevel: null,
      packagingStatus: null,
      passedInspection: true,
      handling: null,
      note: '',
      affectedWeightKg: null,
      affectedBagIds: [],
    };
  }

  private toLocalInput(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
      d.getHours()
    )}:${p(d.getMinutes())}`;
  }
  private num(v: number | null): number | null {
    if (v === null || v === undefined || (v as any) === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  private showAlert(message: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: message,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#15803d',
    });
  }
}
