import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  keepPreviousData,
  QueryClient,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';

import { ApiResponse, DTResponse } from '../../models/common';
import {
  PaddyLotDetailDto,
  PaddyLotRow,
  PaddyLotStatusOption,
  PaddyLotSummary,
} from '../../models/paddy-lot';
import { LocationRow } from '../../models/location';
import { WarehouseRow } from '../../models/warehouse';
import { LocationService } from '../../services/location.service';
import { PaddyLotService } from '../../services/paddy-lot.service';
import { WarehouseService } from '../../services/warehouse.service';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

@Component({
  selector: 'app-paddy-lot',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './paddy-lot.component.html',
  styleUrl: './paddy-lot.component.css',
})
export class PaddyLotComponent implements OnDestroy {
  private readonly lotService = inject(PaddyLotService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly locationService = inject(LocationService);
  private readonly queryClient = inject(QueryClient);

  readonly pageSize = 10;
  readonly page = signal(1);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly lotType = signal<string | null>(null);
  readonly warehouseId = signal<number | null>(null);
  readonly statusId = signal<number | null>(null);
  readonly selectedLotId = signal<number | null>(null);
  readonly sortField = signal('createdDate');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly lotTypes = [
    { value: 'PADDY', label: 'Lúa' },
    { value: 'RICE', label: 'Gạo' },
    { value: 'BYPRODUCT', label: 'Phụ phẩm' },
  ];

  /** Trùng dữ liệu seed LotStatus hiện tại của backend. */
  readonly statuses: PaddyLotStatusOption[] = [
    { id: 1, name: 'Chờ nhập', color: '#6B7280', isSellable: false },
    { id: 2, name: 'Đang lưu kho', color: '#10B981', isSellable: true },
    { id: 3, name: 'Chờ xử lý', color: '#F59E0B', isSellable: false },
    { id: 4, name: 'Cách ly', color: '#EF4444', isSellable: false },
    { id: 5, name: 'Đang xay', color: '#8B5CF6', isSellable: false },
    { id: 6, name: 'Đã dùng hết', color: '#9CA3AF', isSellable: false },
  ];

  private readonly warehousesQuery = injectQuery(() => ({
    queryKey: ['paddy-lots', 'warehouses'],
    queryFn: async () =>
      this.unwrapList<WarehouseRow>(
        await lastValueFrom(this.warehouseService.getAll()),
        'Không tải được danh sách kho.'
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly locationsQuery = injectQuery(() => ({
    queryKey: ['paddy-lots', 'locations'],
    queryFn: async () =>
      this.unwrapList<LocationRow>(
        await lastValueFrom(this.locationService.getAll()),
        'Không tải được danh sách vị trí.'
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly summaryQuery = injectQuery(() => ({
    queryKey: ['paddy-lots', 'summary'],
    queryFn: async () => {
      const response = await lastValueFrom(
        this.lotService.getPagedAdvanced(
          this.lotService.buildPagedBody({
            page: 1,
            pageSize: 10_000,
            sortField: 'createdDate',
            sortDir: 'desc',
          })
        )
      );
      return this.unwrap<DTResponse<PaddyLotRow>>(
        response,
        'Không tải được số liệu tổng hợp lô.'
      ).data || [];
    },
    staleTime: 30_000,
  }));

  private readonly lotsQuery = injectQuery(() => ({
    queryKey: [
      'paddy-lots',
      'paged',
      this.page(),
      this.search(),
      this.lotType(),
      this.warehouseId(),
      this.statusId(),
      this.sortField(),
      this.sortDir(),
    ],
    queryFn: async () =>
      this.unwrap<DTResponse<PaddyLotRow>>(
        await lastValueFrom(
          this.lotService.getPagedAdvanced(
            this.lotService.buildPagedBody({
              page: this.page(),
              pageSize: this.pageSize,
              search: this.search(),
              lotType: this.lotType(),
              warehouseId: this.warehouseId(),
              statusId: this.statusId(),
              sortField: this.sortField(),
              sortDir: this.sortDir(),
            })
          )
        ),
        'Không tải được danh sách lô.'
      ),
    placeholderData: keepPreviousData,
  }));

  readonly rows = computed(() => this.lotsQuery.data()?.data || []);
  readonly total = computed(() =>
    Number(
      this.lotsQuery.data()?.recordsFiltered ??
        this.lotsQuery.data()?.recordsTotal ??
        0
    )
  );
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize))
  );
  readonly activeLotId = computed(
    () => this.selectedLotId() ?? this.rows()[0]?.id ?? null
  );

  private readonly detailQuery = injectQuery(() => ({
    queryKey: ['paddy-lots', 'detail', this.activeLotId()],
    enabled: this.activeLotId() != null,
    queryFn: async () => {
      const id = this.activeLotId();
      if (id == null) throw new Error('Chưa chọn lô.');
      return this.unwrap<PaddyLotDetailDto>(
        await lastValueFrom(this.lotService.getById(id)),
        'Không tải được chi tiết lô.'
      );
    },
  }));

  readonly selectedLot = computed<PaddyLotDetailDto | PaddyLotRow | null>(() => {
    const row = this.rows().find((item) => item.id === this.activeLotId());
    const detail = this.detailQuery.data();
    if (!detail) return row || null;

    // GetById hiện chưa Include RiceVariety, nên giữ tên giống từ dòng aggregate.
    return {
      ...row,
      ...detail,
      riceVarietyName: detail.riceVarietyName ?? row?.riceVarietyName ?? null,
      sku: detail.sku ?? row?.sku ?? null,
      productVariantName:
        detail.productVariantName ?? row?.productVariantName ?? null,
    };
  });
  readonly warehouses = computed(() => this.warehousesQuery.data() || []);

  // ---- Options cho dropdown dùng chung (app-filter-select) ----
  readonly lotTypeOptions: FilterSelectOption[] = this.lotTypes.map((t) => ({
    id: t.value,
    name: t.label,
  }));
  readonly statusOptions: FilterSelectOption[] = this.statuses.map((s) => ({
    id: s.id,
    name: s.name,
  }));
  readonly warehouseOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({ id: w.id, name: w.name }))
  );
  readonly locations = computed(() => this.locationsQuery.data() || []);
  readonly loading = computed(() => this.lotsQuery.isPending());
  readonly loadingDetail = computed(() => this.detailQuery.isPending());
  readonly errorMessage = computed(() =>
    this.lotsQuery.isError() ? this.errorText(this.lotsQuery.error()) : ''
  );

  readonly summary = computed<PaddyLotSummary>(() => {
    const rows = this.summaryQuery.data() || [];
    return rows.reduce<PaddyLotSummary>(
      (acc, row) => {
        acc.totalLots += 1;
        const remaining = Number(row.remainingWeightKg || 0);
        const type = (row.lotType || '').toUpperCase();
        if (type === 'PADDY') acc.totalPaddyKg += remaining;
        if (type === 'RICE') acc.totalRiceKg += remaining;
        if (this.isAttentionLot(row)) acc.attentionLots += 1;
        return acc;
      },
      { totalLots: 0, totalPaddyKg: 0, totalRiceKg: 0, attentionLots: 0 }
    );
  });

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  onSearch(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.selectedLotId.set(null);
      this.search.set(value.trim());
    }, 350);
  }

  setLotType(value: string): void {
    this.lotType.set(value || null);
    this.resetPageAndSelection();
  }

  setWarehouse(value: string): void {
    this.warehouseId.set(value ? Number(value) : null);
    this.resetPageAndSelection();
  }

  setStatus(value: string): void {
    this.statusId.set(value ? Number(value) : null);
    this.resetPageAndSelection();
  }

  selectLot(id: number): void {
    this.selectedLotId.set(id);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.selectedLotId.set(null);
  }

  sortBy(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
  }

  async refresh(): Promise<void> {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: ['paddy-lots', 'paged'] }),
      this.queryClient.invalidateQueries({ queryKey: ['paddy-lots', 'summary'] }),
      this.queryClient.invalidateQueries({ queryKey: ['paddy-lots', 'detail'] }),
    ]);
  }

  locationLabel(locationId: number | null | undefined): string {
    if (!locationId) return 'Chưa xếp vị trí';
    const location = this.locations().find((item) => item.id === locationId);
    if (!location) return `Vị trí #${locationId}`;
    return [
      location.zoneName,
      location.shelfRow ? `Cột ${location.shelfRow}` : '',
      location.shelfLevel ? `Lớp ${location.shelfLevel}` : '',
      location.slotCode || '',
    ]
      .filter(Boolean)
      .join(' / ');
  }

  typeLabel(value: string | null | undefined): string {
    switch ((value || '').toUpperCase()) {
      case 'PADDY':
        return 'Lúa';
      case 'RICE':
        return 'Gạo';
      case 'BYPRODUCT':
        return 'Phụ phẩm';
      default:
        return value || '—';
    }
  }

  typeClass(value: string | null | undefined): string {
    switch ((value || '').toUpperCase()) {
      case 'PADDY':
        return 'type-paddy';
      case 'RICE':
        return 'type-rice';
      default:
        return 'type-byproduct';
    }
  }

  statusColor(row: PaddyLotRow): string {
    return (
      this.statuses.find((status) => status.id === row.statusId)?.color ||
      '#6B7280'
    );
  }

  statusLabel(row: PaddyLotRow): string {
    return (
      row.statusName ||
      this.statuses.find((status) => status.id === row.statusId)?.name ||
      'Chưa xác định'
    );
  }

 qualityLabel(value: string | null | undefined): string {
  if (!value) return 'Chưa kiểm tra';

  switch (value.toUpperCase()) {
    case 'PASSED':
      return 'Đạt';
    case 'FAILED':
      return 'Không đạt';
    case 'PENDING':
      return 'Chờ kiểm tra';
  }

  try {
    const quality = JSON.parse(value);
    const grade = quality.grade || 'Chưa đánh giá';

    return quality.moisturePercent != null
      ? `${grade} · Độ ẩm ${quality.moisturePercent}%`
      : grade;
  } catch {
    return value;
  }
}

  qualityClass(value: string | null | undefined): string {
    switch ((value || '').toUpperCase()) {
      case 'PASSED':
        return 'quality-passed';
      case 'FAILED':
        return 'quality-failed';
      default:
        return 'quality-pending';
    }
  }

  sourceLabel(row: PaddyLotRow): string {
    if (row.sourceReceiptId) return `Phiếu mua #${row.sourceReceiptId}`;
    if (row.sourceMillingOrderId) return `Lệnh xay #${row.sourceMillingOrderId}`;
    return 'Tạo trực tiếp';
  }

  fmtNumber(value: number | null | undefined, digits = 0): string {
    return Number(value || 0).toLocaleString('vi-VN', {
      maximumFractionDigits: digits,
    });
  }

  fmtWeight(value: number | null | undefined): string {
    return `${this.fmtNumber(value, 2)} kg`;
  }

  fmtTon(value: number | null | undefined): string {
    return `${this.fmtNumber(Number(value || 0) / 1000, 1)} t`;
  }

  fmtMoney(value: number | null | undefined): string {
    return `${this.fmtNumber(value, 0)}đ`;
  }

  fmtDate(value: string | null | undefined, includeTime = false): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(includeTime
        ? ({ hour: '2-digit', minute: '2-digit' } as const)
        : {}),
    }).format(date);
  }

  private resetPageAndSelection(): void {
    this.page.set(1);
    this.selectedLotId.set(null);
  }

  private isAttentionLot(row: PaddyLotRow): boolean {
    const quality = (row.qualityStatus || '').toUpperCase();
    return [3, 4].includes(row.statusId) || quality === 'FAILED';
  }

  private unwrap<T>(response: ApiResponse<T>, fallback: string): T {
    if (!response || response.isSucceeded === false) {
      throw new Error(response?.message || fallback);
    }
    return response.resources;
  }

  private unwrapList<T>(response: ApiResponse<any>, fallback: string): T[] {
    const resources = this.unwrap<any>(response, fallback);
    if (Array.isArray(resources)) return resources as T[];
    return (resources?.data || resources?.items || []) as T[];
  }

  private errorText(error: unknown): string {
    const value = error as any;
    return (
      value?.error?.message ||
      value?.message ||
      'Không tải được dữ liệu lô. Vui lòng thử lại.'
    );
  }
}
