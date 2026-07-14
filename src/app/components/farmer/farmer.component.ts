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
  FarmerRow,
  FarmerDetailDto,
  CreateFarmerDto,
  UpdateFarmerDto,
} from '../../models';
import { FarmerService } from '../../services/farmer.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-farmer',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './farmer.component.html',
  styleUrl: '../supplier/supplier.component.css',
})
export class FarmerComponent {
  private farmerService = inject(FarmerService);
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
  editItem = signal<FarmerRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    name: '',
    code: '',
    phone: '',
    address: '',
    region: '',
    reputationNote: '',
    isActive: true,
  });

  private readonly colMap: Record<string, number> = {
    id: 0,
    name: 1,
    code: 2,
    phone: 3,
    region: 4,
    isActive: 5,
    createdDate: 6,
  };

  listQuery = injectQuery(() => ({
    queryKey: [
      'farmers',
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
      const body = this.farmerService.buildPagedBody({
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
      return lastValueFrom(this.farmerService.getPagedAdvanced(body));
    },
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['farmer-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.farmerService.getById(this.editItem()!.id)),
  }));

  rows = computed<FarmerRow[]>(() => {
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

    const detail: FarmerDetailDto = (d as any)?.resources ?? (d as any)?.data;
    if (!detail) return;

    this.form.set({
      name: detail.name || '',
      code: detail.code || '',
      phone: detail.phone || '',
      address: detail.address || '',
      region: detail.region || '',
      reputationNote: detail.reputationNote || '',
      isActive: detail.isActive ?? true,
    });
  });

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateFarmerDto) =>
      lastValueFrom(this.farmerService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['farmers'] });
        this.showAlert('Thêm nông dân thành công!');
      } else {
        this.showAlert(res.message || 'Thêm thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateFarmerDto) =>
      lastValueFrom(this.farmerService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['farmers'] });
        this.showAlert('Cập nhật nông dân thành công!');
      } else {
        this.showAlert(res.message || 'Cập nhật thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.farmerService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['farmers'] });
        this.showAlert('Đã xóa nông dân!');
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
      phone: '',
      address: '',
      region: '',
      reputationNote: '',
      isActive: true,
    });
    this.showModal.set(true);
  }

  openEdit(row: FarmerRow): void {
    this.editItem.set(row);
    this.form.set({
      name: row.name || '',
      code: row.code || '',
      phone: row.phone || '',
      address: row.address || '',
      region: row.region || '',
      reputationNote: row.reputationNote || '',
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
      this.showAlert('Vui lòng nhập Tên và Mã nông dân', false);
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} nông dân này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then((result) => {
      if (!result.isConfirmed) return;

      const base: CreateFarmerDto = {
        name: f.name.trim(),
        code: f.code.trim(),
        phone: f.phone?.trim() || null,
        address: f.address?.trim() || null,
        region: f.region?.trim() || null,
        reputationNote: f.reputationNote?.trim() || null,
        isActive: !!f.isActive,
      };

      if (this.isEdit()) {
        const payload: UpdateFarmerDto = { ...base, id: this.editItem()!.id };
        this.updateMutation.mutate(payload);
      } else {
        this.createMutation.mutate(base);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa nông dân?',
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
