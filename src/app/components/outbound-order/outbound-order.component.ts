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
  AllocateOutboundPayload,
  ApiResponse,
  DTResponse,
  InventoryRow,
  OUTBOUND_STATUS,
  OutboundOrderDetail,
  OutboundOrderItem,
  OutboundOrderPage,
  OutboundOrderRow,
  PickOutboundPayload,
} from '../../models';
import { InventoryService } from '../../services/inventory.service';
import { OutboundOrderService } from '../../services/outbound-order.service';

type StatusFilter = 'ALL' | number;
type SortDir = 'asc' | 'desc';
type OutboundAction =
  | 'DISPATCH'
  | 'COMPLETE'
  | 'FAIL'
  | 'CANCEL'
  | 'PACKING';

interface AllocateLotRow {
  inventoryId: number;
  lotCode: string;
  locationCode: string;
  availableKg: number;
  qty: number | null;
}

interface AllocateItemForm {
  itemId: number;
  productVariantName: string;
  sku: string;
  orderedKg: number;
  alreadyAllocatedKg: number;
  lots: AllocateLotRow[];
}

interface PickRow {
  allocationId: number;
  lotCode: string;
  locationCode: string;
  productVariantName: string;
  allocatedKg: number;
  pickedKg: number | null;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './outbound-order.component.html',
  styleUrl: './outbound-order.component.css',
})
export class OutboundOrderComponent implements OnDestroy {
  private readonly service = inject(OutboundOrderService);
  private readonly inventoryService = inject(InventoryService);
  private readonly queryClient = injectQueryClient();
  private readonly router = inject(Router);

  readonly status = OUTBOUND_STATUS;
  readonly pipelineSteps = PIPELINE_STEPS;
  readonly pageSizeOptions = [10, 20, 50];

  /** Nhãn trạng thái tiếng Việt theo id (khớp OutboundOrderStatusSeed). */
  private readonly statusLabels: Record<number, string> = {
    [OUTBOUND_STATUS.DRAFT]: 'Nháp',
    [OUTBOUND_STATUS.PICKING]: 'Đang lấy hàng',
    [OUTBOUND_STATUS.PACKED]: 'Chờ xuất kho',
    [OUTBOUND_STATUS.DISPATCHED]: 'Đang giao',
    [OUTBOUND_STATUS.COMPLETED]: 'Hoàn tất',
    [OUTBOUND_STATUS.CANCELLED]: 'Đã hủy',
    [OUTBOUND_STATUS.DELIVERY_FAILED]: 'Giao thất bại',
  };

  /** Trả nhãn tiếng Việt; fallback về tên gốc từ backend nếu id lạ. */
  statusLabel(statusId: number, fallback?: string | null): string {
    return this.statusLabels[statusId] || fallback || '—';
  }

