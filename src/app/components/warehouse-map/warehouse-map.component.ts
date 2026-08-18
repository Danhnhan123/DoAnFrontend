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
  | 'staging'
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
  isOutboundStaging: boolean;
  outboundOrderCode: string | null;
  priority: number | null;
  // Làm giàu từ Inventory (ghép theo locationId)
  lotCode: string | null;
  productName: string | null;
  categoryName: string | null;
  bags: number;
  openBags: number;
  hasPhysicalBagData: boolean;
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
      { bags: number; openBags: number; weightKg: number; rows: InventoryRow[]; hasPhysicalBagData: boolean }
    >();
    for (const inv of this.inventoryRows()) {
      const lid = inv.locationId;
      if (lid == null) continue;
      const cur = map.get(lid) ?? {
        bags: 0,
        openBags: 0,
        weightKg: 0,
        rows: [],
        hasPhysicalBagData: true,
      };
      cur.bags += Number(inv.bags ?? 0);
      cur.openBags += Number(inv.openBags ?? 0);
      cur.weightKg += Number(inv.totalWeightKg ?? 0);
      if (Number(inv.totalWeightKg ?? 0) > 0 && !inv.hasPhysicalBagData) {
        cur.hasPhysicalBagData = false;
      }
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
      const inv = invMap.get(l.id);
      // Bản đồ phản ánh tồn thực tế. CurrentOccupancy cũ có thể bị lệch do dữ liệu
      // trước thời điểm quản lý bao vật lý.
      const occ = inv ? inv.weightKg : Number(l.currentOccupancy ?? 0);
      const fillPct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      const isActive = l.isActive ?? true;
      const isQuarantine = !!l.isQuarantine;
      const isOutboundStaging = !!l.isOutboundStaging;

      const rep = inv?.rows?.[0];
      const distinctLots = new Set((inv?.rows ?? []).map(x => x.lotCode).filter(Boolean));
      const distinctProducts = new Set((inv?.rows ?? []).map(x => x.productVariantName).filter(Boolean));
      const hasBlockedContent = (inv?.rows ?? []).some(x =>
        Number(x.quantityQuarantine ?? 0) > 0 || x.lotIsSellable === false
      );
      const quality = hasBlockedContent
        ? 'Có thành phần lô cách ly/rủi ro'
        : (rep?.lotQualityStatus?.trim() || null);

      const slot: MapSlot = {
        id: l.id,
        slotCode: this.locationLabel(l),
        zoneName: isOutboundStaging ? 'Chờ xuất' : (l.zoneName || '—'),
        maxCapacity: cap,
        currentOccupancy: occ,
        fillPct,
        isActive,
        isQuarantine,
        isOutboundStaging,
        outboundOrderCode: l.outboundLockOrderCode ?? null,
        priority: l.priority ?? null,
        lotCode: distinctLots.size > 1 ? `${distinctLots.size} lô` : (rep?.lotCode ?? null),
        productName: distinctProducts.size > 1 ? `${distinctProducts.size} mặt hàng` : (rep?.productVariantName ?? null),
        categoryName: rep?.categoryName ?? null,
        bags: inv?.bags ?? 0,
        openBags: inv?.openBags ?? 0,
        hasPhysicalBagData: inv?.hasPhysicalBagData ?? true,
        weightKg: inv?.weightKg ?? 0,
        quality,
        strategy: isOutboundStaging ? 'Chỉ dùng cho hàng đã đóng gói' : this.strategyOf(isQuarantine || hasBlockedContent, quality),
        status: this.computeStatus(isActive, isQuarantine || hasBlockedContent, isOutboundStaging, fillPct, inv?.weightKg ?? 0, quality),
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
    isOutboundStaging: boolean,
    fillPct: number,
    weightKg: number,
    quality: string | null
  ): SlotStatus {
    if (!isActive) return 'locked';
    if (isOutboundStaging) return 'staging';
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
      case 'staging': return 'Chờ xuất';
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

  bagLabel(slot: MapSlot): string {
    if (slot.weightKg > 0 && !slot.hasPhysicalBagData) {
      return 'Chưa đồng bộ bao';
    }
    if (slot.openBags > 0) {
      return `${this.fmtNum(slot.bags)} bao (${this.fmtNum(slot.openBags)} bao mở)`;
    }
    return `${this.fmtNum(slot.bags)} bao`;
  }

  capacityLabel(slot: MapSlot): string {
    if (slot.isOutboundStaging) return 'Sức chứa: Không áp dụng';
    if (slot.maxCapacity > 0 && slot.currentOccupancy > slot.maxCapacity) {
      return `${slot.fillPct}% sức chứa · Vượt ${this.fmtNum(slot.currentOccupancy - slot.maxCapacity)} kg`;
    }
    return `${slot.fillPct}% sức chứa${slot.quality ? ' · ' + slot.quality : ''}`;
  }

  private locationLabel(location: any): string {
    const zone = String(location.zoneName ?? '').trim();
    const row = String(location.shelfRow ?? '').trim();
    const level = String(location.shelfLevel ?? '').trim();
    const slot = String(location.slotCode ?? '').trim();
    const zoneCode = zone.replace(/^khu\s+/i, '').trim();
    const canonical = [zoneCode, row, level].filter(Boolean).join('-');

    // Một số dữ liệu cũ đã lưu cả tên khu/cột/lớp lặp hai lần trong SlotCode.
    // Khi nhận diện được chuỗi lỗi này, dùng tọa độ chuẩn thay vì hiển thị nguyên dữ liệu bẩn.
    if (canonical && slot) {
      const occurrences = slot.toLocaleLowerCase('vi-VN').split(canonical.toLocaleLowerCase('vi-VN')).length - 1;
      if (occurrences > 1 || (/^khu\s+/i.test(slot) && slot.toLocaleLowerCase('vi-VN').includes(canonical.toLocaleLowerCase('vi-VN')))) {
        return canonical;
      }
    }

    return slot || canonical || zone || `#${location.id}`;
  }

  trackZone = (_: number, z: MapZone) => z.name;
  trackSlot = (_: number, s: MapSlot) => s.id;
}
