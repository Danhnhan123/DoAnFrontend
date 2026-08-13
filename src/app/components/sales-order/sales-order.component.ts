import { CommonModule } from '@angular/common';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';
import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
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
  ApiResponse,
  CreateOutboundPayload,
  CreateSalesOrderPayload,
  CustomerSalesOption,
  MillingOrderDetailDto,
  ProductVariantSalesOption,
  SALES_ORDER_STATUS,
  SalesOrderChannel,
  SalesOrderDetail,
  SalesOrderPage,
  SalesOrderRow,
  SalesOrderOutboundSummary,
  UpdateSalesOrderPayload,
  WarehouseSalesOption,
} from '../../models';
import { SalesOrderService } from '../../services/sales-order.service';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

type ChannelFilter = 'ALL' | SalesOrderChannel;
type SalesOrderAction = 'CONFIRM' | 'RESERVE' | 'CANCEL';

interface SalesOrderActionRequest {
  id: number;
  action: SalesOrderAction;
  /** Lý do hủy — chỉ dùng cho action CANCEL. */
  reason?: string | null;
}

interface SalesOrderFormLine {
  key: number;
  id?: number | null;
  productVariantId: number | null;
  quantityOrdered: number | null;
  unitSalePrice: number | null;
  discountAmount: number | null;
  note: string;
}

interface SalesOrderForm {
  customerId: number | null;
  warehouseId: number | null;
  channel: SalesOrderChannel;
  expectedDeliveryDate: string;
  requiresMilling: boolean;
  depositAmount: number | null;
  shippingAddress: string;
  note: string;
  items: SalesOrderFormLine[];
}

interface OutboundLine {
  productVariantId: number;
  productVariantName: string;
  sku?: string | null;
  orderedKg: number;
  quantityToDispatch: number | null;
}

@Component({
  selector: 'app-sales-order',
  standalone: true,
  imports: [
    HasPermissionDirective,
    ReadonlyIfDirective,
    CommonModule,
    FormsModule,
    FilterSelectComponent,
  ],
  templateUrl: './sales-order.component.html',
  styleUrl: './sales-order.component.css',
})
export class SalesOrderComponent implements OnDestroy {
  private readonly service = inject(SalesOrderService);
  private readonly queryClient = injectQueryClient();
  private readonly router = inject(Router);
  private lineKey = 1;

  readonly status = SALES_ORDER_STATUS;
  readonly pageSizeOptions = [10, 20, 50];

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly searchInput = signal('');
  readonly keyword = signal('');
  readonly channelFilter = signal<ChannelFilter>('ALL');
  readonly selectedId = signal<number | null>(null);

  readonly showFormModal = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly form = signal<SalesOrderForm>(this.blankForm());

  readonly showOutboundModal = signal(false);
  readonly outboundLines = signal<OutboundLine[]>([]);

  private searchTimer?: ReturnType<typeof setTimeout>;

  private readonly listQuery = injectQuery(() => ({
    queryKey: [
      'sales-orders',
      'paged',
      this.page(),
      this.pageSize(),
      this.keyword(),
    ],
    queryFn: async () =>
      this.unwrap<SalesOrderPage>(
        await lastValueFrom(
          this.service.getPaged({
            page: this.page(),
            pageSize: this.pageSize(),
            keyword: this.keyword() || null,
          })
        ),
        'Không tải được danh sách đơn bán.'
      ),
    placeholderData: keepPreviousData,
  }));

  private readonly detailQuery = injectQuery(() => ({
    queryKey: ['sales-orders', 'detail', this.selectedId()],
    enabled: this.selectedId() != null,
    queryFn: async () => {
      const id = this.selectedId();
      if (id == null) throw new Error('Chưa chọn đơn bán.');
      return this.unwrap<SalesOrderDetail>(
        await lastValueFrom(this.service.getById(id)),
        'Không tải được chi tiết đơn bán.'
      );
    },
  }));

  private readonly millingQuery = injectQuery(() => ({
    queryKey: ['sales-orders', 'milling-orders', this.selectedId()],
    enabled: this.selectedId() != null,
    queryFn: async () => {
      const id = this.selectedId();
      if (id == null) return [];
      return this.unwrapList<MillingOrderDetailDto>(
        await lastValueFrom(this.service.getMillingOrders(id)),
        'Không tải được lệnh xay liên quan.'
      );
    },
  }));

