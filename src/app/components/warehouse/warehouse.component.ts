import { Component, signal, inject, computed, effect } from '@angular/core';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';

import {
  WarehouseRow,
  WarehouseDetailDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  LocationRow,
  LocationDetailDto,
  CreateLocationDto,
  UpdateLocationDto,
  WarehouseLocationLine,
} from '../../models';
import { WarehouseService } from '../../services/warehouse.service';
import { LocationService } from '../../services/location.service';
import { ProductCategoryService } from '../../services/product-category.service';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

interface WhStat {
  zones: number;
  cap: number;
  occ: number;
}

/**
 * Màn hình "Kho hàng" (gộp Kho + Vị trí lưu trữ).
 *  - Phần trên: danh sách kho dạng thẻ (card) kèm số khu vực, sức chứa sử dụng.
 *  - Phần dưới: bảng "Danh sách khu vực kho" (vị trí lưu trữ) — lọc theo kho đang chọn.
 *    Thêm/sửa MỘT vị trí bằng popup riêng (đầy đủ các trường API, trừ currentOccupancy
 *    do hệ thống tự cập nhật theo độ lấp đầy). Sửa chỉ tác động đúng vị trí đó.
 *  - Popup thêm kho: thông tin 1 kho + danh sách vị trí seed nhanh -> tạo kho rồi
 *    createList vị trí. Popup sửa kho: chỉ sửa thông tin kho.
 */
@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [HasPermissionDirective, ReadonlyIfDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './warehouse.component.html',
  styleUrl: './warehouse.component.css',
})
export class WarehouseComponent {
  private warehouseService = inject(WarehouseService);
  private locationService = inject(LocationService);
  private categoryService = inject(ProductCategoryService);
  private queryClient = injectQueryClient();
  private router = inject(Router);

  /** Mở màn Bản đồ khu/cột. */
  goToMap(): void {
    this.router.navigate(['/admin/warehouse-map']);
  }

  // ===== 1. State bảng KHO (cards) =====
  whPage = signal(1);
  whPageSize = signal(6);
  whSearch = signal('');
  whSort = signal('createdDate_desc');
  whShowFilter = signal(false);
  whFilterName = signal<string | null>(null);
  whFilterCode = signal<string | null>(null);
  whFilterIsActive = signal<boolean | null>(null);
  whDateFrom = signal<string | null>(null);
  whDateTo = signal<string | null>(null);

  readonly whSortOptions: FilterSelectOption[] = [
    { id: 'createdDate_desc', name: 'Mới nhất' },
    { id: 'createdDate_asc', name: 'Cũ nhất' },
    { id: 'name_asc', name: 'Tên A → Z' },
    { id: 'name_desc', name: 'Tên Z → A' },
    { id: 'code_asc', name: 'Mã kho A → Z' },
  ];

  readonly statusOptions = [
    { id: true, name: 'Đang hoạt động' },
    { id: false, name: 'Ngừng hoạt động' },
  ];

  readonly pageSizeOptions = [
    { id: 4, name: '4 / trang' },
    { id: 6, name: '6 / trang' },
    { id: 8, name: '8 / trang' },
    { id: 12, name: '12 / trang' },
  ];

  private readonly whColMap: Record<string, number> = {
    id: 0,
    code: 1,
    name: 2,
    address: 3,
    isActive: 4,
    createdDate: 5,
  };

  private whSortParts = computed(() => {
    const [field, dir] = this.whSort().split('_');
    return { field, dir: (dir as 'asc' | 'desc') ?? 'desc' };
  });

  // ===== 2. State bảng VỊ TRÍ (locations) =====
  selectedWarehouseId = signal<number | null>(null); // kho đang xem (click card)
  locPage = signal(1);
  locPageSize = signal(10);
  locSearch = signal('');
  locSortField = signal('createdDate');
  locSortDir = signal<'asc' | 'desc'>('desc');
  locShowFilter = signal(false);
  locFilterWarehouseId = signal<number | null>(null);
  locFilterZoneName = signal<string | null>(null);
  locFilterSlotCode = signal<string | null>(null);
  locFilterIsActive = signal<boolean | null>(null);
  locDateFrom = signal<string | null>(null);
  locDateTo = signal<string | null>(null);

