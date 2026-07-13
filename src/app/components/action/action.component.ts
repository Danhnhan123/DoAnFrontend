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
  ActionAdvancedRow,
  ActionDetailDto,
  CreateActionDto,
  UpdateActionDto,
} from '../../models';
import { ActionService } from '../../services/action.service';

import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-action',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './action.component.html',
  styleUrl: './action.component.css',
})
export class ActionComponent {
  private actionService = inject(ActionService);
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
  editItem = signal<ActionAdvancedRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  form = signal<any>({ name: '', description: '' });

  private readonly colMap: Record<string, number> = {
    name: 1,
    description: 2,
    createdDate: 3,
  };

  // ── Queries ──────────────────────────────────────────────────────────────

  listQuery = injectQuery(() => ({
    queryKey: [
      'actions',
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
      const body = this.actionService.buildPagedBody({
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
      return lastValueFrom(this.actionService.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['action-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.actionService.getById(this.editItem()!.id)),
  }));

  rows = computed<ActionAdvancedRow[]>(() => {
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

  // Sync form when detail loads
  private _prevDetailData: any = null;
  get _detailSynced(): boolean {
    const d = this.detailQuery.data();
    if (d && d !== this._prevDetailData) {
      this._prevDetailData = d;
      const detail: ActionDetailDto = (d as any)?.resources ?? (d as any)?.data;
      if (detail) this.form.set({ name: detail.name, description: detail.description || '' });
    }
    return true;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateActionDto) =>
      lastValueFrom(this.actionService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['actions'] });
        this.showToast('Thêm mới thành công!');
      } else {
        this.showToast(res.message || 'Thêm thất bại', false);
      }
    },
    onError: (err: any) => this.showToast(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateActionDto) =>
      lastValueFrom(this.actionService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['actions'] });
        this.showToast('Cập nhật thành công!');
      } else {
        this.showToast(res.message || 'Cập nhật thất bại', false);
      }
    },
    onError: (err: any) => this.showToast(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.actionService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['actions'] });
        this.showToast('Đã xóa thành công!');
      } else {
        this.showToast(res.message || 'Xóa thất bại', false);
      }
    },
    onError: (err: any) => this.showToast(err?.error?.message || 'Lỗi xóa hệ thống', false),
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
    this.form.set({ name: '', description: '' });
    this.showModal.set(true);
  }
  openEdit(row: ActionAdvancedRow): void {
    this._prevDetailData = null;
    this.editItem.set(row);
    this.form.set({ name: row.name, description: row.description || '' });
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
    if (!f.name) { this.showToast('Vui lòng điền đầy đủ tên hành động (*)', false); return; }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} hành động này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      if (this.isEdit()) {
        this.updateMutation.mutate({ id: this.editItem()!.id, name: f.name, description: f.description });
      } else {
        this.createMutation.mutate({ name: f.name, description: f.description });
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Bạn có chắc chắn?',
      text: `Bạn chuẩn bị xóa hành động "${name}". Thao tác này không thể hoàn tác!`,
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
      confirmButtonColor: '#15803d',
      confirmButtonText: 'Đóng',
      showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' },
      hideClass: { popup: 'animate__animated animate__fadeOutUp animate__faster' },
    });
  }
}