  private readonly customerQuery = injectQuery(() => ({
    queryKey: ['sales-order-options', 'customers'],
    queryFn: async () =>
      this.unwrapList<CustomerSalesOption>(
        await lastValueFrom(this.service.getCustomers()),
        'Không tải được khách hàng.'
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly warehouseQuery = injectQuery(() => ({
    queryKey: ['sales-order-options', 'warehouses'],
    queryFn: async () =>
      this.unwrapList<WarehouseSalesOption>(
        await lastValueFrom(this.service.getWarehouses()),
        'Không tải được danh sách kho.'
      ),
    staleTime: 5 * 60_000,
  }));

  private readonly variantQuery = injectQuery(() => ({
    queryKey: ['sales-order-options', 'product-variants'],
    queryFn: async () =>
      this.unwrapList<ProductVariantSalesOption>(
        await lastValueFrom(this.service.getProductVariants()),
        'Không tải được danh sách sản phẩm.'
      ),
    staleTime: 5 * 60_000,
  }));

  readonly pageRows = computed(() => this.listQuery.data()?.items || []);
  readonly rows = computed(() => {
    const channel = this.channelFilter();
    if (channel === 'ALL') return this.pageRows();
    return this.pageRows().filter((row) => row.channel === channel);
  });
  readonly total = computed(() => Number(this.listQuery.data()?.total || 0));
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );
  readonly loading = computed(() => this.listQuery.isPending());
  readonly fetching = computed(() => this.listQuery.isFetching());
  readonly detailLoading = computed(() => this.detailQuery.isFetching());
  readonly detail = computed(() => this.detailQuery.data() || null);
  readonly millingOrders = computed(() => this.millingQuery.data() || []);
  readonly millingFetching = computed(() => this.millingQuery.isFetching());

  readonly customers = computed(() =>
    (this.customerQuery.data() || [])
      .filter((item) => item.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  readonly warehouses = computed(() =>
    (this.warehouseQuery.data() || [])
      .filter((item) => item.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  readonly productVariants = computed(() =>
    (this.variantQuery.data() || [])
      .filter((item) => item.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  // ---- Options cho dropdown dùng chung (app-filter-select) ----
  readonly pageSizeSelectOptions: FilterSelectOption[] = [
    { id: 10, name: '10 / trang' },
    { id: 20, name: '20 / trang' },
    { id: 50, name: '50 / trang' },
  ];
  readonly channelSelectOptions: FilterSelectOption[] = [
    { id: 'DIRECT', name: 'Bán trực tiếp (DIRECT)' },
    { id: 'WHOLESALE', name: 'Bán sỉ (WHOLESALE)' },
  ];
  readonly customerSelectOptions = computed<FilterSelectOption[]>(() =>
    this.customers().map((c) => ({
      id: c.id,
      name: `${c.code ? c.code + ' · ' : ''}${c.name}`,
    }))
  );
  readonly warehouseSelectOptions = computed<FilterSelectOption[]>(() =>
    this.warehouses().map((w) => ({
      id: w.id,
      name: `${w.code ? w.code + ' · ' : ''}${w.name}`,
    }))
  );
  readonly variantSelectOptions = computed<FilterSelectOption[]>(() =>
    this.productVariants().map((v) => ({ id: v.id, name: `${v.sku} · ${v.name}` }))
  );

  readonly formSubtotal = computed(() =>
    this.form().items.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          Number(item.quantityOrdered || 0) *
            Number(item.unitSalePrice || 0)
        ),
      0
    )
  );
  readonly formDiscount = computed(() =>
    this.form().items.reduce(
      (sum, item) => sum + Math.max(0, Number(item.discountAmount || 0)),
      0
    )
  );
  readonly formTotal = computed(() =>
    Math.max(0, this.formSubtotal() - this.formDiscount())
  );
  readonly formRemaining = computed(() =>
    Math.max(0, this.formTotal() - Number(this.form().depositAmount || 0))
  );
  readonly isEditing = computed(() => this.editingId() != null);
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEditing() && !this.perm.canUpdate('SALE_ORDERS'));
  readonly saving = computed(() => this.saveMutation.isPending());
  readonly acting = computed(
    () => this.actionMutation.isPending() || this.outboundMutation.isPending()
  );
  readonly outboundSaving = computed(() => this.outboundMutation.isPending());

  readonly pageNewCount = computed(
    () => this.pageRows().filter((row) => row.statusId === this.status.NEW).length
  );
  readonly pageProcessingCount = computed(
    () =>
      this.pageRows().filter((row) =>
        this.isStatusIn(row.statusId, [
          this.status.PENDING_CONFIRM,
          this.status.RESERVED,
          this.status.AWAITING_MILLING,
          this.status.PREPARING,
          this.status.DELIVERING,
        ])
      ).length
  );
  readonly pageValue = computed(() =>
    this.pageRows().reduce((sum, row) => sum + Number(row.totalAmount || 0), 0)
  );

  private readonly selectVisibleRow = effect(() => {
    const rows = this.rows();
    const current = this.selectedId();
    if (!rows.length) {
      if (current != null) this.selectedId.set(null);
      return;
    }
    if (!rows.some((row) => row.id === current)) {
      this.selectedId.set(rows[0].id);
    }
  });

  private readonly saveMutation = injectMutation(() => ({
    mutationFn: (request: {
      id: number | null;
      create?: CreateSalesOrderPayload;
      update?: UpdateSalesOrderPayload;
    }) => {
      if (request.id != null && request.update) {
        return lastValueFrom(this.service.update(request.id, request.update));
      }
      if (request.create) {
        return lastValueFrom(this.service.create(request.create));
      }
      throw new Error('Dữ liệu lưu đơn không hợp lệ.');
    },
    onSuccess: (response: ApiResponse<any>, request) => {
      if (!response.isSucceeded) {
        this.alert(response.message || 'Không lưu được đơn bán.', false);
        return;
      }
      const createdId = Number(
        response.resources?.id ?? response.resources?.Id ?? 0
      );
      // onSuccess vẫn có thể chạy khi mutation còn isPending, vì vậy không gọi
      // closeForm() (hàm này cố ý chặn người dùng đóng modal lúc đang lưu).
      this.showFormModal.set(false);
      this.editingId.set(null);
      this.form.set(this.blankForm());
      if (createdId > 0) this.selectedId.set(createdId);
      this.refreshAfterWrite();
      this.alert(
        request.id == null
          ? 'Tạo đơn bán thành công.'
          : 'Cập nhật đơn bán thành công.'
      );
    },
    onError: (error: unknown) => this.alert(this.errorText(error), false),
  }));

  private readonly actionMutation = injectMutation(() => ({
    mutationFn: (request: SalesOrderActionRequest) => {
      if (request.action === 'CONFIRM') {
        return lastValueFrom(this.service.confirm(request.id));
      }
      if (request.action === 'RESERVE') {
        return lastValueFrom(this.service.reserve(request.id));
      }
      return lastValueFrom(this.service.cancel(request.id, request.reason));
    },
    onSuccess: (response: ApiResponse<any>, request) => {
      if (!response.isSucceeded) {
        this.alert(response.message || 'Không thực hiện được thao tác.', false);
        return;
      }
      this.refreshAfterWrite();
      const message =
        request.action === 'CONFIRM'
          ? 'Đã xác nhận đơn bán.'
          : request.action === 'RESERVE'
          ? 'Đã giữ hàng cho đơn bán.'
          : 'Đã hủy đơn bán.';
      this.alert(message);
    },
    onError: (error: unknown) => this.alert(this.errorText(error), false),
  }));

  private readonly outboundMutation = injectMutation(() => ({
    mutationFn: (request: { id: number; payload: CreateOutboundPayload }) =>
      lastValueFrom(this.service.createOutbound(request.id, request.payload)),
    onSuccess: (response: ApiResponse<any>) => {
      if (!response.isSucceeded) {
        this.alert(response.message || 'Không tạo được phiếu xuất.', false);
        return;
      }
      const outboundId = Number(
        response.resources?.outboundOrderId ??
          response.resources?.OutboundOrderId ??
          0
      );
      // Đóng trực tiếp sau success để không bị closeOutbound() chặn bởi
      // trạng thái isPending của mutation.
      this.showOutboundModal.set(false);
      this.outboundLines.set([]);
      this.refreshAfterWrite();
      this.alert(
        outboundId
          ? `Đã tạo phiếu xuất #${outboundId}.`
          : 'Đã tạo phiếu xuất kho.'
      );
    },
    onError: (error: unknown) => this.alert(this.errorText(error), false),
  }));

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.keyword.set(value.trim());
    }, 350);
  }

  setChannel(channel: ChannelFilter): void {
    this.channelFilter.set(channel);
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
      let page = Math.max(1, current - 2);
      page <= Math.min(this.totalPages(), current + 2);
      page++
    ) {
      pages.push(page);
    }
    return pages;
  }

  selectOrder(id: number): void {
    this.selectedId.set(id);
  }

  refresh(): void {
    this.queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.set(this.blankForm());
    this.showFormModal.set(true);
  }

  openEdit(): void {
    const order = this.detail();
    if (!order || !this.canEdit(order)) return;
    this.editingId.set(order.id);
    this.form.set({
      customerId: order.customerId,
      warehouseId: order.warehouseId ?? null,
      channel: order.channel,
      expectedDeliveryDate: this.toDateTimeInput(order.expectedDeliveryDate),
      requiresMilling: order.requiresMilling,
      depositAmount: order.depositAmount ?? 0,
      shippingAddress: order.shippingAddress || '',
      note: order.note || '',
      items: order.items.map((item) => ({
        key: this.lineKey++,
        id: item.id,
        productVariantId: item.productVariantId,
        quantityOrdered: item.quantityOrdered,
        unitSalePrice: item.unitSalePrice,
        discountAmount: item.discountAmount,
        note: item.note || '',
      })),
    });
    this.showFormModal.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.showFormModal.set(false);
    this.editingId.set(null);
    this.form.set(this.blankForm());
  }

  setFormField(field: keyof SalesOrderForm, value: unknown): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  setCustomer(value: string | number): void {
    const customerId = value ? Number(value) : null;
    this.form.update((current) => {
      const customer = this.customers().find((item) => item.id === customerId);
      return {
        ...current,
        customerId,
        shippingAddress:
          !this.isEditing() && !current.shippingAddress
            ? customer?.address || ''
            : current.shippingAddress,
      };
    });
  }

  addLine(): void {
    this.form.update((current) => ({
      ...current,
      items: [...current.items, this.blankLine()],
    }));
  }

  removeLine(index: number): void {
    this.form.update((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  setLineField(
    index: number,
    field: keyof SalesOrderFormLine,
    value: unknown
  ): void {
    this.form.update((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  selectVariant(index: number, value: string | number): void {
    const productVariantId = value ? Number(value) : null;
    const variant = this.productVariants().find(
      (item) => item.id === productVariantId
    );
    this.form.update((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productVariantId,
              unitSalePrice:
                item.productVariantId === productVariantId
                  ? item.unitSalePrice
                  : variant?.salePrice ?? 0,
            }
          : item
      ),
    }));
  }

  lineAmount(line: SalesOrderFormLine): number {
    return Math.max(
      0,
      Number(line.quantityOrdered || 0) * Number(line.unitSalePrice || 0) -
        Number(line.discountAmount || 0)
    );
  }

  submitForm(): void {
    const error = this.validateForm();
    if (error) {
      this.alert(error, false);
      return;
    }

    const current = this.form();
    const commonItems = current.items.map((item) => ({
      id: item.id ?? null,
      productVariantId: Number(item.productVariantId),
      quantityOrdered: Number(item.quantityOrdered),
      unitSalePrice: Number(item.unitSalePrice),
      discountAmount: Number(item.discountAmount || 0),
      note: item.note.trim() || null,
    }));
    const expectedDeliveryDate = current.expectedDeliveryDate
      ? new Date(current.expectedDeliveryDate).toISOString()
      : null;

    if (this.editingId() != null) {
      const update: UpdateSalesOrderPayload = {
        expectedDeliveryDate,
        shippingAddress: current.shippingAddress.trim() || null,
        depositAmount: Number(current.depositAmount || 0),
        note: current.note.trim() || null,
        items: commonItems,
      };
      this.saveMutation.mutate({ id: this.editingId(), update });
      return;
    }

    const create: CreateSalesOrderPayload = {
      customerId: Number(current.customerId),
      warehouseId: Number(current.warehouseId),
      channel: current.channel,
      expectedDeliveryDate,
      requiresMilling: current.requiresMilling,
      depositAmount: Number(current.depositAmount || 0),
      shippingAddress: current.shippingAddress.trim() || null,
      note: current.note.trim() || null,
      items: commonItems,
    };
    this.saveMutation.mutate({ id: null, create });
  }

  confirmOrder(order: SalesOrderDetail): void {
    Swal.fire({
      title: 'Xác nhận đơn bán?',
      text: `Đơn ${order.soCode} sẽ chuyển sang Chờ xác nhận.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận đơn',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#16a34a',
    }).then((result) => {
      if (result.isConfirmed) {
        this.actionMutation.mutate({ id: order.id, action: 'CONFIRM' });
      }
    });
  }

  reserveOrder(order: SalesOrderDetail): void {
    const millingNote = order.requiresMilling
      ? ' Backend chỉ cho giữ hàng sau khi lệnh xay liên quan đã hoàn tất.'
      : '';
    Swal.fire({
      title: 'Giữ hàng cho đơn?',
      text: `Hệ thống sẽ kiểm tra tồn khả dụng và hạn mức công nợ.${millingNote}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Kiểm tra & giữ hàng',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#7c3aed',
    }).then((result) => {
      if (result.isConfirmed) {
        this.actionMutation.mutate({ id: order.id, action: 'RESERVE' });
      }
    });
  }

  cancelOrder(order: SalesOrderDetail): void {
    Swal.fire({
      title: 'Hủy đơn bán?',
      text: `Đơn ${order.soCode} sẽ bị hủy và phần tồn đã giữ sẽ được giải phóng.`,
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Lý do hủy',
      inputPlaceholder: 'VD: Khách hủy đặt hàng…',
      inputAttributes: { maxlength: '500' },
      showCancelButton: true,
      confirmButtonText: 'Hủy đơn',
      cancelButtonText: 'Không hủy',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) =>
        value && value.trim() ? null : 'Vui lòng nhập lý do hủy.',
    }).then((result) => {
      if (result.isConfirmed) {
        this.actionMutation.mutate({
          id: order.id,
          action: 'CANCEL',
          reason: (result.value as string).trim(),
        });
      }
    });
  }

  openMillingOrders(order: SalesOrderDetail): void {
    this.router.navigate(['/admin/milling-orders'], {
      queryParams: { salesOrderId: order.id },
    });
  }

  openOutbound(order: SalesOrderDetail): void {
    this.outboundLines.set(
      order.items.map((item) => ({
        productVariantId: item.productVariantId,
        productVariantName: item.productVariantName,
        sku: item.sku,
        orderedKg: item.quantityOrdered,
        quantityToDispatch:
          order.outboundOrders.length === 0 ? item.quantityOrdered : null,
      }))
    );
    this.showOutboundModal.set(true);
  }

  activeDraftOutbound(order: SalesOrderDetail): SalesOrderOutboundSummary | null {
    return order.outboundOrders.find(
      (x) => (x.outboundStatusCode || '').toUpperCase() === 'DRAFT'
    ) ?? null;
  }

  continueDraftOutbound(order: SalesOrderDetail): void {
    const draft = this.activeDraftOutbound(order);
    if (!draft) return;
    this.router.navigate(['/admin/outbound-orders'], {
      queryParams: { outboundOrderId: draft.id, salesOrderId: order.id },
    });
  }

  closeOutbound(): void {
    if (this.outboundMutation.isPending()) return;
    this.showOutboundModal.set(false);
    this.outboundLines.set([]);
  }

  setOutboundQuantity(index: number, value: unknown): void {
    this.outboundLines.update((lines) =>
      lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              quantityToDispatch:
                value === '' || value == null ? null : Number(value),
            }
          : line
      )
    );
  }

  submitOutbound(): void {
    const order = this.detail();
    if (!order) return;
    const items = this.outboundLines()
      .filter((line) => Number(line.quantityToDispatch || 0) > 0)
      .map((line) => ({
        productVariantId: line.productVariantId,
        quantityToDispatch: Number(line.quantityToDispatch),
      }));

    if (!items.length) {
      this.alert('Nhập số lượng xuất lớn hơn 0 cho ít nhất một sản phẩm.', false);
      return;
    }
    if (
      this.outboundLines().some(
        (line) =>
          Number(line.quantityToDispatch || 0) < 0 ||
          Number(line.quantityToDispatch || 0) > line.orderedKg
      )
    ) {
      this.alert('Số lượng xuất không được vượt số lượng đặt của dòng.', false);
      return;
    }

    this.outboundMutation.mutate({ id: order.id, payload: { items } });
  }

  canEdit(order: SalesOrderRow): boolean {
    return order.statusId === this.status.NEW;
  }

  canConfirm(order: SalesOrderRow): boolean {
    return order.statusId === this.status.NEW;
  }

  canReserve(order: SalesOrderRow): boolean {
    return order.statusId === this.status.PENDING_CONFIRM;
  }

  canCreateOutbound(order: SalesOrderRow): boolean {
    return this.isStatusIn(order.statusId, [
      this.status.RESERVED,
      this.status.PREPARING,
    ]);
  }

  canCancel(order: SalesOrderRow): boolean {
    return this.isStatusIn(order.statusId, [
      this.status.NEW,
      this.status.PENDING_CONFIRM,
      this.status.RESERVED,
      this.status.PREPARING,
    ]);
  }

  channelLabel(channel: SalesOrderChannel): string {
    return channel === 'WHOLESALE' ? 'Bán sỉ' : 'Bán trực tiếp';
  }

  fmtMoney(value: number | null | undefined): string {
    return `${new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0))} ₫`;
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
      ...(includeTime
        ? ({ hour: '2-digit', minute: '2-digit' } as const)
        : {}),
    }).format(date);
  }

