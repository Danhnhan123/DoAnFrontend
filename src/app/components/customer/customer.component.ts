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
  CustomerRow,
  CustomerDetailDto,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '../../models';
import { CustomerService } from '../../services/customer.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './customer.component.html',
  styleUrl: '../supplier/supplier.component.css',
})
export class CustomerComponent {
  private customerService = inject(CustomerService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterName = signal<string | null>(null);
  filterCode = signal<string | null>(null);
  filterIsActive = signal<boolean | null>(null);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  readonly statusOptions = [
    { id: true, name: 'Đang hoạt động' },
    { id: false, name: 'Ngừng hoạt động' },
  ];

  showModal = signal(false);
  editItem = signal<CustomerRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    name: '',
    code: '',
    customerType: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    isActive: true,
  });

  private readonly colMap: Record<string, number> = {
    id: 0,
    name: 1,
    code: 2,
    customerType: 3,
    contactPerson: 4,
    phone: 5,
    email: 6,
    taxCode: 7,
    isActive: 8,
    createdDate: 9,
  };

  listQuery = injectQuery(() => ({
    queryKey: [
      'customers',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterName(),
      this.filterCode(),
      this.filterIsActive(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () => {
      const body = this.customerService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterName: this.filterName(),
        filterCode: this.filterCode(),
        filterIsActive: this.filterIsActive(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      return lastValueFrom(this.customerService.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['customer-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.customerService.getById(this.editItem()!.id)),
  }));

  rows = computed<CustomerRow[]>(() => {
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

  activeCount = computed(() => this.rows().filter((x) => x.isActive).length);
  inactiveCount = computed(() => this.rows().filter((x) => !x.isActive).length);

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: CustomerDetailDto = (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      name: detail.name || '',
      code: detail.code || '',
      customerType: detail.customerType || '',
      contactPerson: detail.contactPerson || '',
      phone: detail.phone || '',
      email: detail.email || '',
      address: detail.address || '',
      taxCode: detail.taxCode || '',
      isActive: detail.isActive ?? true,
    });
  });

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateCustomerDto) =>
      lastValueFrom(this.customerService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['customers'] });
        this.showAlert('Thêm khách hàng thành công!');
      } else {
        this.showAlert(res.message || 'Thêm thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateCustomerDto) =>
      lastValueFrom(this.customerService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['customers'] });
        this.showAlert('Cập nhật khách hàng thành công!');
      } else {
        this.showAlert(res.message || 'Cập nhật thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.customerService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['customers'] });
        this.showAlert('Đã xóa khách hàng!');
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

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }
  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterName.set(null);
    this.filterCode.set(null);
    this.filterIsActive.set(null);
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

  openCreate(): void {
    this.editItem.set(null);
    this.form.set({
      name: '',
      code: '',
      customerType: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxCode: '',
      isActive: true,
    });
    this.showModal.set(true);
  }

  openEdit(row: CustomerRow): void {
    this.editItem.set(row);
    this.form.set({
      name: row.name || '',
      code: row.code || '',
      customerType: row.customerType || '',
      contactPerson: row.contactPerson || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      taxCode: row.taxCode || '',
      isActive: row.isActive ?? true,
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

  save(): void {
    const f = this.form();
    if (!f.name?.trim() || !f.code?.trim()) {
      this.showAlert('Vui lòng nhập Tên và Mã khách hàng', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} khách hàng này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const base: CreateCustomerDto = {
        name: f.name.trim(),
        code: f.code.trim(),
        customerType: f.customerType?.trim() || null,
        contactPerson: f.contactPerson?.trim() || null,
        phone: f.phone?.trim() || null,
        email: f.email?.trim() || null,
        address: f.address?.trim() || null,
        taxCode: f.taxCode?.trim() || null,
        isActive: !!f.isActive,
      };

      if (this.isEdit()) {
        const payload: UpdateCustomerDto = { ...base, id: this.editItem()!.id };
        this.updateMutation.mutate(payload);
      } else {
        this.createMutation.mutate(base);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa khách hàng?',
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
