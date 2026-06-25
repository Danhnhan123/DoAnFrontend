import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';

import {
  ApiResponse,
  CreateInboundOrderDto,
  InboundOrderDetailDto,
  InboundOrderItemDto,
  InboundOrderListDto,
  InboundOrderPagingData,
  ProductVariantOption,
  WarehouseOption,
} from '../../models';

import { InboundOrderService } from '../../services/inbound-order.service';

interface CreateInboundLineForm {
  productVariantId: number | null;
  quantityOrdered: number;
  unitCostPrice: number;
  note: string;
}

interface CreateInboundOrderForm {
  warehouseId: number | null;
  supplierId: number | null;
  expectedDate: string;
  note: string;
  items: CreateInboundLineForm[];
}

@Component({
  selector: 'app-inbound-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inbound-order.component.html',
  styleUrl: './inbound-order.component.css',
})
export class InboundOrderComponent {
  private readonly inboundOrderService = inject(InboundOrderService);
  private readonly queryClient = injectQueryClient();

  // UI state local.
  page = signal(1);
  pageSize = signal(10);
  keyword = signal('');
  searchInput = signal('');

  selectedOrderId = signal<number | null>(null);

  showDetail = signal(false);
  showCreate = signal(false);

  createForm = signal<CreateInboundOrderForm>(this.emptyCreateForm());