  private validateForm(): string | null {
    const current = this.form();
    if (!current.customerId) return 'Vui lòng chọn khách hàng.';
    if (!current.warehouseId) return 'Vui lòng chọn kho xuất.';
    if (!current.items.length) return 'Đơn bán phải có ít nhất một sản phẩm.';
    if (
      current.expectedDeliveryDate &&
      Number.isNaN(new Date(current.expectedDeliveryDate).getTime())
    ) {
      return 'Ngày giao dự kiến không hợp lệ.';
    }

    const variantIds = current.items.map((item) =>
      Number(item.productVariantId || 0)
    );
    if (variantIds.some((id) => id <= 0)) {
      return 'Vui lòng chọn sản phẩm cho tất cả các dòng.';
    }
    if (new Set(variantIds).size !== variantIds.length) {
      return 'Không được thêm hai dòng có cùng một SKU.';
    }

    for (const item of current.items) {
      if (Number(item.quantityOrdered || 0) <= 0) {
        return 'Số lượng của mỗi dòng phải lớn hơn 0.';
      }
      if (Number(item.unitSalePrice || 0) < 0) {
        return 'Đơn giá không được âm.';
      }
      if (Number(item.discountAmount || 0) < 0) {
        return 'Giảm giá không được âm.';
      }
      if (
        Number(item.discountAmount || 0) >
        Number(item.quantityOrdered || 0) * Number(item.unitSalePrice || 0)
      ) {
        return 'Giảm giá của dòng không được vượt tiền hàng.';
      }
    }

    const deposit = Number(current.depositAmount || 0);
    if (deposit < 0) return 'Tiền cọc không được âm.';
    if (deposit > this.formTotal()) {
      return 'Tiền cọc không được vượt tổng tiền đơn.';
    }
    return null;
  }

