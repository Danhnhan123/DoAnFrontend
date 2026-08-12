import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
  keepPreviousData,
} from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import {
  AllocationCandidateRow,
  AllocateOutboundPayload,
  ApiResponse,
  CompleteDeliveryResult,
  DebtDocumentRow,
  DTResponse,
  InventoryRow,
  OUTBOUND_STATUS,
  OUTBOUND_STATUS_CODE,
  OutboundStatusCode,
  OutboundOrderAllocationGroup,
  OutboundOrderDetail,
  OutboundOrderItem,
  OutboundOrderPage,
  OutboundOrderRow,
  PickOutboundPayload,
  SalesOrderDetail,
} from '../../models';
import { InventoryService } from '../../services/inventory.service';
import { OutboundOrderService } from '../../services/outbound-order.service';
import { SalesOrderService } from '../../services/sales-order.service';
import { PartyDebtService } from '../../services/party-debt.service';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

type StatusFilter = 'ALL' | OutboundStatusCode;
type SortDir = 'asc' | 'desc';
type OutboundAction =
  | 'DISPATCH'
  | 'COMPLETE'
  | 'FAIL'
  | 'CANCEL'
  | 'PACKING';

type OutboundStatusSource = {
  outboundStatusCode?: string | null;
  outboundStatusId?: number | null;
  outboundStatusName?: string | null;
};

interface GroupedSubLot {
  inventoryId: number;
  paddyLotId?: number | null;
  lotCode: string;
  availableKg: number;
  fullBagCount: number;
  hasOpenBag: boolean;
  openBagWeightKg: number;
  openBagId?: number | null;
  isOpenBagBlocked: boolean;
}

interface AllocateLocationRow {
  locationId: number | null;
  locationCode: string;
  availableKg: number;
  standardWeightKg: number | null;
  totalFullBagCount: number;
  hasOpenBag: boolean;
  openBagWeightKg: number;
  openBagId: number | null;
  isOpenBagBlocked: boolean;
  openBagLotCode?: string | null;
  subLots: GroupedSubLot[];

  // Form state per location card
  takeAllOpenBag: boolean;       // Checkbox "Lấy toàn bộ bao lẻ"
  openBagTakeKg: number | null;  // Input số kg lấy từ bao lẻ (max: openBagWeightKg)
  fullBagsToTake: number;        // Stepper số bao nguyên (max: totalFullBagCount)
  splitBagKg: number | null;     // Input "Xé 1 bao chuẩn lấy lẻ" (max: standardWeightKg)
  qty: number | null;            // fallback for non-bag items
}

interface AllocateItemForm {
  itemId: number;
  productVariantName: string;
  sku: string;
  orderedKg: number;
  alreadyAllocatedKg: number;
  locations: AllocateLocationRow[];
}

interface PickLocationCard {
  key: string;
  locationId: number;
  locationCode: string;
  lotCode: string;
  productVariantName: string;
  standardWeightKg: number;
  totalAllocatedKg: number;
  allocationIds: number[];

  // Breakdown
  hasOpenBag: boolean;
  openBagWeightKg: number;
  allocatedFullBagCount: number;
  allocatedSplitKg: number;

  // Form State (Default filled 100%)
  takeOpenBag: boolean;
  openBagPickedKg: number | null;
  pickedFullBagCount: number;
  pickedSplitKg: number | null;
}

/** Bước pipeline (chỉ hiển thị) — khớp thiết kế Figma "Xuất kho / Giao hàng". */
const PIPELINE_STEPS = [
  'Đơn bán',
  'Kiểm tồn',
  'Giữ hàng',
  'Chuẩn bị',
  'Cân/đóng bao',
  'Phiếu xuất',
  'Giao hàng',
  'Thu tiền/công nợ',
];

