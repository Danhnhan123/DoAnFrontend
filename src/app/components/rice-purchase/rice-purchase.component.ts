import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import {
  CreatePaddyPurchaseReceiptDto,
  CreatePaddyPurchaseScheduleDto,
  FarmerDetailDto,
  PaddyPurchaseReceiptRow,
  PaddyPurchaseScheduleRow,
  PaddyQualitySnapshot,
  PaddyScheduleStatusCode,
  PaddyScheduleStatusOption,
  RiceVarietyDetailDto,
  UpdatePaddyPurchaseReceiptDto,
  UpdatePaddyPurchaseScheduleDto,
  WarehouseDetailDto,
} from '../../models';
import { PaddyPurchaseService } from '../../services/paddy-purchase.service';

type PurchaseTab = 'schedule' | 'receipt';

interface ScheduleFormState {
  id?: number;
  organizationId?: number | null;
  farmerId: number | null;
  statusId: number;
  riceVarietyId: number | null;
  scheduleDate: string;
  location: string;
  estimatedQtyTon: number | null;
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
  warehouseId: number | null;
  actualWeightKg: number | null;
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
  selector: 'app-rice-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rice-purchase.component.html',
  styleUrl: './rice-purchase.component.css',
})
export class RicePurchaseComponent implements OnInit, OnDestroy {
  private readonly purchaseService = inject(PaddyPurchaseService);

  readonly statuses: PaddyScheduleStatusOption[] = [
    { id: 1, code: 'NEW', name: 'Mới tạo', color: '#6B7280' },
    { id: 2, code: 'CONFIRMED', name: 'Đã xác nhận', color: '#3B82F6' },
    { id: 3, code: 'COLLECTING', name: 'Đang đi thu', color: '#F59E0B' },
    { id: 4, code: 'WEIGHED', name: 'Đã cân hàng', color: '#8B5CF6' },
    { id: 5, code: 'STOCKED', name: 'Đã nhập kho', color: '#10B981' },
    { id: 6, code: 'CANCELLED', name: 'Hủy', color: '#EF4444' },
  ];

  activeTab = signal<PurchaseTab>('schedule');

  farmers = signal<FarmerDetailDto[]>([]);
  riceVarieties = signal<RiceVarietyDetailDto[]>([]);
  warehouses = signal<WarehouseDetailDto[]>([]);
  scheduleOptions = signal<PaddyPurchaseScheduleRow[]>([]);

  scheduleRows = signal<PaddyPurchaseScheduleRow[]>([]);
  receiptRows = signal<PaddyPurchaseReceiptRow[]>([]);
  receiptStatsRows = signal<PaddyPurchaseReceiptRow[]>([]);

  scheduleTotal = signal(0);
  receiptTotal = signal(0);
  schedulePage = signal(1);
  receiptPage = signal(1);
  readonly pageSize = 10;

  scheduleSearch = signal('');
  receiptSearch = signal('');

  loadingReference = signal(false);
  loadingSchedules = signal(false);
  loadingReceipts = signal(false);
  savingSchedule = signal(false);
  savingReceipt = signal(false);
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

  readonly scheduleFarmer = computed(() =>
    this.farmers().find((x) => x.id === this.scheduleForm().farmerId)
  );

  readonly selectedReceiptSchedule = computed(() =>
    this.scheduleOptions().find((x) => x.id === this.receiptForm().scheduleId)
  );

  readonly receiptTotalAmount = computed(() => {
    const weight = Number(this.receiptForm().actualWeightKg || 0);
    const price = Number(this.receiptForm().agreedPrice || 0);
    return this.roundMoney(weight * price);
  });

  readonly receiptDebtAmount = computed(() => {
    const paid = Number(this.receiptForm().paidAmount || 0);
    return Math.max(0, this.roundMoney(this.receiptTotalAmount() - paid));
  });

  readonly totalPurchaseThisWeekKg = computed(() => {
    const { start, end } = this.currentWeekRange();
    return this.receiptStatsRows()
      .filter((x) => {
        const date = new Date(x.receiptDate);
        return !Number.isNaN(date.getTime()) && date >= start && date <= end;
      })
      .reduce((sum, x) => sum + Number(x.actualWeightKg || 0), 0);
  });

