import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';

import { InventoryRow } from '../../models';
import { WarehouseService } from '../../services/warehouse.service';
import { LocationService } from '../../services/location.service';
import { InventoryService } from '../../services/inventory.service';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

type SlotStatus =
  | 'available'
  | 'warning'
  | 'full'
  | 'quarantine'
  | 'locked'
  | 'empty';

interface MapSlot {
  id: number;
  slotCode: string;
  zoneName: string;
  maxCapacity: number;
  currentOccupancy: number;
  fillPct: number;
  isActive: boolean;
  isQuarantine: boolean;
  priority: number | null;
  // Làm giàu từ Inventory (ghép theo locationId)
  lotCode: string | null;
  productName: string | null;
  categoryName: string | null;
  bags: number;
  weightKg: number;
  quality: string | null;
  strategy: string | null;
  status: SlotStatus;
}

interface MapZone {
  name: string;
  slots: MapSlot[];
}

/**
 * Màn "Bản đồ khu/cột" — sơ đồ mặt phẳng nhìn từ trên xuống của kho.
 * - Dropdown lọc theo kho (thay cho nút "Gợi ý vị trí nhập kho").
 * - Mỗi ô = 1 cột/vị trí (Location), làm giàu bằng dữ liệu lô/tồn từ Inventory.
 * - Bấm ô để xem chi tiết ở panel bên phải.
 */
@Component({
  selector: 'app-warehouse-map',
  standalone: true,
  imports: [CommonModule, FilterSelectComponent],
  templateUrl: './warehouse-map.component.html',
  styleUrl: './warehouse-map.component.css',
})
export class WarehouseMapComponent {
  private warehouseService = inject(WarehouseService);
  private locationService = inject(LocationService);
  private inventoryService = inject(InventoryService);

  // ----- Bộ lọc -----
  warehouseId = signal<number | null>(null);
  selectedSlotId = signal<number | null>(null);

  private readonly invColMap: Record<string, number> = {
    lotCode: 0,
    categoryName: 1,
    warehouseName: 2,
    bags: 3,
    quantityOnHand: 4,
    quantityAvailable: 5,
    quantityReserved: 6,
    costPrice: 7,
    id: 8,
  };

