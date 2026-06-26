import { Component, signal, inject, computed } from '@angular/core';
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
  UserStatusAdvancedRow,
  UserStatusDetailDto,
  CreateUserStatusDto,
  UpdateUserStatusDto,
} from '../../models';
import { UserStatusService } from '../../services/user-status.service';

import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-user-status',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './user-status.component.html',
  styleUrl: './user-status.component.css',
})
export class UserStatusComponent {
  private userStatusService = inject(UserStatusService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterName = signal('');
  filterDesc = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');

  showModal = signal(false);
  editItem = signal<UserStatusAdvancedRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  form = signal<any>({ name: '', color: '#000000', description: '' });

  private readonly colMap: Record<string, number> = {
    name: 1,
    color: 2,
    description: 3,
    createdDate: 4,
  };

  // ── Queries ──────────────────────────────────────────────────────────────

  listQuery = injectQuery(() => ({
    queryKey: [
      'user-statuses',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterName(),
      this.filterDesc(),
      this.filterDateFrom(),
      this.filterDateTo(),
    ],
    queryFn: () => {
      const body = this.userStatusService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterName: this.filterName(),
        filterDesc: this.filterDesc(),
        filterDateFrom: this.filterDateFrom(),
        filterDateTo: this.filterDateTo(),
      });
      return lastValueFrom(this.userStatusService.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['user-status-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.userStatusService.getById(this.editItem()!.id)),
  }));

  rows = computed<UserStatusAdvancedRow[]>(() => {
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

  private _prevDetailData: any = null;
  get _detailSynced(): boolean {
    const d = this.detailQuery.data();
    if (d && d !== this._prevDetailData) {
      this._prevDetailData = d;
      const detail: UserStatusDetailDto = (d as any)?.resources ?? (d as any)?.data;
      if (detail)
        this.form.set({ name: detail.name, color: detail.color, description: detail.description || '' });
    }
    return true;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateUserStatusDto) =>
      lastValueFrom(this.userStatusService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
        this.showToast('Thêm mới thành công!');
      } else this.showToast(res.message || 'Thêm thất bại', false);
    },
    onError: (err: any) => this.showToast(err?.errors?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateUserStatusDto) =>
      lastValueFrom(this.userStatusService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
        this.showToast('Cập nhật thành công!');
      } else this.showToast(res.message || 'Cập nhật thất bại', false);
    },
    onError: (err: any) => this.showToast(err?.errors?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.userStatusService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
        this.showToast('Đã xóa thành công!');
      } else this.showToast(res.message || 'Xóa thất bại', false);
    },
    onError: (err: any) => this.showToast(err?.errors?.message || 'Lỗi xóa hệ thống', false),
  }));

  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  // ── UI Helpers ────────────────────────────────────────────────────────────

  toggleFilter(): void { this.showFilter.set(!this.showFilter()); }
  applyFilter(): void { this.page.set(1); }
  clearFilter(): void {
    this.filterName.set('');
    this.filterDesc.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.applyFilter();
  }
  sort(field: string): void {
    if (this.sortField() === field)
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { this.sortField.set(field); this.sortDir.set('asc'); }
    this.page.set(1);
  }
  onSearch(): void { this.page.set(1); }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }
  visiblePages(): number[] {
    const total = this.totalPages(), cur = this.page(), d = 2, pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) pages.push(i);
    return pages;
  }

  openCreate(): void {
    this.editItem.set(null);
    this._prevDetailData = null;
    this.form.set({ name: '', color: '#000000', description: '' });
    this.showModal.set(true);
  }
  openEdit(row: UserStatusAdvancedRow): void {
    this._prevDetailData = null;
    this.editItem.set(row);
    this.form.set({ name: row.name, color: row.color, description: row.description || '' });
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
    if (!f.name) { this.showToast('Vui lòng điền đầy đủ tên trạng thái người dùng (*)', false); return; }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} trạng thái người dùng này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      if (this.isEdit()) {
        this.updateMutation.mutate({
          id: this.editItem()!.id,
          name: f.name,
          color: f.color,
          description: f.description,
        } as UpdateUserStatusDto);
      } else {
        this.createMutation.mutate({
          name: f.name,
          color: f.color,
          description: f.description,
        } as CreateUserStatusDto);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Bạn có chắc chắn?',
      text: `Bạn chuẩn bị xóa trạng thái "${name}". Thao tác này không thể hoàn tác!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Có, Xóa!',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) this.deleteMutation.mutate(id);
    });
  }

  sortIcon(field: string): string {
    if (this.sortField() !== field) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }
  private showToast(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công!' : 'Thất bại!',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Đóng',
      showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' },
      hideClass: { popup: 'animate__animated animate__fadeOutUp animate__faster' },
    });
  }
}
