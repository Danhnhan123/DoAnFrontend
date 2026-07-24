import { Component, signal, inject, computed, effect } from '@angular/core';
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
  UserAdvancedRow,
  DTParameters,
} from '../../models';
import { QualityInspectionService } from '../../services/quality-inspection.service';
import { PaddyLotService } from '../../services/paddy-lot.service';
import { UserService } from '../../services/user.service';
import { RoleService } from '../../services/role.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

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
}

/**
 * SCR-QC — Quản lý chất lượng & cách ly lô (khớp thiết kế Figma "Chất lượng & cách ly").
 * Nối đủ 7 API QualityInspection: paged, GET all, GET {id}, by-lot, POST, PUT, DELETE.
 */
@Component({
  selector: 'app-quality-inspection',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './quality-inspection.component.html',
  styleUrls: [
    '../supplier/supplier.component.css',
    './quality-inspection.component.css',
  ],
})
export class QualityInspectionComponent {
  private qcService = inject(QualityInspectionService);
  private paddyLotService = inject(PaddyLotService);
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private queryClient = injectQueryClient();

  /**
   * Vai trò được phép đi kiểm định chất lượng theo tài liệu nghiệp vụ:
   * Chủ kho (OWNER) và Nhân viên kho (WAREHOUSE). Dropdown người kiểm chỉ hiện
   * user thuộc các vai trò này. Chỉnh danh sách này nếu nghiệp vụ thay đổi.
   */
  readonly allowedInspectorRoleCodes = ['OWNER', 'WAREHOUSE'];

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
  editItem = signal<QualityInspectionRow | null>(null);
  isEdit = computed(() => !!this.editItem());
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

  usersQuery = injectQuery(() => ({
    queryKey: ['qc-user-options'],
    queryFn: () =>
      lastValueFrom(this.userService.getPagedAdvanced(this.userListBody())),
  }));

  rolesQuery = injectQuery(() => ({
    queryKey: ['qc-roles'],
    queryFn: () =>
      lastValueFrom(
        this.roleService.getPagedRoles({ pageIndex: 1, pageSize: 1000 })
      ),
  }));