  readonly averagePurchasePrice = computed(() => {
    const rows = this.receiptStatsRows();
    const totalWeight = rows.reduce(
      (sum, x) => sum + Number(x.actualWeightKg || 0),
      0
    );
    const totalAmount = rows.reduce(
      (sum, x) => sum + Number(x.totalAmount || 0),
      0
    );
    return totalWeight > 0 ? totalAmount / totalWeight : 0;
  });

  readonly totalPurchaseCost = computed(() =>
    this.receiptStatsRows().reduce(
      (sum, x) => sum + Number(x.totalAmount || 0),
      0
    )
  );

  readonly totalFarmerDebt = computed(() =>
    this.receiptStatsRows().reduce(
      (sum, x) => sum + Number(x.debtAmount || 0),
      0
    )
  );

  ngOnInit(): void {
    this.loadReferenceData();
    this.loadSchedules();
    this.loadReceipts();
  }

  ngOnDestroy(): void {
    if (this.scheduleSearchTimer) clearTimeout(this.scheduleSearchTimer);
    if (this.receiptSearchTimer) clearTimeout(this.receiptSearchTimer);
  }

  switchTab(tab: PurchaseTab): void {
    this.activeTab.set(tab);
  }

  // ───────────────────────── NẠP DỮ LIỆU ─────────────────────────