  private blankForm(): SalesOrderForm {
    return {
      customerId: null,
      warehouseId: null,
      channel: 'DIRECT',
      expectedDeliveryDate: '',
      requiresMilling: false,
      depositAmount: 0,
      shippingAddress: '',
      note: '',
      items: [this.blankLine()],
    };
  }

  private blankLine(): SalesOrderFormLine {
    return {
      key: this.lineKey++,
      productVariantId: null,
      quantityOrdered: null,
      unitSalePrice: null,
      discountAmount: 0,
      note: '',
    };
  }

  private toDateTimeInput(value?: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  private isStatusIn(statusId: number, statuses: readonly number[]): boolean {
    return statuses.includes(statusId);
  }

  private refreshAfterWrite(): void {
    this.queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    this.queryClient.invalidateQueries({
      queryKey: ['milling-order-options', 'sales-orders'],
    });
    this.queryClient.invalidateQueries({ queryKey: ['inventories'] });
  }

  private unwrap<T>(response: ApiResponse<T>, fallback: string): T {
    if (!response || response.isSucceeded === false) {
      throw new Error(response?.message || fallback);
    }
    return response.resources;
  }

 private unwrapList<T>(
  response: ApiResponse<any>,
  fallback: string
): T[] {
  const resource = this.unwrap<any>(response, fallback);

  if (Array.isArray(resource)) {
    return resource as T[];
  }

  return (
    resource?.items ||
    resource?.dataSource ||
    resource?.data ||
    resource?.Items ||
    resource?.DataSource ||
    []
  ) as T[];
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
