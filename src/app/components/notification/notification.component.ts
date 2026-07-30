import { Component, signal, inject, computed, effect } from '@angular/core';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';
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
  NotificationRow,
  NotificationDetailDto,
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationCategoryDetailDto,
  UserOption,
} from '../../models';
import { NotificationService } from '../../services/notification.service';
import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [ReadonlyIfDirective, HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css',
})
export class NotificationComponent {
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEdit() && !this.perm.canUpdate('NOTIFICATION'));
  private service = inject(NotificationService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterCategoryIds = signal<number[]>([]);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  showModal = signal(false);
  editItem = signal<NotificationRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  form = signal<any>({
    notificationCategoryId: 0,
    title: '',
    content: '',
    directionId: '',
    userIds: [] as number[],
  });

  private readonly colMap: Record<string, number> = {
    id: 0,
    title: 1,
    content: 2,
    direction: 3,
    notificationCategoryName: 4,
    createdDate: 5,
  };

  // ── Queries ──
  listQuery = injectQuery(() => ({
    queryKey: [
      'notifications',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterCategoryIds(),
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
            filterCategoryIds: this.filterCategoryIds(),
            dateFrom: this.dateFrom(),
            dateTo: this.dateTo(),
          })
        )
      ),
  }));

  categoriesQuery = injectQuery(() => ({
    queryKey: ['notification-category-options'],
    queryFn: () => lastValueFrom(this.service.getCategories()),
    staleTime: 5 * 60_000,
  }));

  usersQuery = injectQuery(() => ({
    queryKey: ['notification-user-options'],
    queryFn: () => lastValueFrom(this.service.getUsers()),
    staleTime: 5 * 60_000,
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['notification-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () => lastValueFrom(this.service.getById(this.editItem()!.id)),
  }));

  // ── Computed ──
  private dt(): any {
    const r = this.listQuery.data() as any;
    return r?.resources ?? r?.data;
  }
  rows = computed<NotificationRow[]>(() => this.dt()?.data ?? []);
  totalRecords = computed<number>(
    () => this.dt()?.recordsFiltered ?? this.dt()?.recordsTotal ?? 0
  );
  totalPages = computed(() => Math.ceil(this.totalRecords() / this.pageSize()));
  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  categoryOptions = computed<{ id: number; name: string }[]>(() => {
    const list: NotificationCategoryDetailDto[] =
      (this.categoriesQuery.data() as any)?.resources ?? [];
    return list.map((c) => ({ id: c.id, name: c.name }));
  });
  userOptions = computed<UserOption[]>(
    () => (this.usersQuery.data() as any)?.resources ?? []
  );
  activeFilterCount = computed(
    () =>
      this.filterCategoryIds().length +
      (this.dateFrom() ? 1 : 0) +
      (this.dateTo() ? 1 : 0)
  );

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;
    const detail: NotificationDetailDto =
      (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;
    this.form.set({
      notificationCategoryId: detail.notificationCategoryId || 0,
      title: detail.title || '',
      content: detail.content || '',
      directionId: detail.directionId || '',
      userIds: (detail.notificationUsers ?? []).map((u) => u.id),
    });
  });

  // ── Mutations ──
  createMutation = injectMutation(() => ({
    mutationFn: (p: CreateNotificationDto) => lastValueFrom(this.service.create(p)),
    onSuccess: (res: any) => this.afterSave(res, 'Gửi thông báo thành công!'),
    onError: (e: any) => this.showAlert(e?.error?.message || 'Lỗi hệ thống', false),
  }));
  updateMutation = injectMutation(() => ({
    mutationFn: (p: UpdateNotificationDto) => lastValueFrom(this.service.update(p)),
    onSuccess: (res: any) => this.afterSave(res, 'Cập nhật thông báo thành công!'),
    onError: (e: any) => this.showAlert(e?.error?.message || 'Lỗi hệ thống', false),
  }));
  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.service.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['notifications'] });
        this.showAlert('Đã xóa thông báo!');
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
      this.queryClient.invalidateQueries({ queryKey: ['notifications'] });
      this.showAlert(msg);
    } else this.showAlert(res.message || 'Thao tác thất bại', false);
  }

  // ── Filter / table helpers ──
  toggleFilter(): void {
    this.showFilter.update((v) => !v);
  }
  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterCategoryIds.set([]);
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

  // ── Modal ──
  openCreate(): void {
    this.editItem.set(null);
    this.form.set({
      notificationCategoryId: this.categoryOptions()[0]?.id ?? 0,
      title: '',
      content: '',
      directionId: '',
      userIds: [],
    });
    this.showModal.set(true);
  }
  openEdit(row: NotificationRow): void {
    this.editItem.set(row);
    this.form.set({
      notificationCategoryId: row.notificationCategoryId || 0,
      title: row.title || '',
      content: row.content || '',
      directionId: row.directionId || '',
      userIds: [],
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
    if (!f.notificationCategoryId) {
      this.showAlert('Vui lòng chọn danh mục thông báo', false);
      return;
    }
    if (!f.title?.trim() || !f.content?.trim()) {
      this.showAlert('Vui lòng nhập tiêu đề và nội dung', false);
      return;
    }
    if (!this.isEdit() && (f.userIds?.length ?? 0) === 0) {
      this.showAlert('Vui lòng chọn ít nhất một người nhận', false);
      return;
    }
    const action = this.isEdit() ? 'cập nhật' : 'gửi';
    Swal.fire({
      title: `Xác nhận ${action}`,
      text: `Bạn có muốn ${action} thông báo này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((r) => {
      if (!r.isConfirmed) return;
      const base: CreateNotificationDto = {
        notificationCategoryId: Number(f.notificationCategoryId),
        title: f.title.trim(),
        content: f.content.trim(),
        directionId: f.directionId?.trim() || null,
        userIds: f.userIds ?? [],
      };
      if (this.isEdit())
        this.updateMutation.mutate({ ...base, id: this.editItem()!.id });
      else this.createMutation.mutate(base);
    });
  }
  delete(id: number, title: string): void {
    Swal.fire({
      title: 'Xóa thông báo?',
      text: `Bạn có chắc muốn xóa "${title}"?`,
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
      confirmButtonColor: '#15803d',
    });
  }
}