@Component({
  selector: 'app-outbound-order',
  standalone: true,
  imports: [HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './outbound-order.component.html',
  styleUrl: './outbound-order.component.css',
})
export class OutboundOrderComponent implements OnDestroy {
  private readonly service = inject(OutboundOrderService);
  private readonly inventoryService = inject(InventoryService);
  private readonly salesOrderService = inject(SalesOrderService);
  private readonly partyDebtService = inject(PartyDebtService);
  private readonly queryClient = injectQueryClient();
  private readonly router = inject(Router);

  readonly statusCode = OUTBOUND_STATUS_CODE;
  readonly Math = Math;
  readonly pipelineSteps = PIPELINE_STEPS;
  readonly pageSizeOptions = [10, 20, 50];
  readonly pageSizeSelectOptions: FilterSelectOption[] = [
    { id: 10, name: '10 / trang' },
    { id: 20, name: '20 / trang' },
    { id: 50, name: '50 / trang' },
  ];

  /** Nhãn trạng thái tiếng Việt theo code (khớp OutboundOrderStatusSeed). */
  private readonly statusLabels: Record<OutboundStatusCode, string> = {
    [OUTBOUND_STATUS_CODE.DRAFT]: 'Nháp',
    [OUTBOUND_STATUS_CODE.PICKING]: 'Đang lấy hàng',
    [OUTBOUND_STATUS_CODE.PACKED]: 'Đã đóng gói',
    [OUTBOUND_STATUS_CODE.DISPATCHED]: 'Đang giao hàng',
    [OUTBOUND_STATUS_CODE.COMPLETED]: 'Hoàn thành',
    [OUTBOUND_STATUS_CODE.CANCELLED]: 'Đã hủy',
    [OUTBOUND_STATUS_CODE.DELIVERY_FAILED]: 'Giao hàng thất bại',
  };

  /** Trả nhãn tiếng Việt; fallback về tên gốc từ backend nếu code lạ. */
  statusLabel(source: OutboundStatusSource): string {
    const code = this.statusCodeOf(source);
    return code ? this.statusLabels[code] : source.outboundStatusName || '—';
  }

  readonly statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: 'Tất cả' },
    { key: OUTBOUND_STATUS_CODE.DRAFT, label: 'Nháp' },
    { key: OUTBOUND_STATUS_CODE.PICKING, label: 'Đang lấy hàng' },
    { key: OUTBOUND_STATUS_CODE.PACKED, label: 'Đã đóng gói' },
    { key: OUTBOUND_STATUS_CODE.DISPATCHED, label: 'Đang giao hàng' },
    { key: OUTBOUND_STATUS_CODE.COMPLETED, label: 'Hoàn thành' },
    { key: OUTBOUND_STATUS_CODE.DELIVERY_FAILED, label: 'Giao hàng thất bại' },
    { key: OUTBOUND_STATUS_CODE.CANCELLED, label: 'Đã hủy' },
  ];

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly searchInput = signal('');
  readonly keyword = signal('');
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly selectedId = signal<number | null>(null);
  readonly sortKey = signal<string>('createdDate');
  readonly sortDir = signal<SortDir>('desc');

  // Modal phân bổ (allocate)
  readonly showAllocateModal = signal(false);
  readonly allocateForm = signal<AllocateItemForm[]>([]);
  readonly loadingLots = signal(false);

  // Modal lấy hàng (pick)
  readonly showPickModal = signal(false);
  readonly pickForm = signal<PickLocationCard[]>([]);

  // Modal đóng gói (confirm-packing)
  readonly showPackingModal = signal(false);
  readonly packingQr = signal('');
  readonly packingActualKg = signal<number | null>(null);
  readonly packingScale = signal('');

  private searchTimer?: ReturnType<typeof setTimeout>;

  private readonly listQuery = injectQuery(() => ({
    queryKey: [
      'outbound-orders',
      'paged',
      this.page(),
      this.pageSize(),
      this.keyword(),
    ],
    queryFn: async () =>
      this.unwrap<OutboundOrderPage>(
        await lastValueFrom(
          this.service.getPaged({
            page: this.page(),
            pageSize: this.pageSize(),
            keyword: this.keyword() || null,
          })
        ),
        'Không tải được danh sách phiếu xuất.'
      ),
    placeholderData: keepPreviousData,
  }));

  private readonly detailQuery = injectQuery(() => ({
    queryKey: ['outbound-orders', 'detail', this.selectedId()],
    enabled: this.selectedId() != null,
    queryFn: async () => {
      const id = this.selectedId();
      if (id == null) throw new Error('Chưa chọn phiếu xuất.');
      return this.unwrap<OutboundOrderDetail>(
        await lastValueFrom(this.service.getById(id)),
        'Không tải được chi tiết phiếu xuất.'
      );
    },
  }));

  // ── Derived state ─────────────────────────────────────────────────
  readonly pageRows = computed(() => this.listQuery.data()?.items || []);

  readonly rows = computed(() => {
    const filter = this.statusFilter();
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    let list = this.pageRows();
    if (filter !== 'ALL') {
      list = list.filter((row) => this.isStatus(row, filter));
    }
    return [...list].sort((a, b) => {
      const av = this.sortValue(a, key);
      const bv = this.sortValue(b, key);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  });

  readonly total = computed(() => Number(this.listQuery.data()?.total || 0));
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );
  readonly loading = computed(() => this.listQuery.isPending());
  readonly fetching = computed(() => this.listQuery.isFetching());
  readonly detailLoading = computed(() => this.detailQuery.isFetching());
  readonly detail = computed(() => this.detailQuery.data() || null);

  readonly pageDeliveringCount = computed(
    () =>
      this.pageRows().filter(
        (r) => this.isStatus(r, OUTBOUND_STATUS_CODE.DISPATCHED)
      ).length
  );
  readonly pageWaitingCount = computed(
    () =>
      this.pageRows().filter((r) =>
        this.isStatusIn(r, [
          OUTBOUND_STATUS_CODE.DRAFT,
          OUTBOUND_STATUS_CODE.PICKING,
          OUTBOUND_STATUS_CODE.PACKED,
        ])
      ).length
  );

  /** Bước pipeline đang active theo trạng thái phiếu đang chọn. */
  readonly activeStep = computed(() => {
    const order = this.detail();
    if (!order) return 0;
    switch (this.statusCodeOf(order)) {
      case OUTBOUND_STATUS_CODE.DRAFT:
        return 2;
      case OUTBOUND_STATUS_CODE.PICKING:
        return 3;
      case OUTBOUND_STATUS_CODE.PACKED:
        return 4;
      case OUTBOUND_STATUS_CODE.DISPATCHED:
        return 6;
      case OUTBOUND_STATUS_CODE.COMPLETED:
        return 7;
      default:
        return -1;
    }
  });

  // Cân & đóng bao: tổng kế hoạch vs thực lấy
  readonly plannedKg = computed(() =>
    (this.detail()?.items || []).reduce(
      (sum, i) => sum + Number(i.quantityOrdered || 0),
      0
    )
  );
  readonly pickedKg = computed(() =>
    (this.detail()?.items || []).reduce(
      (sum, i) => sum + Number(i.quantityPicked || 0),
      0
    )
  );
  readonly weightDiff = computed(() => this.pickedKg() - this.plannedKg());

  readonly saving = computed(
    () =>
      this.allocateMutation.isPending() ||
      this.pickMutation.isPending() ||
      this.actionMutation.isPending()
  );

  private readonly selectVisibleRow = effect(() => {
    const rows = this.rows();
    const current = this.selectedId();
    if (!rows.length) {
      if (current != null) this.selectedId.set(null);
      return;
    }
    if (!rows.some((r) => r.id === current)) {
      this.selectedId.set(rows[0].id);
    }
  });

  // ── Mutations ─────────────────────────────────────────────────────
  private readonly allocateMutation = injectMutation(() => ({
    mutationFn: (req: { id: number; payload: AllocateOutboundPayload }) =>
      lastValueFrom(this.service.allocate(req.id, req.payload)),
    onSuccess: (response: ApiResponse<any>) => {
      if (!response.isSucceeded) {
        this.alert(response.message || 'Không phân bổ được lô hàng.', false);
        return;
      }
      this.showAllocateModal.set(false);
      this.allocateForm.set([]);
      this.refreshAfterWrite();
      this.alert('Đã phân bổ lô/vị trí. Phiếu chuyển sang Đang lấy hàng.');
    },
    onError: (error: unknown) => this.alert(this.errorText(error), false),
  }));

  private readonly pickMutation = injectMutation(() => ({
    mutationFn: (req: { id: number; payload: PickOutboundPayload }) =>
      lastValueFrom(this.service.pick(req.id, req.payload)),
    onSuccess: (response: ApiResponse<any>) => {
      if (!response.isSucceeded) {
        this.alert(response.message || 'Không cập nhật được số lượng lấy hàng.', false);
        return;
      }
      this.showPickModal.set(false);
      this.pickForm.set([]);
      this.refreshAfterWrite();
      this.alert('Đã cập nhật số lượng lấy hàng.');
    },
    onError: (error: unknown) => this.alert(this.errorText(error), false),
  }));

  private readonly actionMutation = injectMutation(() => ({
    mutationFn: (req: { id: number; action: OutboundAction; payload?: any }) => {
      switch (req.action) {
        case 'PACKING':
          return lastValueFrom(this.service.confirmPacking(req.id, req.payload));
        case 'DISPATCH':
          return lastValueFrom(this.service.confirmDispatch(req.id, req.payload));
        case 'COMPLETE':
          return lastValueFrom(this.service.completeDelivery(req.id, req.payload));
        case 'FAIL':
          return lastValueFrom(this.service.failDelivery(req.id, req.payload));
        default:
          return lastValueFrom(this.service.cancel(req.id));
      }
    },
    onSuccess: (response: ApiResponse<any>, req) => {
      if (!response.isSucceeded) {
        this.alert(response.message || 'Không thực hiện được thao tác.', false);
        return;
      }
      if (req.action === 'PACKING') this.showPackingModal.set(false);
      this.refreshAfterWrite();
      this.alert(this.actionMessage(req.action));
    },
    onError: (error: unknown) => this.alert(this.errorText(error), false),
  }));

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  // ── List controls ─────────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.keyword.set(value.trim());
    }, 350);
  }

  setStatusFilter(key: StatusFilter): void {
    this.statusFilter.set(key);
  }

  sort(key: string): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIcon(key: string): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
  }

  setPageSize(value: string | number): void {
    this.pageSize.set(Number(value) || 20);
    this.page.set(1);
  }

  visiblePages(): number[] {
    const pages: number[] = [];
    const current = this.page();
    for (
      let p = Math.max(1, current - 2);
      p <= Math.min(this.totalPages(), current + 2);
      p++
    ) {
      pages.push(p);
    }
    return pages;
  }

  selectOrder(id: number): void {
    this.selectedId.set(id);
  }

  refresh(): void {
    this.queryClient.invalidateQueries({ queryKey: ['outbound-orders'] });
  }

  openSalesOrder(order: OutboundOrderDetail): void {
    this.router.navigate(['/admin/sales-orders'], {
      queryParams: { salesOrderId: order.salesOrderId },
    });
  }

  // ── Allocate ───────────────────────────────────────────────────────
  async openAllocate(order: OutboundOrderDetail): Promise<void> {
    if (!this.canAllocate(order)) return;
    this.showAllocateModal.set(true);
    this.loadingLots.set(true);
    this.allocateForm.set([]);
    try {
      const candidateResponse = await lastValueFrom(
        this.service.getAllocationCandidates(order.id)
      );
      const rows = this.unwrap<AllocationCandidateRow[]>(
        candidateResponse,
        'Không tải được nguồn tồn có thể phân bổ.'
      ) || [];

      const form: AllocateItemForm[] = order.items.map((item) => {
        const already = item.allocations.reduce(
          (s, a) => s + Number(a.quantityAllocated || 0),
          0
        );

        const itemCandidates = rows.filter(
          (r) =>
            r.productVariantId === item.productVariantId &&
            Number(r.selectableQuantity || 0) > 0
        );

        // Group candidates by Location (Column)
        const groupsMap = new Map<string, AllocationCandidateRow[]>();
        for (const r of itemCandidates) {
          const key = r.locationId ? `LOC_${r.locationId}` : `CODE_${r.locationCode || '—'}`;
          if (!groupsMap.has(key)) {
            groupsMap.set(key, []);
          }
          groupsMap.get(key)!.push(r);
        }

        const locations: AllocateLocationRow[] = Array.from(groupsMap.values()).map((candGroup) => {
          const subLots: GroupedSubLot[] = candGroup.map((r) => ({
            inventoryId: r.inventoryId,
            paddyLotId: r.paddyLotId,
            lotCode: r.lotCode || `INV-${r.inventoryId}`,
            availableKg: Number(r.selectableQuantity || 0),
            fullBagCount: r.fullBagCount ?? 0,
            hasOpenBag: r.hasOpenBag ?? false,
            openBagWeightKg: Number(r.openBagWeightKg || 0),
            openBagId: r.openBagId ?? null,
            isOpenBagBlocked: r.isOpenBagBlocked ?? false,
          }));

          const first = candGroup[0];
          const standardWeightKg = candGroup.find((x) => x.standardWeightKg != null)?.standardWeightKg ?? null;
          const totalFullBagCount = candGroup.reduce((sum, x) => sum + (x.fullBagCount ?? 0), 0);
          const totalAvailableKg = candGroup.reduce((sum, x) => sum + Number(x.selectableQuantity || 0), 0);

          // Find open bag across sublots
          const openBagCand = candGroup.find((x) => x.hasOpenBag && x.openBagWeightKg > 0);
          const hasOpenBag = openBagCand != null;
          const openBagWeightKg = openBagCand ? Number(openBagCand.openBagWeightKg || 0) : 0;
          const openBagId = openBagCand ? (openBagCand.openBagId ?? null) : null;
          const isOpenBagBlocked = openBagCand ? (openBagCand.isOpenBagBlocked ?? false) : false;
          const openBagLotCode = openBagCand ? openBagCand.lotCode : null;

          return {
            locationId: first.locationId ?? null,
            locationCode: first.locationCode || '—',
            availableKg: totalAvailableKg,
            standardWeightKg,
            totalFullBagCount,
            hasOpenBag,
            openBagWeightKg,
            openBagId,
            isOpenBagBlocked,
            openBagLotCode,
            subLots,
            takeAllOpenBag: false,
            openBagTakeKg: null,
            fullBagsToTake: 0,
            splitBagKg: null,
            qty: null,
          };
        })
        .sort((a, b) => {
          // Sort location cards: location with unblocked open bag first
          if (a.hasOpenBag && !a.isOpenBagBlocked && !b.hasOpenBag) return -1;
          if (b.hasOpenBag && !b.isOpenBagBlocked && !a.hasOpenBag) return 1;
          return a.locationCode.localeCompare(b.locationCode);
        });

        return {
          itemId: item.id,
          productVariantName: item.productVariantName,
          sku: item.sku || '',
          orderedKg: Number(item.quantityOrdered || 0),
          alreadyAllocatedKg: already,
          locations,
        };
      });

      this.allocateForm.set(form);
    } catch (error) {
      this.alert(this.errorText(error), false);
      this.showAllocateModal.set(false);
    } finally {
      this.loadingLots.set(false);
    }
  }

  closeAllocate(): void {
    if (this.allocateMutation.isPending()) return;
    this.showAllocateModal.set(false);
    this.allocateForm.set([]);
  }

  /** Does this SKU have bag-level data (StandardWeightKg) on at least one location? */
  hasBagData(item: AllocateItemForm): boolean {
    return item.locations.some((l) => l.standardWeightKg != null && l.standardWeightKg > 0);
  }

  /** Computed total kg for a single location stack based on bag selections. */
  locationBagKg(loc: AllocateLocationRow): number {
    if (loc.standardWeightKg == null || loc.standardWeightKg <= 0) {
      // Fallback: no bag data, use raw kg input
      return Number(loc.qty || 0);
    }
    const openKg = Number(loc.openBagTakeKg || 0);
    const fullKg = loc.fullBagsToTake * loc.standardWeightKg;
    const splitKg = Number(loc.splitBagKg || 0);
    return openKg + fullKg + splitKg;
  }

  setAllocateQty(itemIndex: number, locIndex: number, value: unknown): void {
    this.allocateForm.update((form) =>
      form.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              locations: item.locations.map((loc, j) =>
                j === locIndex
                  ? { ...loc, qty: value === '' || value == null ? null : Number(value) }
                  : loc
              ),
            }
          : item
      )
    );
  }

  setFullBagsToTake(itemIndex: number, locIndex: number, value: unknown): void {
    const num = value === '' || value == null ? 0 : Math.max(0, Math.floor(Number(value)));
    this.allocateForm.update((form) =>
      form.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              locations: item.locations.map((loc, j) =>
                j === locIndex
                  ? { ...loc, fullBagsToTake: Math.min(num, loc.totalFullBagCount) }
                  : loc
              ),
            }
          : item
      )
    );
  }

  toggleOpenBag(itemIndex: number, locIndex: number): void {
    this.allocateForm.update((form) =>
      form.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              locations: item.locations.map((loc, j) => {
                if (j !== locIndex) return loc;
                const willTakeAll = !loc.takeAllOpenBag;
                return {
                  ...loc,
                  takeAllOpenBag: willTakeAll,
                  openBagTakeKg: willTakeAll ? loc.openBagWeightKg : null,
                };
              }),
            }
          : item
      )
    );
  }

  setOpenBagTakeKg(itemIndex: number, locIndex: number, value: unknown): void {
    const num = value === '' || value == null ? null : Math.max(0, Number(value));
    this.allocateForm.update((form) =>
      form.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              locations: item.locations.map((loc, j) => {
                if (j !== locIndex) return loc;
                const validNum = num == null ? null : Math.min(num, loc.openBagWeightKg);
                const isAll = validNum != null && Math.abs(validNum - loc.openBagWeightKg) < 0.001;
                return {
                  ...loc,
                  openBagTakeKg: validNum,
                  takeAllOpenBag: isAll,
                };
              }),
            }
          : item
      )
    );
  }

  setSplitBagKg(itemIndex: number, locIndex: number, value: unknown): void {
    const num = value === '' || value == null ? null : Math.max(0, Number(value));
    this.allocateForm.update((form) =>
      form.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              locations: item.locations.map((loc, j) => {
                if (j !== locIndex) return loc;
                const maxSplit = loc.standardWeightKg || 0;
                const validNum = num == null ? null : Math.min(num, maxSplit);
                return {
                  ...loc,
                  splitBagKg: validNum,
                };
              }),
            }
          : item
      )
    );
  }

  selectEntireColumn(itemIndex: number, locIndex: number): void {
    this.allocateForm.update((form) =>
      form.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              locations: item.locations.map((loc, j) => {
                if (j !== locIndex) return loc;
                return {
                  ...loc,
                  takeAllOpenBag: loc.hasOpenBag && !loc.isOpenBagBlocked,
                  openBagTakeKg: loc.hasOpenBag && !loc.isOpenBagBlocked ? loc.openBagWeightKg : null,
                  fullBagsToTake: loc.totalFullBagCount,
                  splitBagKg: null,
                };
              }),
            }
          : item
      )
    );
  }

  allocatedTotal(item: AllocateItemForm): number {
    if (this.hasBagData(item)) {
      return item.locations.reduce((s, l) => s + this.locationBagKg(l), 0);
    }
    return item.locations.reduce((s, l) => s + Number(l.qty || 0), 0);
  }

  allocateRemaining(item: AllocateItemForm): number {
    return item.orderedKg - item.alreadyAllocatedKg - this.allocatedTotal(item);
  }

  hasOpenBagBlockerWarning(loc: AllocateLocationRow): boolean {
    if (!loc.hasOpenBag || loc.isOpenBagBlocked) return false;
    const openTake = Number(loc.openBagTakeKg || 0);
    if (openTake <= 0) return false;
    const openRemaining = loc.openBagWeightKg - openTake;
    return openRemaining > 0.001 && (loc.fullBagsToTake > 0 || Number(loc.splitBagKg || 0) > 0);
  }

  /** ⚡ Auto-allocate: prioritize open bags first, then fill with full bags / partial splits. */
  autoAllocate(): void {
    this.allocateForm.update((form) =>
      form.map((item) => {
        let remaining = item.orderedKg - item.alreadyAllocatedKg;
        if (remaining <= 0) return item;

        const newLocations = item.locations.map((loc) => {
          const updated = {
            ...loc,
            takeAllOpenBag: false,
            openBagTakeKg: null as number | null,
            fullBagsToTake: 0,
            splitBagKg: null as number | null,
            qty: null as number | null,
          };
          if (remaining <= 0) return updated;

          if (loc.standardWeightKg != null && loc.standardWeightKg > 0) {
            // Take from open bag first
            if (loc.hasOpenBag && !loc.isOpenBagBlocked && remaining > 0) {
              const takeOpen = Math.min(remaining, loc.openBagWeightKg);
              updated.openBagTakeKg = takeOpen;
              updated.takeAllOpenBag = Math.abs(takeOpen - loc.openBagWeightKg) < 0.001;
              remaining -= takeOpen;
            }
            // CRITICAL LIFO RULE: Can only take full bags underneath if top open bag is 100% cleared!
            const isOpenBagCleared = !loc.hasOpenBag || loc.isOpenBagBlocked || updated.takeAllOpenBag;

            if (isOpenBagCleared && remaining > 0 && loc.totalFullBagCount > 0) {
              const fullBagsCount = Math.floor(remaining / loc.standardWeightKg);
              const bagsToTake = Math.min(fullBagsCount, loc.totalFullBagCount);
              updated.fullBagsToTake = bagsToTake;
              remaining -= bagsToTake * loc.standardWeightKg;

              // If still remaining and have unused full bags, split 1 full bag!
              if (remaining > 0 && loc.totalFullBagCount > bagsToTake) {
                const splitKg = Math.min(remaining, loc.standardWeightKg);
                updated.splitBagKg = splitKg;
                remaining -= splitKg;
              }
            }
          } else {
            // Fallback kg-only
            const take = Math.min(remaining, loc.availableKg);
            updated.qty = take;
            remaining -= take;
          }
          return updated;
        });

        return { ...item, locations: newLocations };
      })
    );
  }

  submitAllocate(): void {
    const order = this.detail();
    if (!order) return;
    const form = this.allocateForm();

    const allocations = form
      .map((item) => {
        const useBags = this.hasBagData(item);
        const itemLots: { inventoryId: number; quantityAllocated: number; takeOpenBag?: boolean; fullBagCount?: number }[] = [];

        for (const loc of item.locations) {
          if (useBags) {
            const locKg = this.locationBagKg(loc);
            if (locKg <= 0) continue;

            let openKgRemaining = Number(loc.openBagTakeKg || 0);
            let fullBagsRemaining = loc.fullBagsToTake;
            let splitKgRemaining = Number(loc.splitBagKg || 0);

            for (const sub of loc.subLots) {
              let subOpenKg = 0;
              let subTakeOpenBagFlag = false;

              if (openKgRemaining > 0 && sub.hasOpenBag && !sub.isOpenBagBlocked) {
                subOpenKg = Math.min(openKgRemaining, sub.openBagWeightKg);
                subTakeOpenBagFlag = Math.abs(subOpenKg - sub.openBagWeightKg) < 0.001;
                openKgRemaining -= subOpenKg;
              }

              let subFullBags = 0;
              if (fullBagsRemaining > 0 && sub.fullBagCount > 0) {
                subFullBags = Math.min(fullBagsRemaining, sub.fullBagCount);
                fullBagsRemaining -= subFullBags;
              }

              let subSplitKg = 0;
              const subFullBagsLeft = sub.fullBagCount - subFullBags;
              if (splitKgRemaining > 0 && subFullBagsLeft > 0) {
                subSplitKg = Math.min(splitKgRemaining, loc.standardWeightKg || 0);
                splitKgRemaining -= subSplitKg;
              }

              const subTotalKg = subOpenKg + (subFullBags * (loc.standardWeightKg || 0)) + subSplitKg;
              if (subTotalKg > 0) {
                itemLots.push({
                  inventoryId: sub.inventoryId,
                  quantityAllocated: subTotalKg,
                  takeOpenBag: subTakeOpenBagFlag ? true : undefined,
                  fullBagCount: subFullBags > 0 ? subFullBags : undefined,
                });
              }
            }
          } else {
            let remainingKg = Number(loc.qty || 0);
            if (remainingKg <= 0) continue;

            for (const sub of loc.subLots) {
              if (remainingKg <= 0) break;
              const takeKg = Math.min(remainingKg, sub.availableKg);
              remainingKg -= takeKg;
              itemLots.push({
                inventoryId: sub.inventoryId,
                quantityAllocated: takeKg,
              });
            }
          }
        }

        return {
          outboundOrderItemId: item.itemId,
          lots: itemLots,
        };
      })
      .filter((a) => a.lots.length > 0);

    if (!allocations.length) {
      this.alert('Nhập số lượng phân bổ cho ít nhất một vị trí.', false);
      return;
    }

    for (const item of form) {
      const remaining = this.allocateRemaining(item);
      if (remaining < -0.001) {
        this.alert(
          `Sản phẩm "${item.productVariantName}" bị phân bổ vượt số lượng đặt.`,
          false
        );
        return;
      }
      for (const loc of item.locations) {
        const locKg = this.hasBagData(item) ? this.locationBagKg(loc) : Number(loc.qty || 0);
        if (locKg > loc.availableKg + 0.001) {
          this.alert(
            `Vị trí ${loc.locationCode} chỉ còn ${this.fmtKg(loc.availableKg)} khả dụng.`,
            false
          );
          return;
        }

        // Validate physical LIFO stack rule: Cannot take full bags underneath if top open bag is not 100% taken!
        if (loc.hasOpenBag && !loc.isOpenBagBlocked && Number(loc.openBagTakeKg || 0) > 0) {
          const openRemaining = loc.openBagWeightKg - Number(loc.openBagTakeKg || 0);
          if (openRemaining > 0.001 && (loc.fullBagsToTake > 0 || Number(loc.splitBagKg || 0) > 0)) {
            this.alert(
              `Tại vị trí ${loc.locationCode}: Bao lẻ ở đỉnh còn thừa ${this.fmtKg(openRemaining)}. ` +
              `Bạn phải lấy hết 100% bao lẻ ở đỉnh trước nếu muốn lấy tiếp các bao chuẩn bên dưới của cột này.`,
              false
            );
            return;
          }
        }
      }
    }

    this.allocateMutation.mutate({ id: order.id, payload: { allocations } });
  }

  // ── Pick ───────────────────────────────────────────────────────────
  locationPickedKg(card: PickLocationCard): number {
    const openKg = card.hasOpenBag && card.takeOpenBag ? Number(card.openBagPickedKg || 0) : 0;
    const fullKg = (card.pickedFullBagCount || 0) * card.standardWeightKg;
    const splitKg = Number(card.pickedSplitKg || 0);
    return openKg + fullKg + splitKg;
  }

  pickSplitMaxKg(card: PickLocationCard): number {
    const openKg =
      card.hasOpenBag && card.takeOpenBag
        ? Number(card.openBagPickedKg || 0)
        : 0;
    const fullKg = (card.pickedFullBagCount || 0) * card.standardWeightKg;
    return Math.max(
      0,
      Math.min(card.standardWeightKg, card.totalAllocatedKg - openKg - fullKg)
    );
  }

  private inferStandardWeightKg(
    item: OutboundOrderItem,
    groups: OutboundOrderAllocationGroup[]
  ): number {
    const text = `${item.productVariantName || ''} ${item.sku || ''}`;
    const match = text.match(/(\d+(?:[,.]\d+)?)\s*kg/i);
    const parsed = match ? Number(match[1].replace(',', '.')) : 0;
    if (parsed > 0) return parsed;

    const groupWeights = groups
      .map((group) => Number(group.weightPerBagKg || 0))
      .filter((weight) => weight > 0.001);
    const fullBagWeight = groupWeights.find(
      (weight) => Math.abs(weight % 10) < 0.001
    );
    if (fullBagWeight) return fullBagWeight;
    return 10;
  }

  openPick(order: OutboundOrderDetail): void {
    if (!this.canPick(order)) return;
    const cards: PickLocationCard[] = [];

    for (const item of order.items) {
      const locMap = new Map<number, {
        locationId: number;
        locationCode: string;
        paddyLotCode?: string | null;
        allocationIds: number[];
        groups: OutboundOrderAllocationGroup[];
        totalAllocatedKg: number;
        totalPickedKg: number;
      }>();

      for (const group of this.allocationGroups(item)) {
        const locId = group.locationId || group.inventoryId;
        const current = locMap.get(locId) || {
          locationId: locId,
          locationCode: group.locationCode || '—',
          paddyLotCode: group.paddyLotCode,
          allocationIds: [],
          groups: [],
          totalAllocatedKg: 0,
          totalPickedKg: 0,
        };
        current.allocationIds.push(...group.allocationIds);
        current.groups.push(group);
        current.totalAllocatedKg += Number(group.totalAllocatedKg || 0);
        current.totalPickedKg += Number(group.totalPickedKg || 0);
        if (group.paddyLotCode && !current.paddyLotCode) current.paddyLotCode = group.paddyLotCode;
        locMap.set(locId, current);
      }

      for (const [locId, group] of locMap.entries()) {
        const totalAllocatedKg = group.totalAllocatedKg;
        const stdWeight = this.inferStandardWeightKg(item, group.groups);

        let hasOpenBag = false;
        let openBagWeightKg = 0;
        let allocatedFullBagCount = 0;
        let allocatedSplitKg = 0;
        let partialBagSeen = false;

        for (const allocationGroup of group.groups) {
          const weightPerBagKg = Number(allocationGroup.weightPerBagKg || 0);
          const groupTotalKg = Number(allocationGroup.totalAllocatedKg || 0);
          const bagCount = Number(allocationGroup.bagCount || 0);
          if (groupTotalKg <= 0.001) continue;

          if (Math.abs(weightPerBagKg - stdWeight) <= 0.001) {
            allocatedFullBagCount += bagCount || Math.floor(groupTotalKg / stdWeight);
            continue;
          }

          if (weightPerBagKg > stdWeight + 0.001) {
            const fullCount = Math.floor(groupTotalKg / stdWeight);
            const remainderKg = groupTotalKg - fullCount * stdWeight;
            allocatedFullBagCount += fullCount;
            if (remainderKg > 0.001) {
              if (!partialBagSeen) {
                hasOpenBag = true;
                openBagWeightKg += remainderKg;
                partialBagSeen = true;
              } else {
                allocatedSplitKg += remainderKg;
              }
            }
            continue;
          }

          if (!partialBagSeen) {
            hasOpenBag = true;
            openBagWeightKg += groupTotalKg;
            partialBagSeen = true;
          } else {
            allocatedSplitKg += groupTotalKg;
          }
        }

        cards.push({
          key: `${item.id}:${locId}`,
          locationId: locId,
          locationCode: group.locationCode,
          lotCode: group.paddyLotCode || '',
          productVariantName: item.productVariantName,
          standardWeightKg: stdWeight,
          totalAllocatedKg,
          allocationIds: group.allocationIds,

          hasOpenBag,
          openBagWeightKg,
          allocatedFullBagCount,
          allocatedSplitKg,

          takeOpenBag: hasOpenBag,
          openBagPickedKg: hasOpenBag ? openBagWeightKg : null,
          pickedFullBagCount: allocatedFullBagCount,
          pickedSplitKg: allocatedSplitKg > 0 ? allocatedSplitKg : null,
        });
      }
    }

    if (!cards.length) {
      this.alert('Phiếu chưa có phân bổ lô để lấy hàng.', false);
      return;
    }
    this.pickForm.set(cards);
    this.showPickModal.set(true);
  }

  closePick(): void {
    if (this.pickMutation.isPending()) return;
    this.showPickModal.set(false);
    this.pickForm.set([]);
  }

  private fullPickRows(rows: PickLocationCard[]): PickLocationCard[] {
    return rows.map((r) => ({
      ...r,
      takeOpenBag: r.hasOpenBag,
      openBagPickedKg: r.hasOpenBag ? r.openBagWeightKg : null,
      pickedFullBagCount: r.allocatedFullBagCount,
      pickedSplitKg: r.allocatedSplitKg > 0 ? r.allocatedSplitKg : null,
    }));
  }

  fillAllPick100(): void {
    this.pickForm.update((rows) => this.fullPickRows(rows));
  }

  confirmPick100(): void {
    const order = this.detail();
    if (!order || this.saving()) return;
    const fullRows = this.fullPickRows(this.pickForm());
    this.pickForm.set(fullRows);
    const payload = this.buildPickPayload(order, fullRows);
    if (!payload) return;
    this.pickMutation.mutate({ id: order.id, payload });
  }

  togglePickOpenBag(index: number): void {
    this.pickForm.update((rows: any[]) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const willTake = !r.takeOpenBag;
        return {
          ...r,
          takeOpenBag: willTake,
          openBagPickedKg: willTake ? r.openBagWeightKg : null,
        };
      })
    );
  }

  setPickOpenBagKg(index: number, value: unknown): void {
    const num = value === '' || value == null ? null : Math.max(0, Number(value));
    this.pickForm.update((rows: any[]) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const validNum = num == null ? null : Math.min(num, r.openBagWeightKg);
        const isAll = validNum != null && Math.abs(validNum - r.openBagWeightKg) < 0.001;
        const draft = {
          ...r,
          openBagPickedKg: validNum,
          takeOpenBag: isAll || (validNum != null && validNum > 0),
        };
        const maxSplit = this.pickSplitMaxKg(draft);
        const splitKg = Number(r.pickedSplitKg || 0);
        return {
          ...r,
          openBagPickedKg: validNum,
          takeOpenBag: isAll || (validNum != null && validNum > 0),
          pickedSplitKg:
            splitKg > 0 && maxSplit > 0 ? Math.min(splitKg, maxSplit) : null,
        };
      })
    );
  }

  setPickFullBagCount(index: number, value: unknown): void {
    const count = value === '' || value == null ? 0 : Math.max(0, Math.floor(Number(value)));
    this.pickForm.update((rows: any[]) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const validCount = Math.min(count, r.allocatedFullBagCount);
        const draft = { ...r, pickedFullBagCount: validCount };
        const maxSplit = this.pickSplitMaxKg(draft);
        const splitKg = Number(r.pickedSplitKg || 0);
        return {
          ...r,
          pickedFullBagCount: validCount,
          pickedSplitKg:
            splitKg > 0 && maxSplit > 0 ? Math.min(splitKg, maxSplit) : null,
        };
      })
    );
  }

  setPickSplitKg(index: number, value: unknown): void {
    const num = value === '' || value == null ? null : Math.max(0, Number(value));
    this.pickForm.update((rows: any[]) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        let pickedFullBagCount = r.pickedFullBagCount || 0;
        if (
          num != null &&
          num > 0 &&
          pickedFullBagCount >= r.allocatedFullBagCount &&
          r.allocatedFullBagCount > 0
        ) {
          pickedFullBagCount = r.allocatedFullBagCount - 1;
        }
        const draft = { ...r, pickedFullBagCount };
        const maxSplit = this.pickSplitMaxKg(draft);
        const validNum = num == null ? null : Math.min(num, maxSplit);
        return {
          ...r,
          pickedFullBagCount,
          pickedSplitKg: validNum != null && validNum > 0 ? validNum : null,
        };
      })
    );
  }

  submitPick(): void {
    const order = this.detail();
    if (!order) return;
    const payload = this.buildPickPayload(order, this.pickForm());
    if (!payload) return;
    this.pickMutation.mutate({ id: order.id, payload });
  }

  private buildPickPayload(
    order: OutboundOrderDetail,
    cards: PickLocationCard[]
  ): PickOutboundPayload | null {
    for (const r of cards) {
      const picked = this.locationPickedKg(r);
      if (picked < 0 || picked > r.totalAllocatedKg + 0.001) {
        this.alert(
          `Số lượng lấy tại vị trí ${r.locationCode} phải trong khoảng 0 – ${this.fmtKg(r.totalAllocatedKg)}.`,
          false
        );
        return null;
      }

      if (r.hasOpenBag && r.takeOpenBag && Number(r.openBagPickedKg || 0) > 0) {
        const openRemaining = r.openBagWeightKg - Number(r.openBagPickedKg || 0);
        if (
          openRemaining > 0.001 &&
          ((r.pickedFullBagCount || 0) > 0 || Number(r.pickedSplitKg || 0) > 0)
        ) {
          this.alert(
            `Tại vị trí ${r.locationCode}: Bao lẻ còn thừa ${this.fmtKg(openRemaining)}. ` +
              `Cần lấy hết bao lẻ trước khi lấy hoặc xé bao chuẩn bên dưới.`,
            false
          );
          return null;
        }
      }
    }

    const allocations = (order.items || []).flatMap((item) => item.allocations || []);
    const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));

    const picks = cards.flatMap((card) => {
      let remaining = this.locationPickedKg(card);
      return (card.allocationIds as number[]).map((allocationId) => {
        const allocation = allocationById.get(allocationId);
        const allocatedKg = Number(allocation?.quantityAllocated || 0);
        const quantityPicked = Math.min(remaining, allocatedKg);
        remaining = Math.max(0, remaining - quantityPicked);
        return { allocationId, quantityPicked };
      });
    });

    return { picks };
  }

  allocationGroups(item: OutboundOrderItem): OutboundOrderAllocationGroup[] {
    if (item.allocationGroups?.length) return item.allocationGroups;

    // Tương thích Backend cũ: tự gom các allocation cùng lô/vị trí/trọng lượng.
    const groups = new Map<string, OutboundOrderAllocationGroup>();
    for (const allocation of [...(item.allocations || [])].sort((a, b) => a.id - b.id)) {
      const unitWeight = Number(allocation.quantityAllocated || 0);
      const key = `${allocation.inventoryId}:${allocation.locationId}:${unitWeight.toFixed(3)}`;
      const current = groups.get(key) || {
        groupKey: key,
        allocationIds: [],
        inventoryId: allocation.inventoryId,
        paddyLotId: allocation.paddyLotId,
        paddyLotCode: allocation.paddyLotCode,
        locationId: allocation.locationId,
        locationCode: allocation.locationCode,
        bagCount: 0,
        weightPerBagKg: unitWeight,
        totalAllocatedKg: 0,
        totalPickedKg: 0,
      };
      current.allocationIds.push(allocation.id);
      current.bagCount += 1;
      current.totalAllocatedKg += unitWeight;
      current.totalPickedKg += Number(allocation.quantityPicked || 0);
      groups.set(key, current);
    }
    return [...groups.values()];
  }

  // ── Packing ────────────────────────────────────────────────────────
  openPacking(order: OutboundOrderDetail): void {
    if (!this.canPack(order) || !this.isPickedEnough(order)) return;
    this.packingQr.set(`PACK-${order.id}-${Date.now().toString().slice(-6)}`);
    this.packingActualKg.set(this.pickedKg() || this.plannedKg());
    this.packingScale.set('');
    this.showPackingModal.set(true);
  }

  closePacking(): void {
    if (this.actionMutation.isPending()) return;
    this.showPackingModal.set(false);
  }

  submitPacking(): void {
    const order = this.detail();
    if (!order) return;
    const qr = this.packingQr().trim();
    if (!qr) {
      this.alert('Mã QR đóng gói không được để trống.', false);
      return;
    }
    this.actionMutation.mutate({
      id: order.id,
      action: 'PACKING',
      payload: {
        qrCode: qr,
        actualWeightKg: this.packingActualKg(),
        scaleDevice: this.packingScale().trim() || null,
      },
    });
  }

  // ── Dispatch / Deliver / Fail / Cancel ─────────────────────────────
  async confirmDispatch(order: OutboundOrderDetail): Promise<void> {
    if (!this.canDispatch(order)) return;

    // Giá trị phải thu thực tế = giá bán (không dùng giá vốn).
    // -1 nghĩa là chưa xác định được (lỗi tải đơn bán) → vẫn hiển thị ô hạn
    // thanh toán cho an toàn, backend sẽ kiểm tra lại.
    const receivable = await this.computeExpectedReceivable(order);
    const hasReceivable = receivable !== 0;
    const known = receivable > 0;
    const today = this.todayIso();

    const dueDateBlock = hasReceivable
      ? `<div style="text-align:left;margin-top:12px">` +
        (known
          ? `<div style="margin-bottom:6px">Phiếu phát sinh <b>công nợ phải thu ${this.fmtMoney(
              receivable,
            )}</b>.</div>`
          : `<div style="margin-bottom:6px">Nếu phiếu phát sinh công nợ phải thu, vui lòng chọn hạn thanh toán.</div>`) +
        `<label style="display:block;font-weight:600;margin-bottom:4px" for="dispatch-due-date">Hạn thanh toán</label>` +
        `<input type="date" id="dispatch-due-date" class="swal2-input" style="margin:0;width:100%" min="${today}" value="${today}">` +
        `</div>`
      : '';

    Swal.fire({
      title: 'Xác nhận xuất kho?',
      html:
        `<p style="margin:0;text-align:left">Phiếu <b>${order.soCode}</b> sẽ trừ tồn thực tế, ghi InventoryTransaction và chuyển đơn bán sang <b>Đang giao</b>.</p>` +
        dueDateBlock +
        `<label style="display:block;text-align:left;font-weight:600;margin:12px 0 4px" for="dispatch-note">Ghi chú xuất kho</label>` +
        `<textarea id="dispatch-note" class="swal2-textarea" style="margin:0;width:100%" placeholder="Không bắt buộc…"></textarea>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận xuất kho',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a34a',
      focusConfirm: false,
      preConfirm: () => {
        const note =
          (document.getElementById('dispatch-note') as HTMLTextAreaElement)
            ?.value?.trim() || null;
        let dueDate: string | null = null;
        if (hasReceivable) {
          const value =
            (document.getElementById('dispatch-due-date') as HTMLInputElement)
              ?.value ?? '';
          if (!value) {
            Swal.showValidationMessage('Vui lòng chọn hạn thanh toán.');
            return false;
          }
          if (value < today) {
            Swal.showValidationMessage(
              'Hạn thanh toán không được trước hôm nay.',
            );
            return false;
          }
          dueDate = value;
        }
        return { dueDate, note };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { dueDate, note } = result.value as {
          dueDate: string | null;
          note: string | null;
        };
        this.actionMutation.mutate({
          id: order.id,
          action: 'DISPATCH',
          payload: { dueDate, note },
        });
      }
    });
  }

  async completeDelivery(order: OutboundOrderDetail): Promise<void> {
    if (!this.canDeliver(order)) return;

    // Lấy số dư chứng từ mới nhất từ API công nợ (không tự tính tổng - cọc,
    // vì khách có thể đã thanh toán thêm qua trang công nợ).
    const debt = await this.loadOutboundDebt(order);
    const outstanding = debt ? debt.outstandingAmount : null;
    const total = debt ? debt.totalAmount : null;
    const paid = debt ? debt.totalAmount - debt.outstandingAmount : null;

    const amountBlock =
      debt != null
        ? `<div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:12px 0">` +
          `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Tổng tiền phiếu:</span><b>${this.fmtMoney(
            total!,
          )}</b></div>` +
          `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Đã thanh toán/cọc:</span><b>${this.fmtMoney(
            paid!,
          )}</b></div>` +
          `<div style="display:flex;justify-content:space-between"><span>Còn phải thu:</span><b style="color:#dc2626">${this.fmtMoney(
            outstanding!,
          )}</b></div>` +
          `</div>`
        : `<div style="text-align:left;color:#64748b;font-size:13px;margin:12px 0">Chưa lấy được số dư công nợ của phiếu. Bạn vẫn có thể nhập số tiền; hệ thống sẽ kiểm tra khi lưu.</div>`;

    const quickButtons =
      `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">` +
      `<button type="button" id="pay-none" class="ob-quick-btn">Không thanh toán</button>` +
      (outstanding != null && outstanding > 0
        ? `<button type="button" id="pay-full" class="ob-quick-btn primary">Thanh toán toàn bộ</button>`
        : '') +
      `</div>`;

    const fieldLabel =
      'display:block;text-align:left;font-weight:600;margin:12px 0 4px';

    Swal.fire({
      title: 'Xác nhận đã giao hàng?',
      html:
        `<label style="${fieldLabel};margin-top:0" for="cd-receiver">Tên người nhận</label>` +
        `<input id="cd-receiver" class="swal2-input" style="margin:0;width:100%" placeholder="VD: Nguyễn Văn A">` +
        amountBlock +
        `<label style="${fieldLabel}" for="cd-payment">Số tiền khách thanh toán thêm (VNĐ)</label>` +
        `<input id="cd-payment" class="swal2-input" style="margin:0;width:100%" inputmode="numeric" value="0">` +
        quickButtons +
        `<label style="${fieldLabel}" for="cd-note">Ghi chú giao hàng</label>` +
        `<textarea id="cd-note" class="swal2-textarea" style="margin:0;width:100%" placeholder="Không bắt buộc…"></textarea>`,
      showCancelButton: true,
      confirmButtonText: 'Đã giao thành công',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a34a',
      focusConfirm: false,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      didOpen: () => {
        const payInput = document.getElementById(
          'cd-payment',
        ) as HTMLInputElement;
        const format = () => {
          const digits = payInput.value.replace(/\D/g, '');
          payInput.value = digits
            ? Number(digits).toLocaleString('vi-VN')
            : '0';
        };
        payInput.addEventListener('input', format);
        format();
        document.getElementById('pay-none')?.addEventListener('click', () => {
          payInput.value = '0';
          format();
        });
        document.getElementById('pay-full')?.addEventListener('click', () => {
          payInput.value = String(outstanding ?? 0);
          format();
        });
      },
      preConfirm: async () => {
        const receiver =
          (document.getElementById('cd-receiver') as HTMLInputElement)
            ?.value?.trim() || '';
        if (!receiver) {
          Swal.showValidationMessage('Vui lòng nhập tên người nhận.');
          return false;
        }
        const amount = this.parseMoney(
          (document.getElementById('cd-payment') as HTMLInputElement)?.value,
        );
        if (amount < 0) {
          Swal.showValidationMessage(
            'Số tiền khách thanh toán thêm không được âm.',
          );
          return false;
        }
        const note =
          (document.getElementById('cd-note') as HTMLTextAreaElement)
            ?.value?.trim() || null;
        try {
          const res = await lastValueFrom(
            this.service.completeDelivery(order.id, {
              receiverName: receiver,
              paymentAmount: amount,
              deliveryNote: note,
            }),
          );
          if (!res.isSucceeded) {
            Swal.showValidationMessage(
              res.message || 'Không xác nhận được giao hàng.',
            );
            return false;
          }
          return { ok: true, data: res.resources as CompleteDeliveryResult };
        } catch (error) {
          const status = (error as any)?.status;
          const msg = this.errorText(error);
          // 422: số tiền âm/vượt dư nợ/đã thu đủ/không có công nợ →
          // GIỮ popup mở để người dùng sửa số tiền.
          if (status === 422) {
            Swal.showValidationMessage(msg);
            return false;
          }
          // 400 (payload) / 409 (không còn "Đang giao") / khác → đóng popup,
          // báo lỗi nguyên văn từ backend.
          return { ok: false, error: msg };
        }
      },
    }).then((result) => {
      if (!result.isConfirmed || !result.value) return;
      const value = result.value as
        | { ok: true; data: CompleteDeliveryResult }
        | { ok: false; error: string };
      if (!value.ok) {
        this.alert(value.error, false);
        return;
      }
      this.refreshAfterWrite();
      this.notifyDeliveryDone(value.data);
    });
  }

  /** Thông báo kết quả sau khi giao hàng thành công. */
  private notifyDeliveryDone(data: CompleteDeliveryResult): void {
    const remaining = data.remainingDebt;
    let text = 'Đã xác nhận giao hàng thành công.';
    if (remaining === 0) {
      text = 'Khách hàng đã thanh toán đủ.';
    } else if (remaining != null && remaining > 0) {
      text = `Còn nợ ${this.fmtMoney(remaining)}.`;
    }
    Swal.fire({
      icon: 'success',
      title: 'Thành công',
      text,
      confirmButtonColor: '#16a34a',
    });
  }

  failDelivery(order: OutboundOrderDetail): void {
    if (!this.canDeliver(order)) return;
    Swal.fire({
      title: 'Giao hàng thất bại?',
      text: 'Tồn kho sẽ được hoàn nhập và công nợ (nếu có) được đảo lại.',
      icon: 'warning',
      input: 'text',
      inputLabel: 'Lý do thất bại',
      inputPlaceholder: 'VD: Khách không nhận hàng',
      showCancelButton: true,
      confirmButtonText: 'Ghi nhận thất bại',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) =>
        value && value.trim() ? null : 'Vui lòng nhập lý do thất bại.',
    }).then((result) => {
      if (result.isConfirmed) {
        this.actionMutation.mutate({
          id: order.id,
          action: 'FAIL',
          payload: { reason: (result.value as string).trim() },
        });
      }
    });
  }

  cancelOrder(order: OutboundOrderDetail): void {
    if (!this.canCancel(order)) return;
    Swal.fire({
      title: 'Hủy phiếu xuất?',
      html: `Phiếu <b>${order.soCode}</b> sẽ bị hủy và phần tồn đã giữ được giải phóng.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hủy phiếu',
      cancelButtonText: 'Không hủy',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (result.isConfirmed) {
        this.actionMutation.mutate({ id: order.id, action: 'CANCEL' });
      }
    });
  }

  // ── Guards ─────────────────────────────────────────────────────────
  canAllocate(source: OutboundStatusSource): boolean {
    return this.isStatus(source, OUTBOUND_STATUS_CODE.DRAFT);
  }
  canPick(source: OutboundStatusSource): boolean {
    return this.isStatus(source, OUTBOUND_STATUS_CODE.PICKING);
  }
  canPack(source: OutboundStatusSource): boolean {
    return this.isStatus(source, OUTBOUND_STATUS_CODE.PICKING);
  }
  canDispatch(source: OutboundStatusSource): boolean {
    return this.isStatus(source, OUTBOUND_STATUS_CODE.PACKED);
  }
  canDeliver(source: OutboundStatusSource): boolean {
    return this.isStatus(source, OUTBOUND_STATUS_CODE.DISPATCHED);
  }
  canCancel(source: OutboundStatusSource): boolean {
    return this.isStatusIn(source, [
      OUTBOUND_STATUS_CODE.DRAFT,
      OUTBOUND_STATUS_CODE.PICKING,
      OUTBOUND_STATUS_CODE.PACKED,
    ]);
  }

  isPickedEnough(order: OutboundOrderDetail): boolean {
    return order.items.every((item) => {
      const picked = item.allocations.length
        ? item.allocations.reduce(
            (sum, allocation) => sum + Number(allocation.quantityPicked || 0),
            0
          )
        : Number(item.quantityPicked || 0);
      return picked + 0.001 >= Number(item.quantityOrdered || 0);
    });
  }

  itemAllocatedKg(item: OutboundOrderItem): number {
    return item.allocations.reduce(
      (s, a) => s + Number(a.quantityAllocated || 0),
      0
    );
  }

  // ── trackBy: giữ nguyên DOM (ô input) khi cập nhật số lượng ──────────
  // Nếu không có trackBy, mỗi lần gõ 1 ký tự làm signal tạo object mới →
  // *ngFor huỷ & dựng lại <input> → mất focus. Track theo id ổn định.
  trackAllocItem = (_: number, item: AllocateItemForm): number => item.itemId;
  trackAllocLoc = (_: number, loc: AllocateLocationRow): string => loc.locationCode;
  trackPickRow = (_: number, row: PickLocationCard): string => row.key;

  // ── Formatting ─────────────────────────────────────────────────────
  fmtMoney(value: number | null | undefined): string {
    return `${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0))} ₫`;
  }

  fmtKg(value: number | null | undefined): string {
    return `${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 2,
    }).format(Number(value || 0))} kg`;
  }

  fmtNumber(value: number | null | undefined, digits = 2): string {
    return new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: digits,
    }).format(Number(value || 0));
  }

  fmtDate(value: string | null | undefined, includeTime = false): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(includeTime ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
    }).format(date);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  private async loadWarehouseLots(warehouseId: number): Promise<InventoryRow[]> {
    const body = this.inventoryService.buildPagedBody({
      page: 1,
      pageSize: 500,
      search: '',
      sortField: 'lotCode',
      sortDir: 'asc',
      colMap: {},
      warehouseId,
      withLotOnly: true,
    });
    const res = await lastValueFrom(this.inventoryService.getPagedAdvanced(body));
    const data = this.unwrap<DTResponse<InventoryRow>>(
      res,
      'Không tải được tồn kho khả dụng.'
    );
    return data?.data || [];
  }

  private sortValue(row: OutboundOrderRow, key: string): string | number {
    switch (key) {
      case 'soCode':
        return row.soCode || '';
      case 'customerName':
        return row.customerName || '';
      case 'warehouseName':
        return row.warehouseName || '';
      case 'value':
        return Number(row.totalDispatchedSaleValue || 0);
      case 'status':
        return this.statusRank(row);
      case 'createdDate':
      default:
        return row.createdDate ? new Date(row.createdDate).getTime() : 0;
    }
  }

  private actionMessage(action: OutboundAction): string {
    switch (action) {
      case 'PACKING':
        return 'Đóng gói hoàn tất. Phiếu chuyển sang Chờ xuất kho.';
      case 'DISPATCH':
        return 'Đã xuất kho. Đơn bán chuyển sang Đang giao.';
      case 'COMPLETE':
        return 'Đã xác nhận giao hàng thành công.';
      case 'FAIL':
        return 'Đã ghi nhận giao hàng thất bại và hoàn tồn.';
      default:
        return 'Đã hủy phiếu xuất.';
    }
  }

  private isStatus(
    source: OutboundStatusSource,
    status: OutboundStatusCode
  ): boolean {
    return this.statusCodeOf(source) === status;
  }

  private isStatusIn(
    source: OutboundStatusSource,
    statuses: readonly OutboundStatusCode[]
  ): boolean {
    const code = this.statusCodeOf(source);
    return code != null && statuses.includes(code);
  }

  private statusRank(source: OutboundStatusSource): number {
    const code = this.statusCodeOf(source);
    if (!code) return Number(source.outboundStatusId || 0);
    return [
      OUTBOUND_STATUS_CODE.DRAFT,
      OUTBOUND_STATUS_CODE.PICKING,
      OUTBOUND_STATUS_CODE.PACKED,
      OUTBOUND_STATUS_CODE.DISPATCHED,
      OUTBOUND_STATUS_CODE.COMPLETED,
      OUTBOUND_STATUS_CODE.CANCELLED,
      OUTBOUND_STATUS_CODE.DELIVERY_FAILED,
    ].indexOf(code);
  }

  private statusCodeOf(source: OutboundStatusSource): OutboundStatusCode | null {
    const code = (source.outboundStatusCode || '').toUpperCase();
    if (this.isKnownStatusCode(code)) return code;

    switch (source.outboundStatusId) {
      case OUTBOUND_STATUS.DRAFT:
        return OUTBOUND_STATUS_CODE.DRAFT;
      case OUTBOUND_STATUS.PICKING:
        return OUTBOUND_STATUS_CODE.PICKING;
      case OUTBOUND_STATUS.PACKED:
        return OUTBOUND_STATUS_CODE.PACKED;
      case OUTBOUND_STATUS.DISPATCHED:
        return OUTBOUND_STATUS_CODE.DISPATCHED;
      case OUTBOUND_STATUS.COMPLETED:
        return OUTBOUND_STATUS_CODE.COMPLETED;
      case OUTBOUND_STATUS.CANCELLED:
        return OUTBOUND_STATUS_CODE.CANCELLED;
      case OUTBOUND_STATUS.DELIVERY_FAILED:
        return OUTBOUND_STATUS_CODE.DELIVERY_FAILED;
      default:
        return null;
    }
  }

  private isKnownStatusCode(code: string): code is OutboundStatusCode {
    return Object.values(OUTBOUND_STATUS_CODE).includes(
      code as OutboundStatusCode
    );
  }

  private refreshAfterWrite(): void {
    // 'outbound-orders' phủ cả danh sách phiếu và chi tiết phiếu đang chọn
    // (queryKey chi tiết: ['outbound-orders', 'detail', id]).
    this.queryClient.invalidateQueries({ queryKey: ['outbound-orders'] });
    this.queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    this.queryClient.invalidateQueries({ queryKey: ['inventories'] });
    this.queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    // Làm mới cache/dữ liệu trang công nợ sau khi ghi nhận thanh toán.
    this.queryClient.invalidateQueries({ queryKey: ['party-debts'] });
    this.queryClient.invalidateQueries({ queryKey: ['reports'] });
  }

  /**
   * Tính giá trị phải thu dự kiến của phiếu xuất theo GIÁ BÁN (không dùng giá
   * vốn). Lấy đơn giá bán từ đơn bán (LineAmount / QuantityOrdered) rồi nhân
   * số lượng đã lấy của từng dòng. Trả -1 nếu không xác định được.
   */
  private async computeExpectedReceivable(
    order: OutboundOrderDetail,
  ): Promise<number> {
    try {
      const res = await lastValueFrom(
        this.salesOrderService.getById(order.salesOrderId),
      );
      const so = this.unwrap<SalesOrderDetail>(
        res,
        'Không tải được đơn bán.',
      );
      const unitByItem = new Map<number, number>();
      for (const it of so.items) {
        const unit =
          it.quantityOrdered > 0
            ? it.lineAmount / it.quantityOrdered
            : Number(it.unitSalePrice || 0);
        unitByItem.set(it.id, unit);
      }
      let total = 0;
      for (const item of order.items) {
        const unit =
          item.salesOrderItemId != null
            ? unitByItem.get(item.salesOrderItemId) ?? 0
            : 0;
        total += Number(item.quantityPicked || 0) * unit;
      }
      return total;
    } catch {
      return -1;
    }
  }

  /**
   * Lấy chứng từ công nợ phải thu của phiếu xuất này từ API công nợ.
   * Khớp theo refType = 'OUTBOUND_ORDER' và refId = order.id.
   */
  private async loadOutboundDebt(
    order: OutboundOrderDetail,
  ): Promise<DebtDocumentRow | null> {
    try {
      const request = this.partyDebtService.buildDocumentRequest(
        1,
        50,
        order.soCode,
        'RECEIVABLE',
        false,
      );
      const res = await lastValueFrom(
        this.partyDebtService.getDocuments(request),
      );
      const rows = this.unwrap<DTResponse<DebtDocumentRow>>(
        res,
        'Không tải được công nợ.',
      ).data;
      return (
        rows.find(
          (r) => r.refType === 'OUTBOUND_ORDER' && r.refId === order.id,
        ) ?? null
      );
    } catch {
      return null;
    }
  }

  /** Ngày hôm nay dạng yyyy-MM-dd (theo giờ địa phương) cho input date. */
  private todayIso(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  /** Ép chuỗi nhập (đã format VNĐ) về số thuần. */
  private parseMoney(raw: string | null | undefined): number {
    const digits = (raw ?? '').replace(/\D/g, '');
    return digits ? Number(digits) : 0;
  }

  private unwrap<T>(response: ApiResponse<T>, fallback: string): T {
    if (!response || response.isSucceeded === false) {
      throw new Error(response?.message || fallback);
    }
    return response.resources;
  }

  private errorText(error: unknown): string {
    const value = error as any;
    return (
      value?.error?.message ||
      value?.message ||
      'Có lỗi xảy ra. Vui lòng thử lại.'
    );
  }

  private alert(message: string, success = true): void {
    Swal.fire({
      icon: success ? 'success' : 'error',
      title: success ? 'Thành công' : 'Không thể thực hiện',
      text: message,
      confirmButtonColor: success ? '#16a34a' : '#dc2626',
    });
  }
}