  readonly statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: 'Tất cả' },
    { key: OUTBOUND_STATUS.DRAFT, label: 'Nháp' },
    { key: OUTBOUND_STATUS.PICKING, label: 'Đang lấy hàng' },
    { key: OUTBOUND_STATUS.PACKED, label: 'Chờ xuất kho' },
    { key: OUTBOUND_STATUS.DISPATCHED, label: 'Đang giao' },
    { key: OUTBOUND_STATUS.COMPLETED, label: 'Hoàn tất' },
    { key: OUTBOUND_STATUS.DELIVERY_FAILED, label: 'Giao lỗi' },
    { key: OUTBOUND_STATUS.CANCELLED, label: 'Đã hủy' },
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
  readonly pickForm = signal<PickRow[]>([]);

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
      list = list.filter((row) => row.outboundStatusId === filter);
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
        (r) => r.outboundStatusId === this.status.DISPATCHED
      ).length
  );
  readonly pageWaitingCount = computed(
    () =>
      this.pageRows().filter((r) =>
        this.isStatusIn(r.outboundStatusId, [
          this.status.DRAFT,
          this.status.PICKING,
          this.status.PACKED,
        ])
      ).length
  );

  /** Bước pipeline đang active theo trạng thái phiếu đang chọn. */
  readonly activeStep = computed(() => {
    const order = this.detail();
    if (!order) return 0;
    switch (order.outboundStatusId) {
      case this.status.DRAFT:
        return 2;
      case this.status.PICKING:
        return 3;
      case this.status.PACKED:
        return 4;
      case this.status.DISPATCHED:
        return 6;
      case this.status.COMPLETED:
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
    if (order.outboundStatusId !== this.status.DRAFT) return;
    this.showAllocateModal.set(true);
    this.loadingLots.set(true);
    this.allocateForm.set([]);
    try {
      const rows = await this.loadWarehouseLots(order.warehouseId);
      const form: AllocateItemForm[] = order.items.map((item) => {
        const already = item.allocations.reduce(
          (s, a) => s + Number(a.quantityAllocated || 0),
          0
        );
        const lots = rows
          .filter(
            (r) =>
              r.productVariantId === item.productVariantId &&
              Number(r.quantityAvailable || 0) > 0 &&
              r.lotIsSellable !== false
          )
          .map((r) => ({
            inventoryId: r.id,
            lotCode: r.lotCode || `INV-${r.id}`,
            locationCode: r.locationCode || '—',
            availableKg: Number(r.quantityAvailable || 0),
            qty: null as number | null,
          }));
        return {
          itemId: item.id,
          productVariantName: item.productVariantName,
          sku: item.sku || '',
          orderedKg: Number(item.quantityOrdered || 0),
          alreadyAllocatedKg: already,
          lots,
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

  setAllocateQty(itemIndex: number, lotIndex: number, value: unknown): void {
    this.allocateForm.update((form) =>
      form.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              lots: item.lots.map((lot, j) =>
                j === lotIndex
                  ? { ...lot, qty: value === '' || value == null ? null : Number(value) }
                  : lot
              ),
            }
          : item
      )
    );
  }

  allocatedTotal(item: AllocateItemForm): number {
    return item.lots.reduce((s, l) => s + Number(l.qty || 0), 0);
  }

  allocateRemaining(item: AllocateItemForm): number {
    return item.orderedKg - item.alreadyAllocatedKg - this.allocatedTotal(item);
  }

  submitAllocate(): void {
    const order = this.detail();
    if (!order) return;
    const form = this.allocateForm();

    const allocations = form
      .map((item) => ({
        outboundOrderItemId: item.itemId,
        lots: item.lots
          .filter((l) => Number(l.qty || 0) > 0)
          .map((l) => ({
            inventoryId: l.inventoryId,
            quantityAllocated: Number(l.qty),
          })),
      }))
      .filter((a) => a.lots.length > 0);

    if (!allocations.length) {
      this.alert('Nhập số lượng phân bổ cho ít nhất một lô.', false);
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
      for (const lot of item.lots) {
        if (Number(lot.qty || 0) > lot.availableKg + 0.001) {
          this.alert(
            `Lô ${lot.lotCode} chỉ còn ${this.fmtKg(lot.availableKg)} khả dụng.`,
            false
          );
          return;
        }
      }
    }

    this.allocateMutation.mutate({ id: order.id, payload: { allocations } });
  }

  // ── Pick ───────────────────────────────────────────────────────────
  openPick(order: OutboundOrderDetail): void {
    if (order.outboundStatusId !== this.status.PICKING) return;
    const rows: PickRow[] = [];
    for (const item of order.items) {
      for (const alloc of item.allocations) {
        rows.push({
          allocationId: alloc.id,
          lotCode: alloc.paddyLotCode || `INV-${alloc.inventoryId}`,
          locationCode: alloc.locationCode || '—',
          productVariantName: item.productVariantName,
          allocatedKg: Number(alloc.quantityAllocated || 0),
          pickedKg:
            Number(alloc.quantityPicked || 0) > 0
              ? Number(alloc.quantityPicked)
              : Number(alloc.quantityAllocated || 0),
        });
      }
    }
    if (!rows.length) {
      this.alert('Phiếu chưa có phân bổ lô để lấy hàng.', false);
      return;
    }
    this.pickForm.set(rows);
    this.showPickModal.set(true);
  }

  closePick(): void {
    if (this.pickMutation.isPending()) return;
    this.showPickModal.set(false);
    this.pickForm.set([]);
  }

  setPickQty(index: number, value: unknown): void {
    this.pickForm.update((rows) =>
      rows.map((r, i) =>
        i === index
          ? { ...r, pickedKg: value === '' || value == null ? null : Number(value) }
          : r
      )
    );
  }

  submitPick(): void {
    const order = this.detail();
    if (!order) return;
    const rows = this.pickForm();
    for (const r of rows) {
      const picked = Number(r.pickedKg || 0);
      if (picked < 0 || picked > r.allocatedKg + 0.001) {
        this.alert(
          `Số lượng lấy của lô ${r.lotCode} phải trong khoảng 0 – ${this.fmtKg(r.allocatedKg)}.`,
          false
        );
        return;
      }
    }
    const picks = rows.map((r) => ({
      allocationId: r.allocationId,
      quantityPicked: Number(r.pickedKg || 0),
    }));
    this.pickMutation.mutate({ id: order.id, payload: { picks } });
  }

  // ── Packing ────────────────────────────────────────────────────────
  openPacking(order: OutboundOrderDetail): void {
    if (order.outboundStatusId !== this.status.PICKING) return;
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
  confirmDispatch(order: OutboundOrderDetail): void {
    if (order.outboundStatusId !== this.status.PACKED) return;
    Swal.fire({
      title: 'Xác nhận xuất kho?',
      html: `Phiếu <b>${order.soCode}</b> sẽ trừ tồn thực tế, ghi InventoryTransaction và chuyển đơn bán sang <b>Đang giao</b>.`,
      icon: 'question',
      input: 'textarea',
      inputPlaceholder: 'Ghi chú xuất kho (không bắt buộc)…',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận xuất kho',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a34a',
    }).then((result) => {
      if (result.isConfirmed) {
        this.actionMutation.mutate({
          id: order.id,
          action: 'DISPATCH',
          payload: { note: (result.value as string)?.trim() || null },
        });
      }
    });
  }

  completeDelivery(order: OutboundOrderDetail): void {
    if (order.outboundStatusId !== this.status.DISPATCHED) return;
    Swal.fire({
      title: 'Xác nhận đã giao hàng?',
      input: 'text',
      inputLabel: 'Tên người nhận',
      inputPlaceholder: 'VD: Nguyễn Văn A',
      showCancelButton: true,
      confirmButtonText: 'Đã giao thành công',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a34a',
      inputValidator: (value) =>
        value && value.trim() ? null : 'Vui lòng nhập tên người nhận.',
    }).then((result) => {
      if (result.isConfirmed) {
        this.actionMutation.mutate({
          id: order.id,
          action: 'COMPLETE',
          payload: { receiverName: (result.value as string).trim() },
        });
      }
    });
  }

  failDelivery(order: OutboundOrderDetail): void {
    if (order.outboundStatusId !== this.status.DISPATCHED) return;
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
    if (!this.canCancel(order.outboundStatusId)) return;
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
  canAllocate(statusId: number): boolean {
    return statusId === this.status.DRAFT;
  }
  canPick(statusId: number): boolean {
    return statusId === this.status.PICKING;
  }
  canPack(statusId: number): boolean {
    return statusId === this.status.PICKING;
  }
  canDispatch(statusId: number): boolean {
    return statusId === this.status.PACKED;
  }
  canDeliver(statusId: number): boolean {
    return statusId === this.status.DISPATCHED;
  }
  canCancel(statusId: number): boolean {
    return this.isStatusIn(statusId, [
      this.status.DRAFT,
      this.status.PICKING,
      this.status.PACKED,
    ]);
  }

  itemAllocatedKg(item: OutboundOrderItem): number {
    return item.allocations.reduce(
      (s, a) => s + Number(a.quantityAllocated || 0),
      0
    );
  }

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
        return Number(row.outboundStatusId || 0);
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

  private isStatusIn(statusId: number, statuses: readonly number[]): boolean {
    return statuses.includes(statusId);
  }

  private refreshAfterWrite(): void {
    this.queryClient.invalidateQueries({ queryKey: ['outbound-orders'] });
    this.queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    this.queryClient.invalidateQueries({ queryKey: ['inventories'] });
    this.queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
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
