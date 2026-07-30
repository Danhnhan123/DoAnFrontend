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
  ProductVariantRow,
  ProductVariantDetailDto,
  CreateProductVariantDto,
  UpdateProductVariantDto,
  ProductOption,
} from '../../models';
import { ProductVariantService } from '../../services/product-variant.service';
import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';

@Component({
  selector: 'app-product-variant',
  standalone: true,
  imports: [ReadonlyIfDirective, HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './product-variant.component.html',
  styleUrl: './product-variant.component.css',
})
export class ProductVariantComponent {
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEdit() && !this.perm.canUpdate('PRODUCT_VARIANTS'));
    private variantService = inject(ProductVariantService);
    private queryClient = injectQueryClient();

    // =========================
  // 1. State cho bảng
  // =========================

  page = signal(1);
  pageSize = signal(10);
  search = signal('');

  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterProductId = signal<number | null>(null);

  // =========================
  // 2. State cho modal form
  // =========================

  showModal = signal(false);
  editItem = signal<ProductVariantRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    name: '',
    description: '',
    productId: 0,
    unitOfMeasureId: 1,
    sku: '',
    barcode: '',
    qrCode: '',
    costPrice: 0,
    salePrice: 0,
    weight: 0,
    attributeValues: '',
    imageId: null,
    isActive: true,
    minStockLevel: null,
  });

  /**
   * Map tên field frontend sang index cột trong body DataTables.
   * Khi bấm sort, backend sẽ lấy columns[order[0].column].data để sort.
   */
  private readonly colMap: Record<string, number> = {
    id: 0,
    name: 1,
    productName: 2,
    unitOfMeasureName: 3,
    sku: 4,
    salePrice: 5,
    isActive: 6,
    createdDate: 7,
  };

  // =========================
  // 3. Queries
  // =========================

  /**
   * Query lấy danh sách biến thể.
   * Khi page/search/sort/filter thay đổi, queryKey thay đổi,
   * TanStack Query sẽ tự gọi lại queryFn.
   */
  listQuery = injectQuery(() => ({
    queryKey: [
      'product-variants',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterProductId(),
    ],
    queryFn: () => {
      const body = this.variantService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterProductId: this.filterProductId(),
      });

      return lastValueFrom(this.variantService.getPagedAdvanced(body));
    },
  }));


  /**
   * Query lấy danh sách sản phẩm gốc cho select filter và form.
   */
  productsQuery = injectQuery(() => ({
    queryKey: ['product-options'],
    queryFn: () => lastValueFrom(this.variantService.getProducts()),
  }));

  /**
   * Query lấy chi tiết khi sửa.
   * enabled giúp query chỉ chạy khi modal mở và có editItem.id.
   */
  detailQuery = injectQuery(() => ({
    queryKey: ['product-variant-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.variantService.getById(this.editItem()!.id)),
  }));

  // =========================
  // 4. Computed data cho HTML
  // =========================

  rows = computed<ProductVariantRow[]>(() => {
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

  productOptions = computed<ProductOption[]>(() => {
    return (this.productsQuery.data() as any)?.resources ?? [];
  });

  activeCount = computed(() =>
    this.rows().filter((x) => x.isActive).length
  );

  inactiveCount = computed(() =>
    this.rows().filter((x) => !x.isActive).length
  );

  lowStockCount = computed(() =>
    this.rows().filter((x) => Number(x.minStockLevel ?? 0) > 0).length
  );

  /**
   * Khi detailQuery lấy xong dữ liệu, đổ dữ liệu vào form.
   */
  private syncDetail = effect(() => {
    const d = this.detailQuery.data();

    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: ProductVariantDetailDto =
      (d as any)?.resources ?? (d as any)?.data;

    if (!detail) return;

    this.form.set({
      name: detail.name || '',
      description: detail.description || '',
      productId: detail.productId || 0,
      unitOfMeasureId: detail.unitOfMeasureId || 1,
      sku: detail.sku || '',
      qrCode: detail.qrCode || '',
      costPrice: detail.costPrice ?? 0,
      salePrice: detail.salePrice ?? 0,
      weight: detail.weight ?? 0,
      attributeValues: detail.attributeValues || '',
      imageId: detail.imageId ?? null,
      isActive: detail.isActive ?? true,
      minStockLevel: detail.minStockLevel ?? null,
    });
  });

  // =========================
  // 5. Mutations
  // =========================

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateProductVariantDto) =>
      lastValueFrom(this.variantService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({
          queryKey: ['product-variants'],
        });
        this.showAlert('Thêm biến thể thành công!');
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
    mutationFn: (payload: UpdateProductVariantDto) =>
      lastValueFrom(this.variantService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({
          queryKey: ['product-variants'],
        });
        this.showAlert('Cập nhật biến thể thành công!');
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
    mutationFn: (id: number) =>
      lastValueFrom(this.variantService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({
          queryKey: ['product-variants'],
        });
        this.showAlert('Đã xóa biến thể!');
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


  // =========================
  // 6. Table helpers
  // =========================

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }

  applyFilter(): void {
    this.page.set(1);
  }

  clearFilter(): void {
    this.filterProductId.set(null);
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

    for (
      let i = Math.max(1, cur - d);
      i <= Math.min(total, cur + d);
      i++
    ) {
      pages.push(i);
    }

    return pages;
  }

  // =========================
  // 7. Modal helpers
  // =========================

  openCreate(): void {
    this.editItem.set(null);

    this.form.set({
      name: '',
      description: '',
      productId: this.productOptions()[0]?.id || 0,
      unitOfMeasureId: 1,
      sku: '',
      barcode: '',
      qrCode: '',
      costPrice: 0,
      salePrice: 0,
      weight: 0,
      attributeValues: '',
      imageId: null,
      isActive: true,
      minStockLevel: null,
    });

    this.showModal.set(true);
  }

  openEdit(row: ProductVariantRow): void {
    this.editItem.set(row);

    this.form.set({
      name: row.name || '',
      description: row.description || '',
      productId: row.productId || 0,
      unitOfMeasureId: row.unitOfMeasureId || 1,
      sku: row.sku || '',
      qrCode: row.qrCode || '',
      costPrice: row.costPrice ?? 0,
      salePrice: row.salePrice ?? 0,
      weight: row.weight ?? 0,
      attributeValues: row.attributeValues || '',
      imageId: row.imageId ?? null,
      isActive: row.isActive ?? true,
      minStockLevel: row.minStockLevel ?? null,
    });

    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }

  setField(field: string, value: any): void {
    this.form.update((x) => ({
      ...x,
      [field]: value,
    }));
  }

  // =========================
  // 8. Save/delete/QR
  // =========================

  save(): void {
    const f = this.form();

    if (!f.name || !f.productId || !f.unitOfMeasureId || !f.sku) {
      this.showAlert(
        'Vui lòng nhập tên biến thể, sản phẩm, đơn vị tính và SKU',
        false
      );
      return;
    }

    const payloadBase: CreateProductVariantDto = {
      name: f.name,
      description: f.description || undefined,
      productId: Number(f.productId),
      unitOfMeasureId: Number(f.unitOfMeasureId),
      sku: f.sku,
      qrCode: f.qrCode || undefined,
      costPrice: Number(f.costPrice || 0),
      salePrice: Number(f.salePrice || 0),
      weight: Number(f.weight || 0),
      attributeValues: f.attributeValues || undefined,
      imageId: f.imageId ? Number(f.imageId) : null,
      isActive: !!f.isActive,
      minStockLevel:
        f.minStockLevel === null || f.minStockLevel === ''
          ? null
          : Number(f.minStockLevel),
    };

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';

    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} biến thể sản phẩm này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      if (this.isEdit()) {
        const payload: UpdateProductVariantDto = {
          ...payloadBase,
          id: this.editItem()!.id,
        };

        this.updateMutation.mutate(payload);
      } else {
        this.createMutation.mutate(payloadBase);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa biến thể?',
      text: `Bạn có chắc muốn xóa "${name}"?`,
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

  openQrCode(row: ProductVariantRow): void {
    window.open(this.variantService.getQrCodeUrl(row.id), '_blank');
  }

  openQrLabel(row: ProductVariantRow): void {
    window.open(this.variantService.getQrLabelUrl(row.id), '_blank');
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
