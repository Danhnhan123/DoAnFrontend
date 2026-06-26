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
  NotificationCategoryRow,
  NotificationCategoryDetailDto,
  CreateNotificationCategoryDto,
  UpdateNotificationCategoryDto,
} from '../../models';
import { NotificationCategoryService } from '../../services/notification-category.service';

import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-notification-category',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './notification-category.component.html',
  styleUrl: './notification-category.component.css',
})
export class NotificationCategoryComponent {
  private service = inject(NotificationCategoryService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterName = signal<string | null>(null);
  filterDescription = signal<string | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  showModal = signal(false);
  editItem = signal<NotificationCategoryRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  form = signal<any>({ name: '', description: '', color: '#6366f1' });

  private readonly colMap: Record<string, number> = {
    id: 0,
    name: 1,
    description: 2,
    color: 3,
    createdDate: 4,
  };

  listQuery = injectQuery(() => ({
    queryKey: [
      'notification-categories',
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
    queryFn: () =>
      lastValueFrom(
        this.service.getPagedAdvanced(
          this.service.buildPagedBody({
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
          })
        )
      ),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['notification-category-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () => lastValueFrom(this.service.getById(this.editItem()!.id)),
  }));

  private dt(): any {
    const r = this.listQuery.data() as any;
    return r?.resources ?? r?.data;
  }
  rows = computed<NotificationCategoryRow[]>(() => this.dt()?.data ?? []);
  totalRecords = computed<number>(
    () => this.dt()?.recordsFiltered ?? this.dt()?.recordsTotal ?? 0
  );
  totalPages = computed(() => Math.ceil(this.totalRecords() / this.pageSize()));
  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());
  activeFilterCount = computed(
    () =>
      (this.filterName() ? 1 : 0) +
      (this.filterDescription() ? 1 : 0) +
      (this.dateFrom() ? 1 : 0) +
      (this.dateTo() ? 1 : 0)
  );

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;
    const detail: NotificationCategoryDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;
    this.form.set({
      name: detail.name || '',
      description: detail.description || '',
      color: detail.color || '#6366f1',
    });
  });

  createMutation = injectMutation(() => ({
    mutationFn: (p: CreateNotificationCategoryDto) =>
      lastValueFrom(this.service.create(p)),
    onSuccess: (res: any) => this.afterSave(res, 'Thêm danh mục thông báo thành công!'),
    onError: (e: any) => this.showAlert(e?.error?.message || 'Lỗi hệ thống', false),
  }));
  updateMutation = injectMutation(() => ({
    mutationFn: (p: UpdateNotificationCategoryDto) =>
      lastValueFrom(this.service.update(p)),
    onSuccess: (res: any) => this.afterSave(res, 'Cập nhật danh mục thông báo thành công!'),
    onError: (e: any) => this.showAlert(e?.error?.message || 'Lỗi hệ thống', false),
  }));
  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['notification-categories'] });
        this.showAlert('Đã xóa danh mục thông báo!');
      } else this.showAlert(res.message || 'Xóa thất bại', false);
    },
    onError: (e: any) => this.showAlert(e?.error?.message || 'Lỗi xóa', false),
  }));
  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  private afterSave(res: any, msg: string): void {
    if (res.isSucceeded) {
      this.closeModal();
      this.queryClient.invalidateQueries({ queryKey: ['notification-categories'] });
      this.queryClient.invalidateQueries({ queryKey: ['notification-category-options'] });
      this.showAlert(msg);
    } else this.showAlert(res.message || 'Thao tác thất bại', false);
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
  onSearch(): void {
    this.page.set(1);
  }
  sort(f: string): void {
    if (this.sortField() === f)
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      this.sortField.set(f);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }
  sortIcon(f: string): string {
    if (this.sortField() !== f) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  pages(): number[] {
    const t = this.totalPages(),
      c = this.page(),
      d = 2,
      ps: number[] = [];
    for (let i = Math.max(1, c - d); i <= Math.min(t, c + d); i++) ps.push(i);
    return ps;
  }

  openCreate(): void {
    this.editItem.set(null);
    this.form.set({ name: '', description: '', color: '#6366f1' });
    this.showModal.set(true);
  }
  openEdit(row: NotificationCategoryRow): void {
    this.editItem.set(row);
    this.form.set({
      name: row.name || '',
      description: row.description || '',
      color: row.color || '#6366f1',
    });
    this.showModal.set(true);
  }
  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }
  setField(f: string, v: any): void {
    this.form.update((x) => ({ ...x, [f]: v }));
  }

  save(): void {
    const f = this.form();
    if (!f.name?.trim()) {
      this.showAlert('Vui lòng nhập tên danh mục', false);
      return;
    }
    if (!f.color?.trim()) {
      this.showAlert('Vui lòng chọn màu', false);
      return;
    }
    const action = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${action}`,
      text: `Bạn có muốn ${action} danh mục thông báo này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#4f46e5',
    }).then((r) => {
      if (!r.isConfirmed) return;
      const base: CreateNotificationCategoryDto = {
        name: f.name.trim(),
        description: f.description?.trim() || null,
        color: f.color.trim(),
      };
      if (this.isEdit())
        this.updateMutation.mutate({ ...base, id: this.editItem()!.id });
      else this.createMutation.mutate(base);
    });
  }
  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa danh mục thông báo?',
      text: `Bạn có chắc muốn xóa "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then((r) => {
      if (r.isConfirmed) this.deleteMutation.mutate(id);
    });
  }

  private showAlert(message: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: message,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#4f46e5',
    });
  }
}
