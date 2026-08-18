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
  MillingYieldConfigRow,
  MillingYieldConfigDetailDto,
  CreateMillingYieldConfigDto,
  UpdateMillingYieldConfigDto,
  RiceVarietyOption,
} from '../../models';
import { MillingYieldConfigService } from '../../services/milling-yield-config.service';
import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';

@Component({
  selector: 'app-milling-yield-config',
  standalone: true,
  imports: [ReadonlyIfDirective, HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './milling-yield-config.component.html',
  styleUrl: '../supplier/supplier.component.css',
})
export class MillingYieldConfigComponent {
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEdit() && !this.perm.canUpdate('MILLING_YIELD_CONFIGS'));
  private service = inject(MillingYieldConfigService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterRiceVarietyId = signal<number | null>(null);
  filterIsActive = signal<boolean | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  readonly statusOptions = [
    { id: true, name: 'Đang áp dụng' },
    { id: false, name: 'Ngừng áp dụng' },
  ];

  showModal = signal(false);
  editItem = signal<MillingYieldConfigRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    riceVarietyId: null,
    moistureFrom: null,
    moistureTo: null,
    yieldRate: null,
    brokenRiceRate: null,
    branRate: null,
    huskRate: null,
    effectiveFrom: null,
    isActive: true,
  });

  private readonly colMap: Record<string, number> = {
    id: 0,
    riceVarietyName: 2,
    yieldRate: 3,
    moistureFrom: 4,
    moistureTo: 5,
    isActive: 6,
    createdDate: 7,
  };

  varietyQuery = injectQuery(() => ({
    queryKey: ['rice-variety-options'],
    queryFn: () => lastValueFrom(this.service.getRiceVarietyOptions()),
    staleTime: 5 * 60 * 1000,
  }));

  varietyOptions = computed<RiceVarietyOption[]>(() => {
    const res = this.varietyQuery.data();
    const list = (res as any)?.resources ?? (res as any)?.data ?? [];
    return (list as any[]).map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
    }));
  });

  varietySelectOptions = computed(() =>
    this.varietyOptions().map((v) => ({
      id: v.id,
      name: `${v.code} — ${v.name}`,
    }))
  );

  listQuery = injectQuery(() => ({
    queryKey: [
      'milling-yield-configs',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterRiceVarietyId(),
      this.filterIsActive(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () => {
      const body = this.service.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterRiceVarietyId: this.filterRiceVarietyId(),
        filterIsActive: this.filterIsActive(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      return lastValueFrom(this.service.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['milling-yield-config-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.service.getById(this.editItem()!.id)),
  }));

  rows = computed<MillingYieldConfigRow[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });

  totalRecords = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  activeCount = computed(() => this.rows().filter((x) => x.isActive).length);
  inactiveCount = computed(() => this.rows().filter((x) => !x.isActive).length);

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: MillingYieldConfigDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      riceVarietyId: detail.riceVarietyId ?? null,
      moistureFrom: detail.moistureFrom ?? null,
      moistureTo: detail.moistureTo ?? null,
      yieldRate: detail.yieldRate ?? null,
      brokenRiceRate: detail.brokenRiceRate ?? null,
      branRate: detail.branRate ?? null,
      huskRate: detail.huskRate ?? null,
      effectiveFrom: detail.effectiveFrom
        ? detail.effectiveFrom.substring(0, 10)
        : null,
      isActive: detail.isActive ?? true,
    });
  });

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateMillingYieldConfigDto) =>
      lastValueFrom(this.service.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({
          queryKey: ['milling-yield-configs'],
        });
        this.showAlert('Thêm cấu hình yield thành công!');
      } else {
        this.showAlert(res.message || 'Thêm thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateMillingYieldConfigDto) =>
      lastValueFrom(this.service.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({
          queryKey: ['milling-yield-configs'],
        });
        this.showAlert('Cập nhật cấu hình yield thành công!');
      } else {
        this.showAlert(res.message || 'Cập nhật thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({
          queryKey: ['milling-yield-configs'],
        });
        this.showAlert('Đã xóa cấu hình yield!');
      } else {
        this.showAlert(res.message || 'Xóa thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi xóa', false),
  }));

  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  varietyLabel(id?: number | null): string {
    if (id == null) return 'Mọi giống lúa';
    const v = this.varietyOptions().find((x) => x.id === id);
    return v ? `${v.code} — ${v.name}` : `#${id}`;
  }

  moistureLabel(row: MillingYieldConfigRow): string {
    if (row.moistureFrom == null && row.moistureTo == null) return 'Mọi độ ẩm';
    const from = row.moistureFrom != null ? row.moistureFrom : 0;
    const to = row.moistureTo != null ? `${row.moistureTo}` : '∞';
    return `${from}–${to}%`;
  }

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }
  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterRiceVarietyId.set(null);
    this.filterIsActive.set(null);
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.applyFilter();
  }
  onSearch(): void {
    this.page.set(1);
  }
  sort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }
  sortIcon(field: string): string {
    if (this.sortField() !== field) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }
  visiblePages(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const d = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) {
      pages.push(i);
    }
    return pages;
  }

  openCreate(): void {
    this.editItem.set(null);
    this.form.set({
      riceVarietyId: null,
      moistureFrom: null,
      moistureTo: null,
      yieldRate: null,
      brokenRiceRate: null,
      branRate: null,
      huskRate: null,
      effectiveFrom: null,
      isActive: true,
    });
    this.showModal.set(true);
  }

  openEdit(row: MillingYieldConfigRow): void {
    this.editItem.set(row);
    this.form.set({
      riceVarietyId: row.riceVarietyId ?? null,
      moistureFrom: row.moistureFrom ?? null,
      moistureTo: row.moistureTo ?? null,
      yieldRate: row.yieldRate ?? null,
      brokenRiceRate: row.brokenRiceRate ?? null,
      branRate: row.branRate ?? null,
      huskRate: row.huskRate ?? null,
      effectiveFrom: row.effectiveFrom ? row.effectiveFrom.substring(0, 10) : null,
      isActive: row.isActive ?? true,
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }

  setField(field: string, value: any): void {
    this.form.update((x) => ({ ...x, [field]: value }));
  }

  private toNum(v: any): number | null {
    return v === null || v === '' || v === undefined ? null : Number(v);
  }

  save(): void {
    const f = this.form();
    const yieldRate = this.toNum(f.yieldRate);
    if (yieldRate == null || yieldRate <= 0 || yieldRate > 1) {
      this.showAlert('Tỷ lệ thu hồi gạo (yield) phải nằm trong khoảng (0; 1].', false);
      return;
    }
    const mFrom = this.toNum(f.moistureFrom);
    const mTo = this.toNum(f.moistureTo);
    if (mFrom != null && mTo != null && mTo < mFrom) {
      this.showAlert('Độ ẩm (đến) phải lớn hơn hoặc bằng độ ẩm (từ).', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} cấu hình yield này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const base: CreateMillingYieldConfigDto = {
        riceVarietyId: this.toNum(f.riceVarietyId),
        moistureFrom: mFrom,
        moistureTo: mTo,
        yieldRate: yieldRate,
        brokenRiceRate: this.toNum(f.brokenRiceRate),
        branRate: this.toNum(f.branRate),
        huskRate: this.toNum(f.huskRate),
        effectiveFrom: f.effectiveFrom || null,
        isActive: !!f.isActive,
      };

      if (this.isEdit()) {
        const payload: UpdateMillingYieldConfigDto = {
          ...base,
          id: this.editItem()!.id,
        };
        this.updateMutation.mutate(payload);
      } else {
        this.createMutation.mutate(base);
      }
    });
  }

  delete(row: MillingYieldConfigRow): void {
    Swal.fire({
      title: 'Xóa cấu hình yield?',
      text: `Bạn có chắc muốn xóa cấu hình cho "${this.varietyLabel(
        row.riceVarietyId
      )}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteMutation.mutate(row.id);
      }
    });
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
