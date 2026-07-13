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
  ProductAttributeRow,
  ProductAttributeDetailDto,
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
} from '../../models';
import { ProductAttributeService } from '../../services/product-attribute.service';

import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-product-attribute',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './product-attribute.component.html',
  styleUrl: './product-attribute.component.css',
})
export class ProductAttributeComponent {
  private attributeService = inject(ProductAttributeService);
  private queryClient = injectQueryClient();

  // 1. State bảng
  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  // Bộ lọc nâng cao
  showFilter = signal(false);
  filterName = signal<string | null>(null);
  filterDescription = signal<string | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  // 2. State modal
  showModal = signal(false);
  editItem = signal<ProductAttributeRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({ name: '', description: '' });

  private readonly colMap: Record<string, number> = {
    id: 0,
    name: 1,
    description: 2,
    createdDate: 3,
  };

  // 3. Queries
  listQuery = injectQuery(() => ({
    queryKey: [
      'product-attributes',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterName(),
      this.filterDescription(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () => {
      const body = this.attributeService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterName: this.filterName(),
        filterDescription: this.filterDescription(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      return lastValueFrom(this.attributeService.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['product-attribute-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.attributeService.getById(this.editItem()!.id)),
  }));

  // 4. Computed
  rows = computed<ProductAttributeRow[]>(() => {
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

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: ProductAttributeDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      name: detail.name || '',
      description: detail.description || '',
    });
  });

  // 5. Mutations
  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateProductAttributeDto) =>
      lastValueFrom(this.attributeService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({
          queryKey: ['product-attributes'],
        });
        this.showAlert('Thêm thuộc tính sản phẩm thành công!');
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
    mutationFn: (payload: UpdateProductAttributeDto) =>
      lastValueFrom(this.attributeService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({
          queryKey: ['product-attributes'],
        });
        this.showAlert('Cập nhật thuộc tính sản phẩm thành công!');
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
    mutationFn: (id: number) => lastValueFrom(this.attributeService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({
          queryKey: ['product-attributes'],
        });
        this.showAlert('Đã xóa thuộc tính sản phẩm!');
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

  activeFilterCount = computed(
    () =>
      (this.filterName() ? 1 : 0) +
      (this.filterDescription() ? 1 : 0) +
      (this.dateFrom() ? 1 : 0) +
      (this.dateTo() ? 1 : 0)
  );

  // 6. Table helpers
  onSearch(): void {
    this.page.set(1);
  }

  toggleFilter(): void {
    this.showFilter.update((v) => !v);
  }
  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterName.set(null);
    this.filterDescription.set(null);
    this.dateFrom.set(null);
    this.dateTo.set(null);
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
    this.form.set({ name: '', description: '' });
    this.showModal.set(true);
  }

  openEdit(row: ProductAttributeRow): void {
    this.editItem.set(row);
    this.form.set({ name: row.name || '', description: row.description || '' });
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
      this.showAlert('Vui lòng nhập Tên thuộc tính', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';

    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} thuộc tính sản phẩm này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const base: CreateProductAttributeDto = {
        name: f.name.trim(),
        description: f.description?.trim() || null,
      };

      if (this.isEdit()) {
        const payload: UpdateProductAttributeDto = {
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
      title: 'Xóa thuộc tính sản phẩm?',
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