  // Query danh sách phiếu inbound.
  listQuery = injectQuery(() => ({
    queryKey: [
      'inbound-orders',
      this.page(),
      this.pageSize(),
      this.keyword(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.inboundOrderService.getPaged({
          pageIndex: this.page(),
          pageSize: this.pageSize(),
          keyword: this.keyword(),
          sortType: 'desc',
          orderBy: 'createdDate',
        })
      ),
  }));

  // Query chi tiết chỉ chạy khi mở modal detail.
  detailQuery = injectQuery(() => ({
    queryKey: ['inbound-order-detail', this.selectedOrderId()],
    enabled: this.showDetail() && this.selectedOrderId() !== null,
    queryFn: () =>
      lastValueFrom(
        this.inboundOrderService.getById(this.selectedOrderId()!)
      ),
  }));

  // Lookup data cho modal tạo phiếu.
  warehousesQuery = injectQuery(() => ({
    queryKey: ['inbound-warehouse-options'],
    queryFn: () =>
      lastValueFrom(this.inboundOrderService.getWarehouses()),
    staleTime: 5 * 60 * 1000,
  }));

  productVariantsQuery = injectQuery(() => ({
    queryKey: ['inbound-product-variant-options'],
    queryFn: () =>
      lastValueFrom(this.inboundOrderService.getProductVariants()),
    staleTime: 5 * 60 * 1000,
  }));

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateInboundOrderDto) =>
      lastValueFrom(this.inboundOrderService.create(payload)),
    onSuccess: (response) =>
      this.handleMutationResponse(response, 'Đã tạo phiếu nhập.'),
    onError: (error) =>
      this.showApiError(error, 'Không thể tạo phiếu nhập.'),
  }));

  submitMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.inboundOrderService.submit(id)),
    onSuccess: (response) =>
      this.handleMutationResponse(
        response,
        'Đã gửi phiếu nhập để phê duyệt.'
      ),
    onError: (error) =>
      this.showApiError(error, 'Không thể gửi phiếu nhập.'),
  }));

  approveMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.inboundOrderService.approve(id)),
    onSuccess: (response) =>
      this.handleMutationResponse(response, 'Đã phê duyệt phiếu nhập.'),
    onError: (error) =>
      this.showApiError(error, 'Không thể phê duyệt phiếu nhập.'),
  }));

  rejectMutation = injectMutation(() => ({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      lastValueFrom(this.inboundOrderService.reject(id, reason)),
    onSuccess: (response) =>
      this.handleMutationResponse(response, 'Đã từ chối phiếu nhập.'),
    onError: (error) =>
      this.showApiError(error, 'Không thể từ chối phiếu nhập.'),
  }));

  cancelMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.inboundOrderService.cancel(id)),
    onSuccess: (response) =>
      this.handleMutationResponse(response, 'Đã hủy phiếu nhập.'),
    onError: (error) =>
      this.showApiError(error, 'Không thể hủy phiếu nhập.'),
  }));

  rows = computed<InboundOrderListDto[]>(() => {
    const payload = this.getPayload<InboundOrderPagingData>(
      this.listQuery.data()
    );

    return payload?.dataSource ?? [];
  });

  totalRecords = computed(() => {
    const payload = this.getPayload<InboundOrderPagingData>(
      this.listQuery.data()
    );

    return payload?.totalFiltered ?? payload?.total ?? 0;
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize()))
  );

  detail = computed<InboundOrderDetailDto | null>(() =>
    this.getPayload<InboundOrderDetailDto>(this.detailQuery.data()) ?? null
  );

  warehouses = computed<WarehouseOption[]>(() => {
    const data =
      this.getPayload<WarehouseOption[]>(this.warehousesQuery.data()) ?? [];

    return data.filter((warehouse) => warehouse.isActive);
  });

  productVariants = computed<ProductVariantOption[]>(() => {
    const data =
      this.getPayload<ProductVariantOption[]>(
        this.productVariantsQuery.data()
      ) ?? [];

    return data.filter((variant) => variant.isActive);
  });

  loading = computed(() => this.listQuery.isPending());

  loadingDetail = computed(
    () => this.detailQuery.isPending() || this.detailQuery.isFetching()
  );

  loadingLookups = computed(
    () =>
      this.warehousesQuery.isPending() ||
      this.productVariantsQuery.isPending()
  );

  saving = computed(() => this.createMutation.isPending());

  actionPending = computed(
    () =>
      this.submitMutation.isPending() ||
      this.approveMutation.isPending() ||
      this.rejectMutation.isPending() ||
      this.cancelMutation.isPending()
  );

  applySearch(): void {
    this.page.set(1);
    this.keyword.set(this.searchInput().trim());
  }

  clearSearch(): void {
    this.searchInput.set('');
    this.keyword.set('');
    this.page.set(1);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;

    this.page.set(page);
  }

  setPageSize(value: string | number): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
  }

  visiblePages(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const radius = 2;
    const pages: number[] = [];

    for (
      let value = Math.max(1, current - radius);
      value <= Math.min(total, current + radius);
      value++
    ) {
      pages.push(value);
    }

    return pages;
  }

  refresh(): void {
    this.listQuery.refetch();
  }

  openDetail(order: InboundOrderListDto): void {
    this.selectedOrderId.set(order.id);
    this.showDetail.set(true);
  }

  closeDetail(): void {
    this.showDetail.set(false);
    this.selectedOrderId.set(null);
  }

  openCreate(): void {
    this.createForm.set({
      ...this.emptyCreateForm(),
      warehouseId: this.warehouses()[0]?.id ?? null,
    });

    this.showCreate.set(true);
  }

  closeCreate(): void {
    if (this.saving()) return;

    this.showCreate.set(false);
  }

  setCreateField<K extends keyof Omit<CreateInboundOrderForm, 'items'>>(
    field: K,
    value: CreateInboundOrderForm[K]
  ): void {
    this.createForm.update((form) => ({
      ...form,
      [field]: value,
    }));
  }

  addLine(): void {
    this.createForm.update((form) => ({
      ...form,
      items: [...form.items, this.emptyLine()],
    }));
  }

  removeLine(index: number): void {
    this.createForm.update((form) => ({
      ...form,
      items: form.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  setLineField<K extends keyof CreateInboundLineForm>(
    index: number,
    field: K,
    value: CreateInboundLineForm[K]
  ): void {
    this.createForm.update((form) => ({
      ...form,
      items: form.items.map((line, itemIndex) =>
        itemIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  }

  setLineVariant(index: number, rawVariantId: string | number): void {
    const productVariantId = Number(rawVariantId) || null;

    const variant = this.productVariants().find(
      (item) => item.id === productVariantId
    );

    this.createForm.update((form) => ({
      ...form,
      items: form.items.map((line, itemIndex) =>
        itemIndex === index
          ? {
              ...line,
              productVariantId,
              unitCostPrice: variant?.costPrice ?? line.unitCostPrice,
            }
          : line
      ),
    }));
  }

  saveCreate(): void {
    const form = this.createForm();

    const invalidLine = form.items.some(
      (line) =>
        !line.productVariantId ||
        Number(line.quantityOrdered) <= 0 ||
        Number(line.unitCostPrice) < 0
    );

    if (!form.warehouseId) {
      this.showMessage(
        'Thiếu thông tin',
        'Vui lòng chọn kho nhận hàng.',
        'warning'
      );
      return;
    }

    if (form.items.length === 0 || invalidLine) {
      this.showMessage(
        'Dữ liệu chưa hợp lệ',
        'Mỗi dòng phải có SKU, số lượng lớn hơn 0 và giá nhập không âm.',
        'warning'
      );
      return;
    }

    const variantIds = form.items.map((line) => line.productVariantId!);

    if (new Set(variantIds).size !== variantIds.length) {
      this.showMessage(
        'SKU bị trùng',
        'Một SKU chỉ được xuất hiện một lần trong cùng phiếu nhập.',
        'warning'
      );
      return;
    }

    const payload: CreateInboundOrderDto = {
      warehouseId: Number(form.warehouseId),
      supplierId: form.supplierId ? Number(form.supplierId) : null,
      expectedDate: form.expectedDate || null,
      note: form.note.trim() || null,
      items: form.items.map((line) => ({
        productVariantId: Number(line.productVariantId),
        quantityOrdered: Number(line.quantityOrdered),
        unitCostPrice: Number(line.unitCostPrice),
        note: line.note.trim() || null,
      })),
    };

    this.createMutation.mutate(payload);
  }

  submit(order: InboundOrderListDto | InboundOrderDetailDto): void {
    this.confirmThen(
      'Gửi duyệt phiếu nhập?',
      `${order.poCode} sẽ được chuyển sang trạng thái Submitted.`,
      () => this.submitMutation.mutate(order.id)
    );
  }

  approve(order: InboundOrderListDto | InboundOrderDetailDto): void {
    this.confirmThen(
      'Phê duyệt phiếu nhập?',
      `${order.poCode} sẽ sẵn sàng cho quy trình nhận hàng.`,
      () => this.approveMutation.mutate(order.id)
    );
  }

  reject(order: InboundOrderListDto | InboundOrderDetailDto): void {
    Swal.fire({
      title: 'Từ chối phiếu nhập',
      text: `Nhập lý do từ chối ${order.poCode}.`,
      input: 'textarea',
      inputPlaceholder: 'Ví dụ: Thiếu thông tin nhà cung cấp hoặc SKU...',
      inputAttributes: {
        'aria-label': 'Lý do từ chối',
      },
      showCancelButton: true,
      confirmButtonText: 'Từ chối phiếu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#ef4444',
      preConfirm: (value) => {
        if (!String(value ?? '').trim()) {
          Swal.showValidationMessage(
            'Vui lòng nhập lý do từ chối.'
          );
          return false;
        }

        return String(value).trim();
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.rejectMutation.mutate({
          id: order.id,
          reason: result.value,
        });
      }
    });
  }

  cancel(order: InboundOrderListDto | InboundOrderDetailDto): void {
    this.confirmThen(
      'Hủy phiếu nhập?',
      `${order.poCode} sẽ bị hủy và không thể tiếp tục xử lý.`,
      () => this.cancelMutation.mutate(order.id),
      'warning'
    );
  }

  canSubmit(order: InboundOrderListDto | InboundOrderDetailDto): boolean {
    return this.normalizedStatus(order) === 'draft';
  }

  canApproveOrReject(
    order: InboundOrderListDto | InboundOrderDetailDto
  ): boolean {
    return this.normalizedStatus(order) === 'submitted';
  }

  canCancel(order: InboundOrderListDto | InboundOrderDetailDto): boolean {
    return ['draft', 'submitted', 'approved', 'receiving'].includes(
      this.normalizedStatus(order)
    );
  }

  statusClass(status: string): string {
    const normalized = status.trim().toLowerCase().replaceAll(' ', '-');

    const classMap: Record<string, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      approved: 'status-approved',
      receiving: 'status-receiving',
      'partially-received': 'status-partial',
      'fully-received': 'status-complete',
      confirmed: 'status-confirmed',
      rejected: 'status-rejected',
      cancelled: 'status-cancelled',
    };

    return classMap[normalized] ?? 'status-neutral';
  }

  receiptStatusClass(status: string): string {
    const normalized = status.trim().toLowerCase().replaceAll(' ', '-');

    if (normalized === 'confirmed') return 'receipt-confirmed';
    if (normalized === 'pendingmanagerreview') return 'receipt-warning';
    if (normalized === 'cancelled') return 'receipt-cancelled';
    if (normalized === 'putawayselected') return 'receipt-putaway';

    return 'receipt-neutral';
  }

  receiptProgress(item: InboundOrderItemDto): number {
    if (!item.quantityOrdered) return 0;

    return Math.min(
      100,
      Math.round(
        (item.quantityReceived / item.quantityOrdered) * 100
      )
    );
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'medium',
        }).format(date);
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(value ?? 0));
  }

  private emptyCreateForm(): CreateInboundOrderForm {
    return {
      warehouseId: null,
      supplierId: null,
      expectedDate: '',
      note: '',
      items: [this.emptyLine()],
    };
  }

  private emptyLine(): CreateInboundLineForm {
    return {
      productVariantId: null,
      quantityOrdered: 1,
      unitCostPrice: 0,
      note: '',
    };
  }

  private normalizedStatus(
    order: InboundOrderListDto | InboundOrderDetailDto
  ): string {
    return (order.inboundOrderStatusName || '')
      .trim()
      .toLowerCase();
  }

  private getPayload<T>(
    response: ApiResponse<T> | undefined
  ): T | null {
    return response?.resources ?? (response as any)?.data ?? null;
  }

  private handleMutationResponse(
    response: ApiResponse<unknown>,
    successMessage: string
  ): void {
    if (response?.isSucceeded === false) {
      this.showMessage(
        'Thao tác thất bại',
        response.message || 'Máy chủ không thể xử lý yêu cầu.',
        'error'
      );
      return;
    }

    this.showCreate.set(false);
    this.invalidateInboundQueries();

    this.showMessage('Thành công', successMessage, 'success');
  }

  private invalidateInboundQueries(): void {
    this.queryClient.invalidateQueries({
      queryKey: ['inbound-orders'],
    });

    this.queryClient.invalidateQueries({
      queryKey: ['inbound-order-detail'],
    });
  }

  private confirmThen(
    title: string,
    text: string,
    onConfirm: () => void,
    icon: 'question' | 'warning' = 'question'
  ): void {
    Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor:
        icon === 'warning' ? '#ef4444' : '#4f46e5',
    }).then((result) => {
      if (result.isConfirmed) {
        onConfirm();
      }
    });
  }

  private showApiError(error: unknown, fallback: string): void {
    const apiError = error as {
      error?: { message?: string };
      message?: string;
    };

    this.showMessage(
      'Thao tác thất bại',
      apiError?.error?.message || apiError?.message || fallback,
      'error'
    );
  }

  private showMessage(
    title: string,
    text: string,
    icon: 'success' | 'error' | 'warning'
  ): void {
    Swal.fire({
      title,
      text,
      icon,
      confirmButtonText: 'Đóng',
      confirmButtonColor:
        icon === 'error' ? '#ef4444' : '#4f46e5',
    });
  }
}