  readonly locPageSizeOptions = [
    { id: 5, name: '5 / trang' },
    { id: 10, name: '10 / trang' },
    { id: 20, name: '20 / trang' },
    { id: 50, name: '50 / trang' },
  ];

  private readonly locColMap: Record<string, number> = {
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

  /** Kho lọc hiệu lực cho bảng vị trí = kho đang chọn (card) hoặc bộ lọc dropdown. */
  effectiveWarehouseId = computed(
    () => this.selectedWarehouseId() ?? this.locFilterWarehouseId()
  );

  // ===== 3. Queries =====
  warehouseListQuery = injectQuery(() => ({
    queryKey: [
      'warehouses',
      this.whPage(),
      this.whPageSize(),
      this.whSearch(),
      this.whSort(),
      this.whFilterName(),
      this.whFilterCode(),
      this.whFilterIsActive(),
      this.whDateFrom(),
      this.whDateTo(),
    ],
    queryFn: () => {
      const parts = this.whSortParts();
      const body = this.warehouseService.buildPagedBody({
        page: this.whPage(),
        pageSize: this.whPageSize(),
        search: this.whSearch(),
        sortField: parts.field,
        sortDir: parts.dir,
        colMap: this.whColMap,
        filterName: this.whFilterName(),
        filterCode: this.whFilterCode(),
        filterIsActive: this.whFilterIsActive(),
        dateFrom: this.whDateFrom(),
        dateTo: this.whDateTo(),
      });
      return lastValueFrom(this.warehouseService.getPagedAdvanced(body));
    },
  }));

  locationListQuery = injectQuery(() => ({
    queryKey: [
      'locations',
      this.locPage(),
      this.locPageSize(),
      this.locSearch(),
      this.locSortField(),
      this.locSortDir(),
      this.effectiveWarehouseId(),
      this.locFilterZoneName(),
      this.locFilterSlotCode(),
      this.locFilterIsActive(),
      this.locDateFrom(),
      this.locDateTo(),
    ],
    queryFn: () => {
      const body = this.locationService.buildPagedBody({
        page: this.locPage(),
        pageSize: this.locPageSize(),
        search: this.locSearch(),
        sortField: this.locSortField(),
        sortDir: this.locSortDir(),
        colMap: this.locColMap,
        filterWarehouseId: this.effectiveWarehouseId(),
        filterZoneName: this.locFilterZoneName(),
        filterSlotCode: this.locFilterSlotCode(),
        filterIsActive: this.locFilterIsActive(),
        dateFrom: this.locDateFrom(),
        dateTo: this.locDateTo(),
      });
      return lastValueFrom(this.locationService.getPagedAdvanced(body));
    },
  }));

  /** Toàn bộ kho (cho dropdown lọc + chọn kho khi thêm vị trí). */
  warehouseAllQuery = injectQuery(() => ({
    queryKey: ['warehouses-all'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
  }));

  /** Toàn bộ vị trí (để tính số khu vực + sức chứa cho từng thẻ kho). */
  allLocationsQuery = injectQuery(() => ({
    queryKey: ['locations-all'],
    queryFn: () => lastValueFrom(this.locationService.getAll()),
  }));

  /** Danh mục sản phẩm (cho dropdown "Danh mục cho phép" trong popup vị trí). */
  categoryQuery = injectQuery(() => ({
    queryKey: ['product-categories-all'],
    queryFn: () => lastValueFrom(this.categoryService.getAll()),
  }));

  // ===== 4. Computed =====
  private unwrap(res: any): any {
    return res?.resources ?? res?.data;
  }

  warehouses = computed<WarehouseRow[]>(() => {
    const r = this.unwrap(this.warehouseListQuery.data());
    return r?.data ?? [];
  });

  totalWarehouses = computed<number>(() => {
    const r = this.unwrap(this.warehouseListQuery.data());
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  locations = computed<LocationRow[]>(() => {
    const r = this.unwrap(this.locationListQuery.data());
    return r?.data ?? [];
  });

  totalLocations = computed<number>(() => {
    const r = this.unwrap(this.locationListQuery.data());
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  warehousesAll = computed<WarehouseRow[]>(() => {
    const r = this.unwrap(this.warehouseAllQuery.data()) ?? [];
    return Array.isArray(r) ? r : [];
  });

  warehouseOptions = computed<FilterSelectOption[]>(() =>
    this.warehousesAll().map((w) => ({ id: w.id, name: w.name }))
  );

  categoryOptions = computed<FilterSelectOption[]>(() => {
    const r = this.unwrap(this.categoryQuery.data()) ?? [];
    return (Array.isArray(r) ? r : []).map((c: any) => ({
      id: c.id,
      name: c.name,
    }));
  });

  allLocations = computed<any[]>(() => {
    const r = this.unwrap(this.allLocationsQuery.data()) ?? [];
    return Array.isArray(r) ? r : [];
  });

  /** Map kho -> { số khu vực, tổng sức chứa, đang chứa }. */
  statsMap = computed<Map<number, WhStat>>(() => {
    const m = new Map<number, WhStat>();
    for (const l of this.allLocations()) {
      const cur = m.get(l.warehouseId) ?? { zones: 0, cap: 0, occ: 0 };
      cur.zones += 1;
      cur.cap += l.maxCapacity ?? 0;
      cur.occ += l.currentOccupancy ?? 0;
      m.set(l.warehouseId, cur);
    }
    return m;
  });

  loadingWh = computed(() => this.warehouseListQuery.isPending());
  loadingLoc = computed(() => this.locationListQuery.isPending());

  whActiveFilterCount = computed(
    () =>
      (this.whFilterName() ? 1 : 0) +
      (this.whFilterCode() ? 1 : 0) +
      (this.whFilterIsActive() != null ? 1 : 0) +
      (this.whDateFrom() ? 1 : 0) +
      (this.whDateTo() ? 1 : 0)
  );

  locActiveFilterCount = computed(
    () =>
      (this.locFilterWarehouseId() != null ? 1 : 0) +
      (this.locFilterZoneName() ? 1 : 0) +
      (this.locFilterSlotCode() ? 1 : 0) +
      (this.locFilterIsActive() != null ? 1 : 0) +
      (this.locDateFrom() ? 1 : 0) +
      (this.locDateTo() ? 1 : 0)
  );

  selectedWarehouseName = computed(() => {
    const id = this.selectedWarehouseId();
    if (id == null) return null;
    const w =
      this.warehouses().find((x) => x.id === id) ??
      this.warehousesAll().find((x) => x.id === id);
    return w?.name ?? `#${id}`;
  });

  // ===== 5. Helpers hiển thị thẻ kho =====
  statOf(id: number): WhStat {
    return this.statsMap().get(id) ?? { zones: 0, cap: 0, occ: 0 };
  }

  fillPct(id: number): number {
    const s = this.statOf(id);
    return s.cap > 0 ? Math.round((s.occ / s.cap) * 100) : 0;
  }

  fillClass(pct: number): string {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'orange';
    return 'green';
  }

  whStatus(row: WarehouseRow): { label: string; cls: string } {
    if (!row.isActive) return { label: 'Tạm ngưng', cls: 'gray' };
    if (this.fillPct(row.id) >= 90) return { label: 'Gần đầy', cls: 'orange' };
    return { label: 'Hoạt động', cls: 'green' };
  }

  rowFill(r: LocationRow): number {
    const cap = r.maxCapacity ?? 0;
    const occ = r.currentOccupancy ?? 0;
    return cap > 0 ? Math.round((occ / cap) * 100) : 0;
  }

  // ===== 6. Toolbar KHO =====
  onWhSearch(): void {
    this.whPage.set(1);
  }
  toggleWhFilter(): void {
    this.whShowFilter.update((v) => !v);
  }
  applyWhFilter(): void {
    this.whPage.set(1);
  }
  clearWhFilter(): void {
    this.whFilterName.set(null);
    this.whFilterCode.set(null);
    this.whFilterIsActive.set(null);
    this.whDateFrom.set(null);
    this.whDateTo.set(null);
    this.whPage.set(1);
  }
  whTotalPages(): number {
    return Math.ceil(this.totalWarehouses() / this.whPageSize());
  }
  whVisiblePages(): number[] {
    return this.buildPages(this.whPage(), this.whTotalPages());
  }
  setWhPage(p: number): void {
    if (p < 1 || p > this.whTotalPages()) return;
    this.whPage.set(p);
  }

  // ===== 7. Card select =====
  selectWarehouse(id: number): void {
    this.selectedWarehouseId.update((cur) => (cur === id ? null : id));
    this.locPage.set(1);
  }
  clearSelectedWarehouse(): void {
    this.selectedWarehouseId.set(null);
    this.locPage.set(1);
  }

  // ===== 8. Toolbar VỊ TRÍ =====
  onLocSearch(): void {
    this.locPage.set(1);
  }
  toggleLocFilter(): void {
    this.locShowFilter.update((v) => !v);
  }
  applyLocFilter(): void {
    this.locPage.set(1);
  }
  clearLocFilter(): void {
    this.locFilterWarehouseId.set(null);
    this.locFilterZoneName.set(null);
    this.locFilterSlotCode.set(null);
    this.locFilterIsActive.set(null);
    this.locDateFrom.set(null);
    this.locDateTo.set(null);
    this.locPage.set(1);
  }
  locSort(field: string): void {
    if (this.locSortField() === field) {
      this.locSortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.locSortField.set(field);
      this.locSortDir.set('asc');
    }
    this.locPage.set(1);
  }
  locSortIcon(field: string): string {
    if (this.locSortField() !== field) return '⇅';
    return this.locSortDir() === 'asc' ? '▲' : '▼';
  }
  locTotalPages(): number {
    return Math.ceil(this.totalLocations() / this.locPageSize());
  }
  locVisiblePages(): number[] {
    return this.buildPages(this.locPage(), this.locTotalPages());
  }
  setLocPage(p: number): void {
    if (p < 1 || p > this.locTotalPages()) return;
    this.locPage.set(p);
  }

  private buildPages(cur: number, total: number): number[] {
    const d = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) {
      pages.push(i);
    }
    return pages;
  }

  // ===== 9. Popup KHO (thêm kho + danh sách vị trí seed / sửa thông tin kho) =====
  showModal = signal(false);
  editItem = signal<WarehouseRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEdit() && !this.perm.canUpdate('WAREHOUSES'));
  locViewOnly = computed(() => this.isLocEdit() && !this.perm.canUpdate('WAREHOUSES'));
  saving = signal(false);

  form = signal<{
    code: string;
    name: string;
    address: string;
    description: string;
    isActive: boolean;
    locations: WarehouseLocationLine[];
  }>({
    code: '',
    name: '',
    address: '',
    description: '',
    isActive: true,
    locations: [],
  });

  detailQuery = injectQuery(() => ({
    queryKey: ['warehouse-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.warehouseService.getById(this.editItem()!.id)),
  }));

  loadingDetail = computed(() => this.isEdit() && this.detailQuery.isFetching());

  /** Khi mở popup sửa kho: đổ thông tin kho từ chi tiết. */
  private syncDetail = effect(() => {
    if (!this.showModal() || !this.isEdit()) return;
    const d = this.unwrap(this.detailQuery.data()) as WarehouseDetailDto;
    if (!d) return;
    this.form.update((f) => ({
      ...f,
      code: d.code || '',
      name: d.name || '',
      address: d.address || '',
      description: d.description || '',
      isActive: d.isActive ?? true,
    }));
  });

  openCreate(): void {
    this.editItem.set(null);
    this.form.set({
      code: '',
      name: '',
      address: '',
      description: '',
      isActive: true,
      locations: [],
    });
    this.showModal.set(true);
  }

  openEditWarehouse(row: WarehouseRow): void {
    this.editItem.set(row);
    this.form.set({
      code: row.code || '',
      name: row.name || '',
      address: row.address || '',
      description: row.description || '',
      isActive: row.isActive ?? true,
      locations: [],
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

  // ----- Danh sách vị trí seed nhanh trong popup thêm kho -----
  addLine(): void {
    this.form.update((f) => ({
      ...f,
      locations: [
        ...f.locations,
        {
          zoneName: '',
          shelfRow: '',
          shelfLevel: '',
          slotCode: '',
          maxCapacity: null,
          currentOccupancy: 0,
          allowedCategoryId: null,
          priority: 0,
          isQuarantine: false,
          description: '',
          isActive: true,
        },
      ],
    }));
  }
  removeLine(index: number): void {
    this.form.update((f) => ({
      ...f,
      locations: f.locations.filter((_, i) => i !== index),
    }));
  }
  setLineField(index: number, field: keyof WarehouseLocationLine, value: any): void {
    this.form.update((f) => ({
      ...f,
      locations: f.locations.map((l, i) =>
        i === index ? { ...l, [field]: value } : l
      ),
    }));
  }

  private isLineEmpty(l: WarehouseLocationLine): boolean {
    return (
      !l.zoneName?.trim() &&
      !l.shelfRow?.toString().trim() &&
      !l.shelfLevel?.toString().trim() &&
      !l.slotCode?.toString().trim() &&
      (l.maxCapacity == null || l.maxCapacity === ('' as any))
    );
  }

  private toNum(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private lineToCreate(l: WarehouseLocationLine, warehouseId: number): CreateLocationDto {
    return {
      warehouseId,
      zoneName: l.zoneName.trim(),
      shelfRow: l.shelfRow?.toString().trim() || null,
      shelfLevel: l.shelfLevel?.toString().trim() || null,
      slotCode: l.slotCode?.toString().trim() || null,
      maxCapacity: this.toNum(l.maxCapacity),
      description: l.description?.toString().trim() || null,
      isActive: l.isActive ?? true,
      currentOccupancy: this.toNum(l.currentOccupancy) ?? 0,
      allowedCategoryId: this.toNum(l.allowedCategoryId),
      priority: this.toNum(l.priority) ?? 0,
      isQuarantine: !!l.isQuarantine,
    };
  }

  save(): void {
    const f = this.form();
    if (!f.code?.trim() || !f.name?.trim()) {
      this.showAlert('Vui lòng nhập Mã kho và Tên kho', false);
      return;
    }

    const lines = f.locations.filter((l) => !this.isLineEmpty(l));
    for (const l of lines) {
      if (!l.zoneName?.trim()) {
        this.showAlert('Mỗi vị trí lưu trữ phải có Tên khu vực', false);
        return;
      }
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    const locNote =
      !this.isEdit() && lines.length ? ` kèm ${lines.length} vị trí lưu trữ` : '';

    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} kho này${locNote} không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;
      if (this.isEdit()) {
        this.doUpdate(f);
      } else {
        this.doCreate(f, lines);
      }
    });
  }

  private async doCreate(f: any, lines: WarehouseLocationLine[]): Promise<void> {
    this.saving.set(true);
    try {
      const base: CreateWarehouseDto = {
        code: f.code.trim(),
        name: f.name.trim(),
        address: f.address?.trim() || null,
        description: f.description?.trim() || null,
        isActive: !!f.isActive,
      };

      const res: any = await lastValueFrom(this.warehouseService.create(base));
      if (!res?.isSucceeded) {
        this.showAlert(res?.message || 'Thêm kho thất bại', false);
        return;
      }

      const newId = Number(res.resources);
      if (lines.length && newId) {
        const payload = lines.map((l) => this.lineToCreate(l, newId));
        const r2: any = await lastValueFrom(
          this.locationService.createList(payload)
        );
        if (!r2?.isSucceeded) {
          this.showAlert(
            'Đã tạo kho nhưng thêm vị trí lưu trữ lỗi: ' + (r2?.message || ''),
            false
          );
          this.invalidateAll();
          this.closeModal();
          return;
        }
      }

      this.closeModal();
      this.invalidateAll();
      this.showAlert('Thêm kho thành công!');
    } catch (err: any) {
      this.showAlert(
        err?.error?.message || err?.errors?.message || 'Lỗi hệ thống',
        false
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async doUpdate(f: any): Promise<void> {
    this.saving.set(true);
    try {
      const base: UpdateWarehouseDto = {
        id: this.editItem()!.id,
        code: f.code.trim(),
        name: f.name.trim(),
        address: f.address?.trim() || null,
        description: f.description?.trim() || null,
        isActive: !!f.isActive,
      };

      const res: any = await lastValueFrom(this.warehouseService.update(base));
      if (!res?.isSucceeded) {
        this.showAlert(res?.message || 'Cập nhật kho thất bại', false);
        return;
      }

      this.closeModal();
      this.invalidateAll();
      this.showAlert('Cập nhật kho thành công!');
    } catch (err: any) {
      this.showAlert(
        err?.error?.message || err?.errors?.message || 'Lỗi hệ thống',
        false
      );
    } finally {
      this.saving.set(false);
    }
  }

  deleteWarehouse(row: WarehouseRow): void {
    Swal.fire({
      title: 'Xóa kho?',
      text: `Bạn có chắc muốn xóa "${row.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        const res: any = await lastValueFrom(
          this.warehouseService.delete(row.id)
        );
        if (res?.isSucceeded) {
          if (this.selectedWarehouseId() === row.id) {
            this.selectedWarehouseId.set(null);
          }
          this.invalidateAll();
          this.showAlert('Đã xóa kho!');
        } else {
          this.showAlert(res?.message || 'Xóa thất bại', false);
        }
      } catch (err: any) {
        this.showAlert(err?.error?.message || 'Lỗi xóa', false);
      }
    });
  }

  // ===== 10. Popup VỊ TRÍ (thêm/sửa MỘT vị trí — đầy đủ các trường) =====
  showLocModal = signal(false);
  editLoc = signal<LocationRow | null>(null);
  isLocEdit = computed(() => !!this.editLoc());
  savingLoc = signal(false);
  private locHydrated = signal(false);

  locForm = signal<{
    warehouseId: number | null;
    zoneName: string;
    shelfRow: string;
    shelfLevel: string;
    slotCode: string;
    maxCapacity: number | null;
    allowedCategoryId: number | null;
    priority: number | null;
    isQuarantine: boolean;
    description: string;
    isActive: boolean;
    currentOccupancy: number; // ẩn — hệ thống quản lý theo độ lấp đầy
  }>({
    warehouseId: null,
    zoneName: '',
    shelfRow: '',
    shelfLevel: '',
    slotCode: '',
    maxCapacity: null,
    allowedCategoryId: null,
    priority: 0,
    isQuarantine: false,
    description: '',
    isActive: true,
    currentOccupancy: 0,
  });

  locDetailQuery = injectQuery(() => ({
    queryKey: ['location-detail', this.editLoc()?.id],
    enabled: !!this.editLoc()?.id && this.showLocModal(),
    queryFn: () =>
      lastValueFrom(this.locationService.getById(this.editLoc()!.id)),
  }));

  loadingLocDetail = computed(
    () => this.isLocEdit() && !this.locHydrated()
  );

  /** Nạp đầy đủ các trường của vị trí đang sửa (gồm cả trường nâng cao không có ở bảng). */
  private syncLocDetail = effect(() => {
    if (!this.showLocModal() || !this.isLocEdit() || this.locHydrated()) return;
    const d = this.unwrap(this.locDetailQuery.data()) as LocationDetailDto;
    if (!d) return;
    this.locForm.set({
      warehouseId: d.warehouseId ?? null,
      zoneName: d.zoneName || '',
      shelfRow: d.shelfRow || '',
      shelfLevel: d.shelfLevel || '',
      slotCode: d.slotCode || '',
      maxCapacity: d.maxCapacity ?? null,
      allowedCategoryId: d.allowedCategoryId ?? null,
      priority: d.priority ?? 0,
      isQuarantine: d.isQuarantine ?? false,
      description: d.description || '',
      isActive: d.isActive ?? true,
      currentOccupancy: d.currentOccupancy ?? 0,
    });
    this.locHydrated.set(true);
  });

  /** Mở popup thêm MỘT khu/cột mới (prefill kho đang chọn nếu có). */
  openLocCreate(): void {
    this.editLoc.set(null);
    this.locHydrated.set(true);
    this.locForm.set({
      warehouseId: this.selectedWarehouseId() ?? null,
      zoneName: '',
      shelfRow: '',
      shelfLevel: '',
      slotCode: '',
      maxCapacity: null,
      allowedCategoryId: null,
      priority: 0,
      isQuarantine: false,
      description: '',
      isActive: true,
      currentOccupancy: 0,
    });
    this.showLocModal.set(true);
  }

  openLocEdit(row: LocationRow): void {
    this.editLoc.set(row);
    this.locHydrated.set(false);
    // Prefill nhanh từ dòng bảng; effect sẽ đổ đầy đủ khi có chi tiết.
    this.locForm.set({
      warehouseId: row.warehouseId ?? null,
      zoneName: row.zoneName || '',
      shelfRow: row.shelfRow || '',
      shelfLevel: row.shelfLevel || '',
      slotCode: row.slotCode || '',
      maxCapacity: row.maxCapacity ?? null,
      allowedCategoryId: null,
      priority: 0,
      isQuarantine: false,
      description: row.description || '',
      isActive: row.isActive ?? true,
      currentOccupancy: row.currentOccupancy ?? 0,
    });
    this.showLocModal.set(true);
  }

  closeLocModal(): void {
    this.showLocModal.set(false);
    this.editLoc.set(null);
    this.locHydrated.set(false);
  }

  setLocField(field: string, value: any): void {
    this.locForm.update((x) => ({ ...x, [field]: value }));
  }

  saveLoc(): void {
    const f = this.locForm();
    if (!f.warehouseId) {
      this.showAlert('Vui lòng chọn Kho hàng', false);
      return;
    }
    if (!f.zoneName?.trim()) {
      this.showAlert('Vui lòng nhập Tên khu vực', false);
      return;
    }

    const actionText = this.isLocEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} vị trí lưu trữ này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (result.isConfirmed) this.doSaveLoc(f);
    });
  }

  private async doSaveLoc(f: any): Promise<void> {
    this.savingLoc.set(true);
    try {
      const base: CreateLocationDto = {
        warehouseId: Number(f.warehouseId),
        zoneName: f.zoneName.trim(),
        shelfRow: f.shelfRow?.trim() || null,
        shelfLevel: f.shelfLevel?.trim() || null,
        slotCode: f.slotCode?.trim() || null,
        maxCapacity: this.toNum(f.maxCapacity),
        description: f.description?.trim() || null,
        isActive: !!f.isActive,
        // currentOccupancy do hệ thống quản lý: tạo mới = 0, sửa = giữ nguyên.
        currentOccupancy: this.isLocEdit() ? this.toNum(f.currentOccupancy) ?? 0 : 0,
        allowedCategoryId: this.toNum(f.allowedCategoryId),
        priority: this.toNum(f.priority) ?? 0,
        isQuarantine: !!f.isQuarantine,
      };

      let res: any;
      if (this.isLocEdit()) {
        const payload: UpdateLocationDto = { ...base, id: this.editLoc()!.id };
        res = await lastValueFrom(this.locationService.update(payload));
      } else {
        res = await lastValueFrom(this.locationService.create(base));
      }

      if (!res?.isSucceeded) {
        this.showAlert(res?.message || `${this.isLocEdit() ? 'Cập nhật' : 'Thêm'} thất bại`, false);
        return;
      }

      this.closeLocModal();
      this.invalidateAll();
      this.showAlert(
        this.isLocEdit()
          ? 'Cập nhật vị trí lưu trữ thành công!'
          : 'Thêm vị trí lưu trữ thành công!'
      );
    } catch (err: any) {
      this.showAlert(
        err?.error?.message || err?.errors?.message || 'Lỗi hệ thống',
        false
      );
    } finally {
      this.savingLoc.set(false);
    }
  }

  deleteLocation(row: LocationRow): void {
    Swal.fire({
      title: 'Xóa vị trí lưu trữ?',
      text: `Bạn có chắc muốn xóa "${row.zoneName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        const res: any = await lastValueFrom(
          this.locationService.delete(row.id)
        );
        if (res?.isSucceeded) {
          this.invalidateAll();
          this.showAlert('Đã xóa vị trí lưu trữ!');
        } else {
          this.showAlert(res?.message || 'Xóa thất bại', false);
        }
      } catch (err: any) {
        this.showAlert(err?.error?.message || 'Lỗi xóa', false);
      }
    });
  }

  private invalidateAll(): void {
    this.queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    this.queryClient.invalidateQueries({ queryKey: ['warehouses-all'] });
    this.queryClient.invalidateQueries({ queryKey: ['locations'] });
    this.queryClient.invalidateQueries({ queryKey: ['locations-all'] });
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
