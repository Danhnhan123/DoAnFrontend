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
  LocationRow,
  LocationDetailDto,
  CreateLocationDto,
  UpdateLocationDto,
} from '../../models';
import { LocationService } from '../../services/location.service';
import { WarehouseService } from '../../services/warehouse.service';
import { ProductCategoryService } from '../../services/product-category.service';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

@Component({
  selector: 'app-location',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './location.component.html',
  styleUrl: './location.component.css',
})
export class LocationComponent {
  private locationService = inject(LocationService);
  private warehouseService = inject(WarehouseService);
  private categoryService = inject(ProductCategoryService);
  private queryClient = injectQueryClient();

  // 1. State bảng
  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  // Bộ lọc nâng cao
  showFilter = signal(false);
  filterWarehouseId = signal<number | null>(null);
  filterZoneName = signal<string | null>(null);
  filterSlotCode = signal<string | null>(null);
  filterIsActive = signal<boolean | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  readonly statusOptions = [
    { id: true, name: 'Đang hoạt động' },
    { id: false, name: 'Ngừng hoạt động' },
  ];

  // 2. State modal
  showModal = signal(false);
  editItem = signal<LocationRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    warehouseId: null,
    zoneName: '',
    shelfRow: '',
    shelfLevel: '',
    slotCode: '',
    maxCapacity: null,
    currentOccupancy: 0,
    priority: 0,
    allowedCategoryId: null,
    isQuarantine: false,
    description: '',
    isActive: true,
  });

  private readonly colMap: Record<string, number> = {
    id: 0,
    warehouseId: 1,
    zoneName: 2,
    shelfRow: 3,
    shelfLevel: 4,
    slotCode: 5,
    maxCapacity: 6,
    isActive: 7,
    createdDate: 8,
  };

  // 3. Queries
  listQuery = injectQuery(() => ({
    queryKey: [
      'locations',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterWarehouseId(),
      this.filterZoneName(),
      this.filterSlotCode(),
      this.filterIsActive(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () => {
      const body = this.locationService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterWarehouseId: this.filterWarehouseId(),
        filterZoneName: this.filterZoneName(),
        filterSlotCode: this.filterSlotCode(),
        filterIsActive: this.filterIsActive(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      return lastValueFrom(this.locationService.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['location-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.locationService.getById(this.editItem()!.id)),
  }));

  /** Danh sách kho cho dropdown lọc + form. */
  warehouseQuery = injectQuery(() => ({
    queryKey: ['warehouses-all'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
  }));

  /** Danh sách danh mục sản phẩm cho dropdown "danh mục được phép" trong form. */
  categoryQuery = injectQuery(() => ({
    queryKey: ['product-categories-all'],
    queryFn: () => lastValueFrom(this.categoryService.getAll()),
  }));

  // 4. Computed
  rows = computed<LocationRow[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });

  totalRecords = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  warehouses = computed<{ id: number; code: string; name: string }[]>(() => {
    const res = this.warehouseQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data ?? [];
    return Array.isArray(r) ? r : [];
  });

  warehouseOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({ id: w.id, name: w.name }))
  );

  /** Options danh mục sản phẩm (lấy từ API getAll product category). */
  categoryOptions = computed<FilterSelectOption[]>(() => {
    const res = this.categoryQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data ?? [];
    return (Array.isArray(r) ? r : []).map((c: any) => ({
      id: c.id,
      name: c.name,
    }));
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  activeCount = computed(() => this.rows().filter((x) => x.isActive).length);
  inactiveCount = computed(() => this.rows().filter((x) => !x.isActive).length);

  activeFilterCount = computed(
    () =>
      (this.filterWarehouseId() != null ? 1 : 0) +
      (this.filterZoneName() ? 1 : 0) +
      (this.filterSlotCode() ? 1 : 0) +
      (this.filterIsActive() != null ? 1 : 0) +
      (this.dateFrom() ? 1 : 0) +
      (this.dateTo() ? 1 : 0)
  );

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: LocationDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      warehouseId: detail.warehouseId ?? null,
      zoneName: detail.zoneName || '',
      shelfRow: detail.shelfRow || '',
      shelfLevel: detail.shelfLevel || '',
      slotCode: detail.slotCode || '',
      maxCapacity: detail.maxCapacity ?? null,
      currentOccupancy: detail.currentOccupancy ?? 0,
      priority: detail.priority ?? 0,
      allowedCategoryId: detail.allowedCategoryId ?? null,
      isQuarantine: detail.isQuarantine ?? false,
      description: detail.description || '',
      isActive: detail.isActive ?? true,
    });
  });

  // 5. Mutations
  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateLocationDto) =>
      lastValueFrom(this.locationService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['locations'] });
        this.showAlert('Thêm vị trí lưu trữ thành công!');
      } else {
        this.showAlert(res.message || 'Thêm thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(
        err?.error?.message || err?.errors?.message || 'Lỗi hệ thống',
        false
      ),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateLocationDto) =>
      lastValueFrom(this.locationService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['locations'] });
        this.showAlert('Cập nhật vị trí lưu trữ thành công!');
      } else {
        this.showAlert(res.message || 'Cập nhật thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(
        err?.error?.message || err?.errors?.message || 'Lỗi hệ thống',
        false
      ),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.locationService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['locations'] });
        this.showAlert('Đã xóa vị trí lưu trữ!');
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

  // 6. Table helpers
  onSearch(): void {
    this.page.set(1);
  }

  toggleFilter(): void {
    this.showFilter.update((v) => !v);
  }

  applyFilter(): void {
    this.page.set(1);
  }

  clearFilter(): void {
    this.filterWarehouseId.set(null);
    this.filterZoneName.set(null);
    this.filterSlotCode.set(null);
    this.filterIsActive.set(null);
    this.dateFrom.set(null);
    this.dateTo.set(null);
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

  // 7. Modal helpers
  openCreate(): void {
    this.editItem.set(null);
    this.form.set({
      warehouseId: this.warehouses()[0]?.id ?? null,
      zoneName: '',
      shelfRow: '',
      shelfLevel: '',
      slotCode: '',
      maxCapacity: null,
      currentOccupancy: 0,
      priority: 0,
      allowedCategoryId: null,
      isQuarantine: false,
      description: '',
      isActive: true,
    });
    this.showModal.set(true);
  }

  openEdit(row: LocationRow): void {
    this.editItem.set(row);
    this.form.set({
      warehouseId: row.warehouseId ?? null,
      zoneName: row.zoneName || '',
      shelfRow: row.shelfRow || '',
      shelfLevel: row.shelfLevel || '',
      slotCode: row.slotCode || '',
      maxCapacity: row.maxCapacity ?? null,
      currentOccupancy: 0,
      priority: 0,
      allowedCategoryId: null,
      isQuarantine: false,
      description: row.description || '',
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

  // 8. Save / delete
  save(): void {
    const f = this.form();

    if (!f.warehouseId) {
      this.showAlert('Vui lòng chọn Kho hàng', false);
      return;
    }
    if (!f.zoneName?.trim()) {
      this.showAlert('Vui lòng nhập Tên khu vực', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';

    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} vị trí lưu trữ này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#4f46e5',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const toNum = (v: any): number | null => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const base: CreateLocationDto = {
        warehouseId: Number(f.warehouseId),
        zoneName: f.zoneName.trim(),
        shelfRow: f.shelfRow?.trim() || null,
        shelfLevel: f.shelfLevel?.trim() || null,
        slotCode: f.slotCode?.trim() || null,
        maxCapacity: toNum(f.maxCapacity),
        description: f.description?.trim() || null,
        isActive: !!f.isActive,
        currentOccupancy: toNum(f.currentOccupancy) ?? 0,
        allowedCategoryId: toNum(f.allowedCategoryId),
        priority: toNum(f.priority) ?? 0,
        isQuarantine: !!f.isQuarantine,
      };

      if (this.isEdit()) {
        const payload: UpdateLocationDto = { ...base, id: this.editItem()!.id };
        this.updateMutation.mutate(payload);
      } else {
        this.createMutation.mutate(base);
      }
    });
  }

  delete(id: number, zoneName: string): void {
    Swal.fire({
      title: 'Xóa vị trí lưu trữ?',
      text: `Bạn có chắc muốn xóa "${zoneName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteMutation.mutate(id);
      }
    });
  }

  private showAlert(message: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: message,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#4f46e5',
    });
  }
}
