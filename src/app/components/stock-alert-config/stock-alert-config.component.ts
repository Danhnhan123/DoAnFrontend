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
  StockAlertConfigRow,
  StockAlertConfigDetailDto,
  CreateStockAlertConfigDto,
  UpdateStockAlertConfigDto,
  StockWarehouseOption,
  StockVariantOption,
} from '../../models';
import { StockAlertConfigService } from '../../services/stock-alert-config.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-stock-alert-config',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './stock-alert-config.component.html',
  styleUrl: '../supplier/supplier.component.css',
})
export class StockAlertConfigComponent {
  private service = inject(StockAlertConfigService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterWarehouseId = signal<number | null>(null);
  filterVariantId = signal<number | null>(null);
  filterIsActive = signal<boolean | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  readonly statusOptions = [
    { id: true, name: 'Đang áp dụng' },
    { id: false, name: 'Ngừng áp dụng' },
  ];

  showModal = signal(false);
  editItem = signal<StockAlertConfigRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    warehouseId: null,
    productVariantId: null,
    minThreshold: 0,
    isActive: true,
  });

  private readonly colMap: Record<string, number> = {
    id: 0,
    warehouseName: 2,
    productVariantSku: 4,
    minThreshold: 5,
    isActive: 6,
    createdDate: 7,
  };

  warehouseQuery = injectQuery(() => ({
    queryKey: ['warehouse-options'],
    queryFn: () => lastValueFrom(this.service.getWarehouseOptions()),
    staleTime: 5 * 60 * 1000,
  }));

  variantQuery = injectQuery(() => ({
    queryKey: ['variant-options'],
    queryFn: () => lastValueFrom(this.service.getVariantOptions()),
    staleTime: 5 * 60 * 1000,
  }));

  warehouseOptions = computed<StockWarehouseOption[]>(() => {
    const res = this.warehouseQuery.data();
    const list = (res as any)?.resources ?? (res as any)?.data ?? [];
    return (list as any[]).map((w) => ({ id: w.id, code: w.code, name: w.name }));
  });

  variantOptions = computed<StockVariantOption[]>(() => {
    const res = this.variantQuery.data();
    const list = (res as any)?.resources ?? (res as any)?.data ?? [];
    return (list as any[]).map((v) => ({
      id: v.id,
      sku: v.sku ?? v.SKU ?? '',
      productName: v.productName ?? v.name ?? null,
    }));
  });

  warehouseSelectOptions = computed(() =>
    this.warehouseOptions().map((w) => ({
      id: w.id,
      name: `${w.code} — ${w.name}`,
    }))
  );

  variantSelectOptions = computed(() =>
    this.variantOptions().map((v) => ({
      id: v.id,
      name: v.productName ? `${v.sku} — ${v.productName}` : v.sku,
    }))
  );

  listQuery = injectQuery(() => ({
    queryKey: [
      'stock-alert-configs',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterWarehouseId(),
      this.filterVariantId(),
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
        filterWarehouseId: this.filterWarehouseId(),
        filterVariantId: this.filterVariantId(),
        filterIsActive: this.filterIsActive(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      return lastValueFrom(this.service.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['stock-alert-config-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () => lastValueFrom(this.service.getById(this.editItem()!.id)),
  }));

  rows = computed<StockAlertConfigRow[]>(() => {
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

    const detail: StockAlertConfigDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      warehouseId: detail.warehouseId ?? null,
      productVariantId: detail.productVariantId ?? null,
      minThreshold: detail.minThreshold ?? 0,
      isActive: detail.isActive ?? true,
    });
  });

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateStockAlertConfigDto) =>
      lastValueFrom(this.service.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['stock-alert-configs'] });
        this.showAlert('Thêm cấu hình ngưỡng tồn thành công!');
      } else {
        this.showAlert(res.message || 'Thêm thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateStockAlertConfigDto) =>
      lastValueFrom(this.service.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['stock-alert-configs'] });
        this.showAlert('Cập nhật cấu hình ngưỡng tồn thành công!');
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
        this.queryClient.invalidateQueries({ queryKey: ['stock-alert-configs'] });
        this.showAlert('Đã xóa cấu hình ngưỡng tồn!');
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

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }
  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterWarehouseId.set(null);
    this.filterVariantId.set(null);
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
      warehouseId: null,
      productVariantId: null,
      minThreshold: 0,
      isActive: true,
    });
    this.showModal.set(true);
  }

  openEdit(row: StockAlertConfigRow): void {
    this.editItem.set(row);
    this.form.set({
      warehouseId: row.warehouseId ?? null,
      productVariantId: row.productVariantId ?? null,
      minThreshold: row.minThreshold ?? 0,
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

  save(): void {
    const f = this.form();
    const warehouseId =
      f.warehouseId === null || f.warehouseId === '' ? null : Number(f.warehouseId);
    if (!warehouseId || warehouseId <= 0) {
      this.showAlert('Vui lòng chọn kho.', false);
      return;
    }
    const minThreshold =
      f.minThreshold === null || f.minThreshold === '' ? 0 : Number(f.minThreshold);
    if (minThreshold < 0) {
      this.showAlert('Ngưỡng tồn tối thiểu phải lớn hơn hoặc bằng 0.', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} cấu hình ngưỡng tồn này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const base: CreateStockAlertConfigDto = {
        warehouseId: warehouseId,
        productVariantId:
          f.productVariantId === null || f.productVariantId === ''
            ? null
            : Number(f.productVariantId),
        minThreshold: minThreshold,
        isActive: !!f.isActive,
      };

      if (this.isEdit()) {
        const payload: UpdateStockAlertConfigDto = {
          ...base,
          id: this.editItem()!.id,
        };
        this.updateMutation.mutate(payload);
      } else {
        this.createMutation.mutate(base);
      }
    });
  }

  delete(row: StockAlertConfigRow): void {
    const label = row.productVariantSku
      ? `${row.warehouseName} / ${row.productVariantSku}`
      : `${row.warehouseName} (toàn kho)`;
    Swal.fire({
      title: 'Xóa cấu hình ngưỡng tồn?',
      text: `Bạn có chắc muốn xóa cấu hình "${label}"?`,
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
