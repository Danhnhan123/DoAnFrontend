import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectMutation,
  injectQuery,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';
import {
  CreateProductDto,
  ProductAdvancedRow,
  ProductCategoryOption,
  ProductDetailDto,
  UpdateProductDto,
} from '../../models/product';
import { ProductService } from '../../services/product.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './product.component.html',
  styleUrl: './product.component.css',
})
export class ProductComponent {
  private productService = inject(ProductService);
  private queryClient = injectQueryClient();

  filterVersion = signal(0);
  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterName = signal('');
  filterDescription = signal('');
  filterCategoryId = signal<number | null>(null); 
  filterActive = signal<'' | 'true' | 'false'>('');
  filterDateFrom = signal('');
  filterDateTo = signal('');

  readonly activeOptions = [
    { id: 'true', name: 'Đang bán' },
    { id: 'false', name: 'Ngừng bán' },
  ];

  showDetail = signal(false);
  selectedItem = signal<ProductAdvancedRow | null>(null);

  showForm = signal(false);
  editItem = signal<ProductAdvancedRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  form = signal<CreateProductDto>({
    name: '',
    description: '',
    productCategoryId: 0,
    isActive: true,
  });

  readonly colMap: Record<string, number> = {
    id: 0,
    name: 1,
    description: 2,
    productCategoryName: 3,
    isActive: 4,
    createdDate: 5,
  };

  listQuery = injectQuery(() => ({
    // Logic cache: mọi tham số lọc/phân trang/sắp xếp nằm trong queryKey để TanStack Query tự refetch đúng lúc.
    queryKey: [
      'products',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterName(),
      this.filterDescription(),
      this.filterCategoryId(),
      this.filterActive(),
      this.filterDateFrom(),
      this.filterDateTo(),
    ],
    queryFn: () => {
      // Logic API: build body đúng format DataTables mà backend paged-advanced đang nhận.
      const body = this.productService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterName: this.filterName(),
        filterDescription: this.filterDescription(),
        filterCategoryId: this.filterCategoryId(),
        filterActive: this.filterActive(),
        filterDateFrom: this.filterDateFrom(),
        filterDateTo: this.filterDateTo(),
      });
      return lastValueFrom(this.productService.getPagedAdvanced(body));
    },
  }));

  categoriesQuery = injectQuery(() => ({
    queryKey: ['product-category-options'],
    queryFn: () => lastValueFrom(this.productService.getProductCategories()),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['product-detail', this.selectedItem()?.id],
    enabled: !!this.selectedItem()?.id && this.showDetail(),
    queryFn: () =>
      lastValueFrom(this.productService.getById(this.selectedItem()!.id)),
  }));

  editDetailQuery = injectQuery(() => ({
    queryKey: ['product-edit-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showForm(),
    queryFn: () => lastValueFrom(this.productService.getById(this.editItem()!.id)),
  }));

  private syncEditDetail = effect(() => {
    const data = this.editDetailQuery.data();
    if (!data || !this.showForm()) return;
    const detail: ProductDetailDto | null = this.getPayload(data);
    if (detail) this.patchFormFromProduct(detail);
  });

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateProductDto) =>
      lastValueFrom(this.productService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeForm();
        this.queryClient.invalidateQueries({ queryKey: ['products'] });
        this.showAlert('Thêm sản phẩm thành công.');
      } else {
        this.showAlert(res.message || 'Thêm sản phẩm thất bại.', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi thêm sản phẩm.', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateProductDto) =>
      lastValueFrom(this.productService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeForm();
        this.queryClient.invalidateQueries({ queryKey: ['products'] });
        this.showAlert('Cập nhật sản phẩm thành công.');
      } else {
        this.showAlert(res.message || 'Cập nhật sản phẩm thất bại.', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi cập nhật sản phẩm.', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.productService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['products'] });
        this.showAlert('Đã xóa sản phẩm thành công.');
      } else {
        this.showAlert(res.message || 'Xóa sản phẩm thất bại.', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi xóa sản phẩm.', false),
  }));

  rows = computed<ProductAdvancedRow[]>(() => {
    const data = this.getPayload(this.listQuery.data());

    // Logic normalize: backend paged-advanced trả DataTables, vẫn giữ fallback PagingData để UI không vỡ nếu wrapper đổi.
    return data?.data ?? data?.dataSource ?? data?.items ?? [];
  });

  totalRecords = computed<number>(() => {
  const data = this.getPayload(this.listQuery.data());
  return (
    data?.recordsFiltered ??
    data?.recordsTotal ??
    data?.totalFiltered ??
    data?.total ??
    0
  );
});

  totalPages = computed<number>(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize()))
  );

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());
  loadingEditDetail = computed(() => this.editDetailQuery.isFetching());
  deleting = computed(() => this.deleteMutation.isPending());
  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  detail = computed<ProductDetailDto | null>(() => {
    return this.getPayload(this.detailQuery.data()) ?? this.selectedItem();
  });

