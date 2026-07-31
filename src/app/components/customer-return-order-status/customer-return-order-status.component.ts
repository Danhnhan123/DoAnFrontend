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
  CustomerReturnOrderStatusAdvancedRow,
  CustomerReturnOrderStatusDetailDto,
  CreateCustomerReturnOrderStatusDto,
  UpdateCustomerReturnOrderStatusDto,
} from '../../models';
import { CustomerReturnOrderStatusService } from '../../services/customer-return-order-status.service';

import { FilterSelectComponent } from '../shared/filter-select.component';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { PermissionService } from '../../services/permission.service';
import { ReadonlyIfDirective } from '../../directives/readonly-if.directive';

@Component({
  selector: 'app-customer-return-order-status',
  standalone: true,
  imports: [ReadonlyIfDirective, HasPermissionDirective, CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './customer-return-order-status.component.html',
  styleUrl: './customer-return-order-status.component.css',
})
export class CustomerReturnOrderStatusComponent {
  perm = inject(PermissionService);
  viewOnly = computed(() => this.isEdit() && !this.perm.canUpdate('CUSTOMER_RETURN_ORDER_STATUS'));
  private svc = inject(CustomerReturnOrderStatusService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterName = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');

  showModal = signal(false);
  editItem = signal<CustomerReturnOrderStatusAdvancedRow | null>(null);
  isEdit = computed(() => !!this.editItem());
  form = signal<any>({ code: '', name: '', color: '#16a34a' });

  private readonly colMap: Record<string, number> = { code: 1, name: 2, color: 3, createdDate: 4 };

  listQuery = injectQuery(() => ({
    queryKey: [
      'customer-return-order-status',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterName(),
      this.filterDateFrom(),
      this.filterDateTo(),
    ],
    queryFn: () => {
      const body = this.svc.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterName: this.filterName(),
        filterDateFrom: this.filterDateFrom(),
        filterDateTo: this.filterDateTo(),
      });
      return lastValueFrom(this.svc.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['customer-return-order-status-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () => lastValueFrom(this.svc.getById(this.editItem()!.id)),
  }));

  rows = computed<CustomerReturnOrderStatusAdvancedRow[]>(() => {
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
      const detail: CustomerReturnOrderStatusDetailDto = (d as any)?.resources ?? (d as any)?.data;
      if (detail) this.form.set({ code: detail.code || '', name: detail.name, color: detail.color });
    }
    return true;
  }

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateCustomerReturnOrderStatusDto) => lastValueFrom(this.svc.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['customer-return-order-status'] });
        this.showAlert('Thêm mới thành công!');
      } else this.showAlert(res.message || 'Thêm thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.errors?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateCustomerReturnOrderStatusDto) => lastValueFrom(this.svc.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['customer-return-order-status'] });
        this.showAlert('Cập nhật thành công!');
      } else this.showAlert(res.message || 'Cập nhật thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.errors?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.svc.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['customer-return-order-status'] });
        this.showAlert('Đã xóa thành công!');
      } else this.showAlert(res.message || 'Xóa thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.errors?.message || 'Lỗi xóa hệ thống', false),
  }));

  saving = computed(() => this.createMutation.isPending() || this.updateMutation.isPending());

  toggleFilter(): void { this.showFilter.set(!this.showFilter()); }
  applyFilter(): void { this.page.set(1); }
  clearFilter(): void {
    this.filterName.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.applyFilter();
  }
  sort(f: string): void {
    if (this.sortField() === f) this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { this.sortField.set(f); this.sortDir.set('asc'); }
    this.page.set(1);
  }
  onSearch(): void { this.page.set(1); }
  setPage(p: number): void { if (p < 1 || p > this.totalPages()) return; this.page.set(p); }
  totalPages(): number { return Math.ceil(this.totalRecords() / this.pageSize()); }
  visiblePages(): number[] {
    const total = this.totalPages(), cur = this.page(), d = 2, pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) pages.push(i);
    return pages;
  }

  openCreate(): void {
    this.editItem.set(null);
    this._prevDetailData = null;
    this.form.set({ code: '', name: '', color: '#16a34a' });
    this.showModal.set(true);
  }
  openEdit(row: CustomerReturnOrderStatusAdvancedRow): void {
    this._prevDetailData = null;
    this.editItem.set(row);
    this.form.set({ code: row.code || '', name: row.name, color: row.color });
    this.showModal.set(true);
  }
  closeModal(): void { this.showModal.set(false); this.editItem.set(null); }
  setField(k: string, v: any): void { this.form.update((x) => ({ ...x, [k]: v })); }

  save(): void {
    const f = this.form();
    if (!f.name) { this.showAlert('Vui lòng điền đầy đủ tên trạng thái đơn hoàn khách (*)', false); return; }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} trạng thái đơn hoàn khách này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      if (this.isEdit()) {
        this.updateMutation.mutate({
          id: this.editItem()!.id,
          code: f.code,
          name: f.name,
          color: f.color,
        } as UpdateCustomerReturnOrderStatusDto);
      } else {
        this.createMutation.mutate({
          code: f.code,
          name: f.name,
          color: f.color,
        } as CreateCustomerReturnOrderStatusDto);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Bạn có chắc chắn?',
      text: `Bạn chuẩn bị xóa trạng thái đơn hoàn khách "${name}". Thao tác này không thể hoàn tác!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Có, Xóa!',
      cancelButtonText: 'Hủy',
    }).then((result) => { if (result.isConfirmed) this.deleteMutation.mutate(id); });
  }

  sortIcon(f: string): string {
    if (this.sortField() !== f) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }
  private showAlert(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công!' : 'Thất bại!',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonColor: '#15803d',
      confirmButtonText: 'Đóng',
    });
  }
}