  loadReferenceData(): void {
    this.loadingReference.set(true);
    forkJoin({
      farmers: this.purchaseService.getFarmers(),
      varieties: this.purchaseService.getRiceVarieties(),
      warehouses: this.purchaseService.getWarehouses(),
      schedules: this.purchaseService.getSchedules(),
      receipts: this.purchaseService.getReceipts(),
    })
      .pipe(finalize(() => this.loadingReference.set(false)))
      .subscribe({
      next: (res) => {
        this.farmers.set(
          [...(res.farmers.resources || [])]
            .filter((x) => x.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        );
        this.riceVarieties.set(
          [...(res.varieties.resources || [])]
            .filter((x) => x.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        );
        this.warehouses.set(
          [...(res.warehouses.resources || [])]
            .filter((x) => x.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        );
        this.scheduleOptions.set(
          [...(res.schedules.resources || [])].sort(
            (a, b) =>
              new Date(b.scheduleDate).getTime() -
              new Date(a.scheduleDate).getTime()
          )
        );
        this.receiptStatsRows.set(res.receipts.resources || []);
      },
      error: (err) =>
        this.showError(
          this.apiError(err, 'Không tải được dữ liệu danh mục cho form.')
        ),
    });
  }

  loadSchedules(): void {
    this.loadingSchedules.set(true);
    const body = this.purchaseService.buildSchedulePagedBody({
      page: this.schedulePage(),
      pageSize: this.pageSize,
      search: this.scheduleSearch(),
      sortField: 'scheduleDate',
      sortDir: 'desc',
    });

    this.purchaseService
      .getSchedulesPaged(body)
      .pipe(finalize(() => this.loadingSchedules.set(false)))
      .subscribe({
      next: (res) => {
        const paged = res.resources as any;
        this.scheduleRows.set(paged?.data || []);
        this.scheduleTotal.set(
          Number(paged?.recordsFiltered ?? paged?.recordsTotal ?? 0)
        );
      },
      error: (err) =>
        this.showError(this.apiError(err, 'Không tải được lịch thu mua.')),
    });
  }

  loadReceipts(): void {
    this.loadingReceipts.set(true);
    const body = this.purchaseService.buildReceiptPagedBody({
      page: this.receiptPage(),
      pageSize: this.pageSize,
      search: this.receiptSearch(),
      sortField: 'receiptDate',
      sortDir: 'desc',
    });

    this.purchaseService
      .getReceiptsPaged(body)
      .pipe(finalize(() => this.loadingReceipts.set(false)))
      .subscribe({
      next: (res) => {
        const paged = res.resources as any;
        this.receiptRows.set(paged?.data || []);
        this.receiptTotal.set(
          Number(paged?.recordsFiltered ?? paged?.recordsTotal ?? 0)
        );
      },
      error: (err) =>
        this.showError(this.apiError(err, 'Không tải được phiếu mua lúa.')),
    });
  }

  refreshScheduleData(): void {
    this.loadSchedules();
    this.purchaseService.getSchedules().subscribe({
      next: (res) => this.scheduleOptions.set(res.resources || []),
    });
  }

  refreshReceiptData(): void {
    this.loadReceipts();
    this.purchaseService.getReceipts().subscribe({
      next: (res) => this.receiptStatsRows.set(res.resources || []),
    });
  }

  // ───────────────────────── TÌM KIẾM / PHÂN TRANG ────────────────

  onScheduleSearch(value: string): void {
    this.scheduleSearch.set(value);
    this.schedulePage.set(1);
    if (this.scheduleSearchTimer) clearTimeout(this.scheduleSearchTimer);
    this.scheduleSearchTimer = setTimeout(() => this.loadSchedules(), 350);
  }

  onReceiptSearch(value: string): void {
    this.receiptSearch.set(value);
    this.receiptPage.set(1);
    if (this.receiptSearchTimer) clearTimeout(this.receiptSearchTimer);
    this.receiptSearchTimer = setTimeout(() => this.loadReceipts(), 350);
  }

  setSchedulePage(page: number): void {
    if (page < 1 || page > this.scheduleTotalPages()) return;
    this.schedulePage.set(page);
    this.loadSchedules();
  }

  setReceiptPage(page: number): void {
    if (page < 1 || page > this.receiptTotalPages()) return;
    this.receiptPage.set(page);
    this.loadReceipts();
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
    this.editingSchedule.set(row);
    this.scheduleForm.set({
      id: row.id,
      organizationId: row.organizationId ?? null,
      farmerId: row.farmerId,
      statusId: row.statusId,
      riceVarietyId: row.riceVarietyId ?? null,
      scheduleDate: this.toDateInput(row.scheduleDate),
      location: row.location || '',
      estimatedQtyTon:
        row.estimatedQtyKg != null
          ? Number(row.estimatedQtyKg) / 1000
          : null,
      expectedPrice: row.expectedPrice ?? null,
      assignedUserId: row.assignedUserId ?? null,
      note: row.note || '',
    });
    this.showScheduleModal.set(true);
  }

  closeScheduleModal(): void {
    if (this.savingSchedule()) return;
    this.showScheduleModal.set(false);
    this.editingSchedule.set(null);
  }

  setScheduleField<K extends keyof ScheduleFormState>(
    field: K,
    value: ScheduleFormState[K]
  ): void {
    this.scheduleForm.update((current) => ({ ...current, [field]: value }));
  }

  async saveSchedule(): Promise<void> {
    const form = this.scheduleForm();
    const validationMessage = this.validateSchedule(form);
    if (validationMessage) {
      this.showError(validationMessage);
      return;
    }

    const accepted = await this.askConfirm(
      this.editingSchedule() ? 'Cập nhật lịch thu mua?' : 'Tạo lịch thu mua?',
      this.editingSchedule()
        ? 'Các thông tin lịch hẹn sẽ được cập nhật theo dữ liệu vừa nhập.'
        : 'Hệ thống sẽ tạo mã lịch tự động và lưu trạng thái Mới tạo.'
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
        form.estimatedQtyTon != null
          ? this.roundWeight(Number(form.estimatedQtyTon) * 1000)
          : null,
      expectedPrice: form.expectedPrice ?? null,
      assignedUserId: form.assignedUserId ?? null,
      note: form.note.trim() || null,
    };

    const wasEditing = !!this.editingSchedule();
    this.savingSchedule.set(true);
    try {
      const response = wasEditing
        ? await lastValueFrom(
            this.purchaseService.updateSchedule({
              ...base,
              id: this.editingSchedule()!.id,
            } as UpdatePaddyPurchaseScheduleDto)
          )
        : await lastValueFrom(this.purchaseService.createSchedule(base));

      if (!response.isSucceeded) {
        throw new Error(response.message || 'Không lưu được lịch thu mua.');
      }

      this.showScheduleModal.set(false);
      this.editingSchedule.set(null);
      this.refreshScheduleData();
      await this.showSuccess(
        wasEditing
          ? 'Cập nhật lịch thu mua thành công.'
          : response.message || 'Tạo lịch thu mua thành công.'
      );
    } catch (err) {
      this.showError(this.apiError(err, 'Không lưu được lịch thu mua.'));
    } finally {
      this.savingSchedule.set(false);
    }
  }

  async advanceSchedule(row: PaddyPurchaseScheduleRow): Promise<void> {
    const next = this.nextStatus(row.statusId);
    if (!next) return;

    const accepted = await this.askConfirm(
      `Chuyển sang “${next.name}”?`,
      `Lịch ${row.scheduleCode} sẽ được cập nhật trạng thái.`
    );
    if (!accepted) return;

    this.updatingScheduleId.set(row.id);
    try {
      const response = await lastValueFrom(
        this.purchaseService.updateScheduleStatus(row.id, next.code)
      );
      if (!response.isSucceeded) {
        throw new Error(response.message || 'Không cập nhật được trạng thái.');
      }
      this.refreshScheduleData();
      await this.showSuccess(response.message || 'Đã cập nhật trạng thái.');
    } catch (err) {
      this.showError(this.apiError(err, 'Không cập nhật được trạng thái.'));
    } finally {
      this.updatingScheduleId.set(null);
    }
  }

  async cancelSchedule(row: PaddyPurchaseScheduleRow): Promise<void> {
    if (row.statusId === 5 || row.statusId === 6) return;
    const accepted = await this.askConfirm(
      'Hủy lịch thu mua?',
      `Lịch ${row.scheduleCode} sẽ chuyển sang trạng thái Hủy.`
    );
    if (!accepted) return;

    this.updatingScheduleId.set(row.id);
    try {
      const response = await lastValueFrom(
        this.purchaseService.updateScheduleStatus(row.id, 'CANCELLED')
      );
      if (!response.isSucceeded) throw new Error(response.message);
      this.refreshScheduleData();
      this.showScheduleModal.set(false);
      await this.showSuccess('Đã hủy lịch thu mua.');
    } catch (err) {
      this.showError(this.apiError(err, 'Không hủy được lịch thu mua.'));
    } finally {
      this.updatingScheduleId.set(null);
    }
  }

  // ───────────────────────── FORM PHIẾU MUA LÚA ──────────────────

  openCreateReceipt(schedule?: PaddyPurchaseScheduleRow): void {
    this.editingReceipt.set(null);
    const form = this.defaultReceiptForm();
    if (schedule) {
      form.scheduleId = schedule.id;
      form.farmerId = schedule.farmerId;
      form.riceVarietyId = schedule.riceVarietyId ?? null;
    }
    this.receiptForm.set(form);
    this.activeTab.set('receipt');
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
      warehouseId: row.warehouseId,
      actualWeightKg: Number(row.actualWeightKg),
      bagCount: row.bagCount ?? null,
      agreedPrice: Number(row.agreedPrice),
      paidAmount: Number(row.paidAmount),
      moisturePercent: quality.moisturePercent ?? null,
      qualityGrade: quality.grade || '',
      qualityNote: quality.note || '',
      priceAdjustReason: row.priceAdjustReason || '',
      receiptDate: this.toDateInput(row.receiptDate),
      isConfirmed: !!row.isConfirmed,
    });
    this.showReceiptModal.set(true);
  }

  closeReceiptModal(): void {
    if (this.savingReceipt()) return;
    this.showReceiptModal.set(false);
    this.editingReceipt.set(null);
  }

  setReceiptField<K extends keyof ReceiptFormState>(
    field: K,
    value: ReceiptFormState[K]
  ): void {
    this.receiptForm.update((current) => ({ ...current, [field]: value }));
  }

  onReceiptScheduleChange(rawValue: number | string | null): void {
    const id = rawValue ? Number(rawValue) : null;
    const schedule = this.scheduleOptions().find((x) => x.id === id);
    this.receiptForm.update((current) => ({
      ...current,
      scheduleId: id,
      farmerId: schedule?.farmerId ?? current.farmerId,
      riceVarietyId: schedule?.riceVarietyId ?? current.riceVarietyId,
    }));
  }

  async saveReceipt(): Promise<void> {
    const form = this.receiptForm();
    if (form.isConfirmed) {
      this.showError('Phiếu đã chốt nên không thể chỉnh sửa.');
      return;
    }

    const validationMessage = this.validateReceipt(form);
    if (validationMessage) {
      this.showError(validationMessage);
      return;
    }

    const totalAmount = this.receiptTotalAmount();
    const debtAmount = this.receiptDebtAmount();
    const qualityJson = this.buildQualityJson(form);

    const accepted = await this.askConfirm(
      this.editingReceipt() ? 'Cập nhật phiếu mua lúa?' : 'Tạo phiếu mua lúa?',
      'Phiếu được lưu trước. Tồn kho chỉ tăng sau khi bạn bấm Chốt phiếu.'
    );
    if (!accepted) return;

    const base: CreatePaddyPurchaseReceiptDto = {
      organizationId: form.organizationId ?? null,
      scheduleId: form.scheduleId || null,
      farmerId: Number(form.farmerId),
      riceVarietyId: form.riceVarietyId || null,
      warehouseId: Number(form.warehouseId),
      actualWeightKg: this.roundWeight(Number(form.actualWeightKg)),
      bagCount: form.bagCount ?? null,
      agreedPrice: this.roundMoney(Number(form.agreedPrice)),
      totalAmount,
      paidAmount: this.roundMoney(Number(form.paidAmount || 0)),
      debtAmount,
      qualityJson,
      priceAdjustReason: form.priceAdjustReason.trim() || null,
      receiptDate: this.toApiDate(form.receiptDate),
    };

    this.savingReceipt.set(true);
    try {
      const response = this.editingReceipt()
        ? await lastValueFrom(
            this.purchaseService.updateReceipt({
              ...base,
              id: this.editingReceipt()!.id,
            } as UpdatePaddyPurchaseReceiptDto)
          )
        : await lastValueFrom(this.purchaseService.createReceipt(base));

      if (!response.isSucceeded) {
        throw new Error(response.message || 'Không lưu được phiếu mua lúa.');
      }

      this.showReceiptModal.set(false);
      this.editingReceipt.set(null);
      this.refreshReceiptData();
      await this.showSuccess(response.message || 'Đã lưu phiếu mua lúa.');
    } catch (err) {
      this.showError(this.apiError(err, 'Không lưu được phiếu mua lúa.'));
    } finally {
      this.savingReceipt.set(false);
    }
  }

  async confirmReceipt(row: PaddyPurchaseReceiptRow): Promise<void> {
    if (row.isConfirmed) return;
    const accepted = await this.askConfirm(
      'Chốt phiếu mua lúa?',
      'Thao tác này sẽ sinh lô lúa, tạo đơn nhập, tăng tồn kho và ghi công nợ. Phiếu sẽ không thể sửa sau khi chốt.'
    );
    if (!accepted) return;

    this.confirmingReceiptId.set(row.id);
    try {
      const response = await lastValueFrom(
        this.purchaseService.confirmReceipt(row.id)
      );
      if (!response.isSucceeded) {
        throw new Error(response.message || 'Không chốt được phiếu.');
      }

      this.refreshReceiptData();
      this.refreshScheduleData();
      const lotCode = response.resources?.lotCode;
      await this.showSuccess(
        lotCode
          ? `${response.message} Mã lô: ${lotCode}`
          : response.message || 'Chốt phiếu thành công.'
      );
    } catch (err) {
      this.showError(this.apiError(err, 'Không chốt được phiếu mua lúa.'));
    } finally {
      this.confirmingReceiptId.set(null);
    }
  }

  // ───────────────────────── HIỂN THỊ / TIỆN ÍCH ─────────────────

  farmerPhone(farmerId: number): string {
    return this.farmers().find((x) => x.id === farmerId)?.phone || '—';
  }

  riceVarietyName(id?: number | null): string {
    if (!id) return 'Chưa chọn';
    return this.riceVarieties().find((x) => x.id === id)?.name || 'Chưa rõ';
  }

  statusOf(statusId: number): PaddyScheduleStatusOption {
    return (
      this.statuses.find((x) => x.id === statusId) || {
        id: statusId,
        code: 'NEW' as PaddyScheduleStatusCode,
        name: 'Không xác định',
        color: '#6B7280',
      }
    );
  }

  nextStatus(statusId: number): PaddyScheduleStatusOption | null {
    const nextMap: Record<number, PaddyScheduleStatusCode | null> = {
      1: 'CONFIRMED',
      2: 'COLLECTING',
      3: 'WEIGHED',
      4: 'STOCKED',
      5: null,
      6: null,
    };
    const code = nextMap[statusId];
    return code ? this.statuses.find((x) => x.code === code) || null : null;
  }

  statusClass(statusId: number): string {
    return `status-${this.statusOf(statusId).code.toLowerCase()}`;
  }

  qualityOf(row: PaddyPurchaseReceiptRow): PaddyQualitySnapshot {
    return this.parseQuality(row.qualityJson);
  }

  moistureClass(value?: number | null): string {
    if (value == null) return 'moisture-neutral';
    if (value > 15) return 'moisture-high';
    if (value >= 14.6) return 'moisture-warning';
    return 'moisture-good';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  formatWeightKg(value?: number | null): string {
    return `${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 2,
    }).format(Number(value || 0))} kg`;
  }

  formatTonFromKg(value?: number | null): string {
    const ton = Number(value || 0) / 1000;
    return `${new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: ton % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(ton)} tấn`;
  }

  formatPrice(value?: number | null): string {
    return `${new Intl.NumberFormat('vi-VN', {
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
    return `${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(amount)} đ`;
  }

  formatMoney(value?: number | null): string {
    return `${new Intl.NumberFormat('vi-VN', {
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
      location: '',
      estimatedQtyTon: null,
      expectedPrice: null,
      assignedUserId: null,
      note: '',
    };
  }

  private defaultReceiptForm(): ReceiptFormState {
    return {
      scheduleId: null,
      farmerId: null,
      riceVarietyId: null,
      warehouseId: null,
      actualWeightKg: null,
      bagCount: null,
      agreedPrice: null,
      paidAmount: 0,
      moisturePercent: null,
      qualityGrade: '',
      qualityNote: '',
      priceAdjustReason: '',
      receiptDate: this.todayInput(),
      isConfirmed: false,
    };
  }

  private validateSchedule(form: ScheduleFormState): string | null {
    if (!form.farmerId) return 'Vui lòng chọn nông dân.';
    if (!form.location.trim()) return 'Vui lòng nhập khu vực ruộng/điểm hẹn.';
    if (!form.scheduleDate) return 'Vui lòng chọn ngày hẹn.';
    if (
      form.estimatedQtyTon != null &&
      Number(form.estimatedQtyTon) <= 0
    ) {
      return 'Sản lượng dự kiến phải lớn hơn 0.';
    }
    return null;
  }

  private validateReceipt(form: ReceiptFormState): string | null {
    if (!form.farmerId) return 'Vui lòng chọn nông dân.';
    if (!form.warehouseId) return 'Vui lòng chọn kho nhập.';
    if (!form.receiptDate) return 'Vui lòng chọn ngày mua thực tế.';
    if (!form.actualWeightKg || Number(form.actualWeightKg) <= 0) {
      return 'Thực cân phải lớn hơn 0 kg.';
    }
    if (!form.agreedPrice || Number(form.agreedPrice) <= 0) {
      return 'Giá mua phải lớn hơn 0 đồng/kg.';
    }
    if (Number(form.paidAmount || 0) < 0) {
      return 'Số tiền đã trả không được âm.';
    }
    if (Number(form.paidAmount || 0) > this.receiptTotalAmount()) {
      return 'Số tiền đã trả không được lớn hơn thành tiền.';
    }
    if (
      form.moisturePercent != null &&
      (Number(form.moisturePercent) < 0 ||
        Number(form.moisturePercent) > 100)
    ) {
      return 'Độ ẩm phải nằm trong khoảng 0–100%.';
    }
    return null;
  }

  private buildQualityJson(form: ReceiptFormState): string | null {
    const quality: PaddyQualitySnapshot = {
      moisturePercent:
        form.moisturePercent != null
          ? Number(form.moisturePercent)
          : null,
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
      if (parsed && typeof parsed === 'object') {
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
    return new Date(now.getTime() - offset * 60_000)
      .toISOString()
      .slice(0, 10);
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

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private compactNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private async askConfirm(title: string, text: string): Promise<boolean> {
    const result = await Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#159947',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    });
    return result.isConfirmed;
  }

  private showSuccess(message: string): Promise<any> {
    return Swal.fire({
      title: 'Thành công',
      text: message,
      icon: 'success',
      confirmButtonColor: '#159947',
    });
  }

  private showError(message: string): void {
    Swal.fire({
      title: 'Không thể thực hiện',
      text: message,
      icon: 'error',
      confirmButtonColor: '#159947',
    });
  }

  private apiError(error: any, fallback: string): string {
    const api = error?.error;
    if (api?.message) return api.message;
    if (error?.message) return error.message;
    return fallback;
  }
}