categoryOptions = computed<ProductCategoryOption[]>(() => {
  const data = this.getPayload(this.categoriesQuery.data());

  if (Array.isArray(data)) return data;

  return data?.data ?? data?.items ?? data?.dataSource ?? [];
});

  activeCount = computed(() => this.rows().filter((row) => row.isActive).length);
  inactiveCount = computed(() => this.rows().filter((row) => !row.isActive).length);
  categoryCount = computed(() => {
    const ids = this.rows()
      .map((row) => row.productCategoryId)
      .filter((id) => !!id);
    return new Set(ids).size;
  });

  private getPayload(response: any): any {
    return response?.resources ?? response?.data ?? null;
  }

  private patchFormFromProduct(product: ProductAdvancedRow): void {
    this.form.set({
      name: product.name || '',
      description: product.description || '',
      productCategoryId: product.productCategoryId || 0,
      isActive: product.isActive,
    });
  }

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }

 applyFilter(): void {
  this.page.set(1);

  // Ép queryKey thay đổi để refetch kể cả khi page đang là 1.
  this.filterVersion.update((value) => value + 1);
}

  clearFilter(): void {
    this.filterName.set('');
    this.filterDescription.set('');
    this.filterCategoryId.set(null);
    this.filterActive.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.applyFilter();
  }

  onSearch(): void {
    this.page.set(1);
  }

  setPage(page: number): void {
    // Logic chặn biên: không cho frontend gọi page ngoài khoảng backend có thể trả.
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
  }

  visiblePages(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const radius = 2;
    const pages: number[] = [];
    for (
      let page = Math.max(1, current - radius);
      page <= Math.min(total, current + radius);
      page++
    ) {
      pages.push(page);
    }
    return pages;
  }

  sort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }

  openView(row: ProductAdvancedRow): void {
    this.selectedItem.set(row);
    this.showDetail.set(true);
  }

  closeDetail(): void {
    this.showDetail.set(false);
    this.selectedItem.set(null);
  }

  openCreate(): void {
    this.editItem.set(null);
    this.form.set({
      name: '',
      description: '',
      productCategoryId: this.categoryOptions()[0]?.id || 0,
      isActive: true,
    });
    this.showForm.set(true);
  }

  openEdit(row: ProductAdvancedRow): void {
    this.editItem.set(row);
    this.patchFormFromProduct(row);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editItem.set(null);
  }

  setField(field: keyof CreateProductDto, value: any): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  save(): void {
    const form = this.form();
    if (!form.name.trim() || !form.productCategoryId) {
      this.showAlert('Vui lòng nhập tên sản phẩm và chọn danh mục.', false);
      return;
    }

    if (form.name.trim().length > 200) {
      this.showAlert('Tên sản phẩm không được vượt quá 200 ký tự.', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} sản phẩm này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      // Logic payload: backend update yêu cầu thêm id, còn create chỉ gửi các field nhập từ form.
      const payload: CreateProductDto = {
        name: form.name.trim(),
        description: form.description?.trim() || '',
        productCategoryId: Number(form.productCategoryId),
        isActive: form.isActive,
      };

      if (this.isEdit()) {
        this.updateMutation.mutate({
          ...payload,
          id: this.editItem()!.id,
        });
      } else {
        this.createMutation.mutate(payload);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa sản phẩm?',
      text: `Bạn có chắc muốn xóa "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#ef4444',
    }).then((result) => {
      if (result.isConfirmed) this.deleteMutation.mutate(id);
    });
  }

  sortIcon(field: string): string {
    if (this.sortField() !== field) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  statusLabel(isActive: boolean): string {
    return isActive ? 'Đang bán' : 'Ngừng bán';
  }

  private showAlert(message: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Thất bại',
      text: message,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#15803d',
    });
  }
}