  historyQuery = injectQuery(() => ({
    queryKey: ['qc-history', this.historyLotId()],
    enabled: this.historyLotId() != null,
    queryFn: () => lastValueFrom(this.qcService.getByLot(this.historyLotId()!)),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['quality-inspection-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () => lastValueFrom(this.qcService.getById(this.editItem()!.id)),
  }));

  // ================= Derived =================
  rows = computed<QualityInspectionRow[]>(() => this.unwrapDT(this.listQuery.data()));
  totalRecords = computed<number>(() => this.unwrapTotal(this.listQuery.data()));
  lotList = computed<PaddyLotRow[]>(() => this.unwrapDT(this.lotsQuery.data()));
  userList = computed<UserAdvancedRow[]>(() => this.unwrapDT(this.usersQuery.data()));

  lotMap = computed<Map<number, PaddyLotRow>>(() => {
    const m = new Map<number, PaddyLotRow>();
    for (const l of this.lotList()) m.set(l.id, l);
    return m;
  });

  lotOptions = computed(() =>
    this.lotList().map((x) => ({
      id: x.id,
      name: `${x.lotCode}${x.productVariantName ? ' · ' + x.productVariantName : ''}`,
    }))
  );

  /** Danh sách vai trò (để lọc người kiểm theo Code vai trò). */
  rolesList = computed<any[]>(() => {
    const res: any = this.rolesQuery.data();
    const d = res?.data ?? res?.resources;
    if (Array.isArray(d)) return d;
    return d?.items ?? d?.data ?? [];
  });

  /** Id các vai trò được phép kiểm định (map từ Code -> Id). */
  allowedRoleIds = computed<number[]>(() => {
    const codes = this.allowedInspectorRoleCodes.map((c) => c.toUpperCase());
    return this.rolesList()
      .filter((r) => codes.includes(String(r.code ?? '').toUpperCase()))
      .map((r) => r.id);
  });

  /** Người kiểm = user có vai trò được phép; trong lúc tải role thì tạm hiện tất cả. */
  userOptions = computed(() => {
    const allowed = new Set(this.allowedRoleIds());
    const rolesLoaded = !this.rolesQuery.isPending();
    return this.userList()
      .filter((u) => {
        if (!rolesLoaded) return true;
        return (u.roles ?? []).some((r) => allowed.has(r.id));
      })
      .map((u) => ({
        id: u.id,
        name:
          `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
          u.username ||
          `#${u.id}`,
      }));
  });

  historyRows = computed<QualityInspectionRow[]>(() => {
    const res = this.historyQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return Array.isArray(r) ? r : r?.data ?? [];
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());
  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  selectedRow = computed<QualityInspectionRow | null>(
    () => this.rows().find((r) => r.id === this.selectedId()) ?? null
  );
  historyLotId = computed<number | null>(
    () => this.selectedRow()?.paddyLotId ?? null
  );

  // KPI (đồng bộ bộ lọc/trang hiện tại)
  kpiTotal = computed(() => this.totalRecords());
  kpiQuarantine = computed(
    () => this.rows().filter((r) => !r.passedInspection).length
  );
  kpiPassed = computed(
    () => this.rows().filter((r) => r.passedInspection).length
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

  openCreate(): void {
    this.editItem.set(null);
    this.form.set(this.blankForm());
    this.showModal.set(true);
  }
  openEditSelected(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.editItem.set(row);
    this.form.set(this.rowToForm(row));
    this.showModal.set(true);
  }

  /** Phiếu đã tách lô cách ly (không đạt + có kg ảnh hưởng) — BE khóa sửa lô/kết quả/kg và cấm xóa. */
  wasSplit(row: QualityInspectionRow | null | undefined): boolean {
    return !!row && !row.passedInspection && (row.affectedWeightKg ?? 0) > 0;
  }
  editLockedSplit = computed(() => this.isEdit() && this.wasSplit(this.editItem()));
  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }
  setField(field: keyof QcForm, value: any): void {
    this.form.update((x) => ({ ...x, [field]: value }));
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

    // Kg ảnh hưởng chỉ áp dụng khi CÁCH LY (không đạt) và có nhập giá trị.
    const affected = !passed ? this.num(f.affectedWeightKg) : null;
    if (affected != null) {
      const remaining = this.formLot()?.remainingWeightKg ?? null;
      if (affected <= 0) {
        this.showAlert('Kg ảnh hưởng phải lớn hơn 0.', false);
        return;
      }
      if (remaining != null && affected >= remaining) {
        this.showAlert(
          `Kg ảnh hưởng (${affected} kg) phải nhỏ hơn tồn còn lại của lô (${remaining} kg). Để trống nếu cách ly toàn bộ lô.`,
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
        inspectorId: f.inspectorId != null ? Number(f.inspectorId) : null,
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
      };
      if (this.isEdit()) {
        this.updateMutation.mutate({ ...base, id: this.editItem()!.id });
      } else {
        this.createMutation.mutate(base);
      }
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
    return this.lotInfo(row.paddyLotId)?.remainingWeightKg ?? null;
  }
  fmtKg(kg?: number | null): string {
    if (kg == null) return '—';
    return `${kg.toLocaleString('vi-VN')} kg`;
  }

  /** Rủi ro chính suy diễn từ chỉ số kiểm định. */
  riskText(row: QualityInspectionRow): string {
    const parts: string[] = [];
    if ((row.moisturePercent ?? 0) > 14)
      parts.push(`Độ ẩm cao (${row.moisturePercent}%)`);
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

  /** Mức độ: {label, cls} — Cao/Trung bình/Thấp. */
  severity(row: QualityInspectionRow): { label: string; cls: string } {
    if (!row.passedInspection) return { label: 'Cao', cls: 'lvl-high' };
    const risky =
      (row.moldLevel && row.moldLevel !== 'Không') ||
      (row.pestLevel && row.pestLevel !== 'Không') ||
      (row.moisturePercent ?? 0) > 14 ||
      (row.impurityPercent ?? 0) > 3;
    return risky
      ? { label: 'Trung bình', cls: 'lvl-mid' }
      : { label: 'Thấp', cls: 'lvl-low' };
  }
  statusText(row: QualityInspectionRow): string {
    return row.passedInspection ? 'Đạt' : 'Cách ly';
  }

  /** Phạm vi xử lý: Tách một phần / Toàn bộ lô / —. */
  scopeText(row: QualityInspectionRow): string {
    if (row.passedInspection) return '—';
    return (row.affectedWeightKg ?? 0) > 0 ? 'Tách một phần' : 'Toàn bộ lô';
  }
  /** Cột "SỐ LƯỢNG": kg bị ảnh hưởng nếu tách, ngược lại tồn còn lại của lô. */
  affectedMain(row: QualityInspectionRow): string {
    if ((row.affectedWeightKg ?? 0) > 0) return this.fmtKg(row.affectedWeightKg);
    return this.fmtKg(this.lotWeightKg(row));
  }
  affectedSub(row: QualityInspectionRow): string {
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
      this.showAlert(okMsg);
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
    };
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
  private userListBody(): DTParameters {
    return {
      draw: 1,
      columns: [
        {
          data: 'username',
          name: 'username',
          searchable: true,
          orderable: true,
          search: { value: '', regex: false, fixed: [] },
        },
      ],
      order: [{ column: 0, dir: 'asc', name: 'username' }],
      start: 0,
      length: 500,
      search: { value: '', regex: false, fixed: [] },
    };
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
