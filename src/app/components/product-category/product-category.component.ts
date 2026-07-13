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
  ProductCategoryRow,
  ProductCategoryDetailDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from '../../models';
import { ProductCategoryService } from '../../services/product-category.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-product-category',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './product-category.component.html',
  styleUrl: './product-category.component.css',
})
export class ProductCategoryComponent {
  private categoryService = inject(ProductCategoryService);
  private queryClient = injectQueryClient();

  // 1. State bảng
  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterName = signal<string | null>(null);
  filterParentId = signal<number | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  // 2. State modal
  showModal = signal(false);
  editItem = signal<ProductCategoryRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    name: '',
    description: '',
    parentCategoryId: null,
    sortOrder: 0,
  });

  private readonly colMap: Record<string, number> = {
    id: 0,
    name: 1,
    description: 2,
    parentName: 3,
    productCount: 4,
    sortOrder: 5,
    createdDate: 6,
  };

  // 3. Queries
  listQuery = injectQuery(() => ({
    queryKey: [
      'product-categories',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterName(),
      this.filterParentId(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () => {
      const body = this.categoryService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterName: this.filterName(),
        filterParentId: this.filterParentId(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      return lastValueFrom(this.categoryService.getPagedAdvanced(body));
    },
  }));

  /** Toàn bộ danh mục — phục vụ dropdown chọn danh mục cha và bộ lọc. */
  allQuery = injectQuery(() => ({
    queryKey: ['product-categories-all'],
    queryFn: () => lastValueFrom(this.categoryService.getAll()),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['product-category-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.categoryService.getById(this.editItem()!.id)),
  }));

  // 4. Computed
  rows = computed<ProductCategoryRow[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });

  totalRecords = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  /** Danh sách tất cả danh mục (đã unwrap khỏi ApiResponse). */
  allCategories = computed<ProductCategoryDetailDto[]>(() => {
    const res = this.allQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return Array.isArray(r) ? r : r?.data ?? [];
  });

  /** Options cho ô lọc danh mục cha. */
  parentFilterOptions = computed(() =>
    this.allCategories().map((c) => ({ id: c.id, name: c.name }))
  );

  /**
   * Options chọn danh mục cha trong modal:
   * loại bỏ chính nó và mọi danh mục con cháu (tránh tạo vòng lặp cây).
   */
  parentModalOptions = computed<ProductCategoryDetailDto[]>(() => {
    const editId = this.editItem()?.id;
    if (!editId) return this.allCategories();
    return this.allCategories().filter(
      (c) =>
        c.id !== editId &&
        !(c.treeIds || '').includes(`/${editId}/`)
    );
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  rootCount = computed(
    () => this.rows().filter((x) => !x.parentCategoryId).length
  );
  subCount = computed(
    () => this.rows().filter((x) => !!x.parentCategoryId).length
  );

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: ProductCategoryDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      name: detail.name || '',
      description: detail.description || '',
      parentCategoryId: detail.parentCategoryId ?? null,
      sortOrder: detail.sortOrder ?? 0,
    });
  });

  // 5. Mutations
  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateProductCategoryDto) =>
      lastValueFrom(this.categoryService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['product-categories'] });
        this.queryClient.invalidateQueries({
          queryKey: ['product-categories-all'],
        });
        this.showAlert('Thêm danh mục thành công!');
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
    mutationFn: (payload: UpdateProductCategoryDto) =>
      lastValueFrom(this.categoryService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['product-categories'] });
        this.queryClient.invalidateQueries({
          queryKey: ['product-categories-all'],
        });
        this.showAlert('Cập nhật danh mục thành công!');
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
    mutationFn: (id: number) => lastValueFrom(this.categoryService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['product-categories'] });
        this.queryClient.invalidateQueries({
          queryKey: ['product-categories-all'],
        });
        this.showAlert('Đã xóa danh mục!');
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

  // 6. Table helpers
  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }

  applyFilter(): void {
    this.page.set(1);
  }

  clearFilter(): void {
    this.filterName.set(null);
    this.filterParentId.set(null);
    this.dateFrom.set(null);
    this.dateTo.set(null);
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
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) {
      pages.push(i);
    }
    return pages;
  }

  // 7. Modal helpers
  openCreate(): void {
    this.editItem.set(null);
    this.form.set({
      name: '',
      description: '',
      parentCategoryId: null,
      sortOrder: 0,
    });
    this.showModal.set(true);
  }

  openEdit(row: ProductCategoryRow): void {
    this.editItem.set(row);
    this.form.set({
      name: row.name || '',
      description: row.description || '',
      parentCategoryId: row.parentCategoryId ?? null,
      sortOrder: row.sortOrder ?? 0,
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

  // 8. Save / delete
  save(): void {
    const f = this.form();

    if (!f.name?.trim()) {
      this.showAlert('Vui lòng nhập Tên danh mục', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';

    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} danh mục này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const parentId =
        f.parentCategoryId != null ? Number(f.parentCategoryId) : null;

      const base: CreateProductCategoryDto = {
        name: f.name.trim(),
        description: f.description?.trim() || null,
        parentCategoryId: parentId,
        treeIds: this.categoryService.buildTreeIds(
          parentId,
          this.allCategories()
        ),
        sortOrder: Number(f.sortOrder) || 0,
      };

      if (this.isEdit()) {
        const payload: UpdateProductCategoryDto = {
          ...base,
          id: this.editItem()!.id,
        };
        this.updateMutation.mutate(payload);
      } else {
        this.createMutation.mutate(base);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa danh mục?',
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