  // ----- Queries -----
  private warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouses-all'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
    staleTime: 60_000,
  }));

  private locationsQuery = injectQuery(() => ({
    queryKey: ['locations-all'],
    queryFn: () => lastValueFrom(this.locationService.getAll()),
    staleTime: 30_000,
  }));

  private inventoryQuery = injectQuery(() => ({
    queryKey: ['inventories', 'map', this.warehouseId()],
    queryFn: () =>
      lastValueFrom(
        this.inventoryService.getPagedAdvanced(
          this.inventoryService.buildPagedBody({
            page: 1,
            pageSize: 1000,
            search: '',
            sortField: 'id',
            sortDir: 'asc',
            colMap: this.invColMap,
            warehouseId: this.warehouseId(),
          })
        )
      ),
  }));

  // ----- Unwrap -----
  private unwrap(res: any): any {
    return res?.resources ?? res?.data;
  }

  warehousesAll = computed<any[]>(() => {
    const r = this.unwrap(this.warehousesQuery.data()) ?? [];
    return Array.isArray(r) ? r : [];
  });

  warehouseOptions = computed<FilterSelectOption[]>(() =>
    this.warehousesAll().map((w) => ({ id: w.id, name: w.name }))
  );

  selectedWarehouse = computed(() => {
    const id = this.warehouseId();
    return this.warehousesAll().find((w) => w.id === id) ?? null;
  });

  private locationsAll = computed<any[]>(() => {
    const r = this.unwrap(this.locationsQuery.data()) ?? [];
    return Array.isArray(r) ? r : [];
  });

  private inventoryRows = computed<InventoryRow[]>(() => {
    const r = this.unwrap(this.inventoryQuery.data());
    return r?.data ?? [];
  });

  loading = computed(
    () =>
      this.locationsQuery.isPending() ||
      this.inventoryQuery.isPending()
  );

  /** Tự chọn kho đầu tiên khi danh sách kho tải xong. */
  private autoSelect = effect(() => {
    const list = this.warehousesAll();
    if (this.warehouseId() == null && list.length) {
      this.warehouseId.set(list[0].id);
    }
  });

  /** Gom tồn kho theo locationId để làm giàu từng ô. */
  private invByLocation = computed(() => {
    const map = new Map<
      number,
      { bags: number; weightKg: number; rows: InventoryRow[] }
    >();
    for (const inv of this.inventoryRows()) {
      const lid = inv.locationId;
      if (lid == null) continue;
      const cur = map.get(lid) ?? { bags: 0, weightKg: 0, rows: [] };
      cur.bags += Number(inv.bags ?? 0);
      cur.weightKg += Number(inv.totalWeightKg ?? 0);
      cur.rows.push(inv);
      map.set(lid, cur);
    }
    return map;
  });

  /** Các khu (zone) + ô (slot) của kho đang chọn. */
  zones = computed<MapZone[]>(() => {
    const wid = this.warehouseId();
    const locs = this.locationsAll().filter(
      (l) => wid == null || l.warehouseId === wid
    );
    const invMap = this.invByLocation();

    const zoneMap = new Map<string, MapSlot[]>();
    for (const l of locs) {
      const cap = Number(l.maxCapacity ?? 0);
      const occ = Number(l.currentOccupancy ?? 0);
      const fillPct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      const isActive = l.isActive ?? true;
      const isQuarantine = !!l.isQuarantine;

      const inv = invMap.get(l.id);
      const rep = inv?.rows?.[0];
      const quality = rep?.lotQualityStatus?.trim() || null;

      const slot: MapSlot = {
        id: l.id,
        slotCode: l.slotCode || l.zoneName || `#${l.id}`,
        zoneName: l.zoneName || '—',
        maxCapacity: cap,
        currentOccupancy: occ,
        fillPct,
        isActive,
        isQuarantine,
        priority: l.priority ?? null,
        lotCode: rep?.lotCode ?? null,
        productName: rep?.productVariantName ?? null,
        categoryName: rep?.categoryName ?? null,
        bags: inv?.bags ?? 0,
        weightKg: inv?.weightKg ?? 0,
        quality,
        strategy: this.strategyOf(isQuarantine, quality),
        status: this.computeStatus(isActive, isQuarantine, fillPct, inv?.weightKg ?? 0, quality),
      };

      const arr = zoneMap.get(slot.zoneName) ?? [];
      arr.push(slot);
      zoneMap.set(slot.zoneName, arr);
    }

    return Array.from(zoneMap.entries())
      .map(([name, slots]) => ({
        name,
        slots: slots.sort((a, b) => a.slotCode.localeCompare(b.slotCode)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  totalSlots = computed(() =>
    this.zones().reduce((n, z) => n + z.slots.length, 0)
  );

  selectedSlot = computed<MapSlot | null>(() => {
    const id = this.selectedSlotId();
    if (id == null) return null;
    for (const z of this.zones()) {
      const s = z.slots.find((x) => x.id === id);
      if (s) return s;
    }
    return null;
  });

  // ----- Trạng thái / màu ô -----
  private computeStatus(
    isActive: boolean,
    isQuarantine: boolean,
    fillPct: number,
    weightKg: number,
    quality: string | null
  ): SlotStatus {
    if (!isActive) return 'locked';
    const q = (quality || '').toLowerCase();
    if (isQuarantine || q.includes('cách ly') || q.includes('ẩm cao')) {
      return 'quarantine';
    }
    if (fillPct <= 0 && weightKg <= 0) return 'empty';
    if (fillPct >= 100) return 'full';
    if (fillPct >= 90 || q.includes('theo dõi') || q.includes('đóng bao')) {
      return 'warning';
    }
    return 'available';
  }

  private strategyOf(isQuarantine: boolean, quality: string | null): string {
    const q = (quality || '').toLowerCase();
    if (isQuarantine || q.includes('cách ly') || q.includes('ẩm cao')) {
      return 'Không đề xuất';
    }
    return 'Ưu tiên nhập';
  }

  statusLabel(s: SlotStatus): string {
    switch (s) {
      case 'available': return 'Còn chỗ';
      case 'warning': return 'Cảnh báo';
      case 'full': return 'Đầy';
      case 'quarantine': return 'Cách ly/rủi ro';
      case 'locked': return 'Khóa';
      default: return 'Trống';
    }
  }

  // ----- Tương tác -----
  onWarehouseChange(id: number | null): void {
    this.warehouseId.set(id != null ? Number(id) : null);
    this.selectedSlotId.set(null);
  }

  selectSlot(id: number): void {
    this.selectedSlotId.update((cur) => (cur === id ? null : id));
  }

  // ----- Định dạng -----
  fmtNum(n: number | null | undefined, digits = 0): string {
    const v = Number(n ?? 0);
    return v.toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  trackZone = (_: number, z: MapZone) => z.name;
  trackSlot = (_: number, s: MapSlot) => s.id;
}
