import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  ActionAdvancedRow,
  ActionDetailDto,
  CreateActionDto,
  UpdateActionDto,
} from '../../models';
import { ActionService } from '../../services/action.service';

@Component({
  selector: 'app-action',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './action.component.html',
  styleUrl: './action.component.css',
})
export class ActionComponent implements OnInit {
  private actionService = inject(ActionService);

  rows = signal<ActionAdvancedRow[]>([]);
  loading = signal(true);
  totalRecords = signal(0);
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
  saving = signal(false);
  loadingDetail = signal(false);
  editItem = signal<ActionAdvancedRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({ name: '', description: '' });

  private readonly colMap: Record<string, number> = {
    name: 1,
    description: 2,
    createdDate: 3,
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
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
    this.actionService.getPagedAdvanced(body).subscribe({
      next: (res) => {
        this.loading.set(false);
        const r = res?.resources ?? (res as any)?.data;
        if (r?.data) {
          this.rows.set(r.data);
          this.totalRecords.set(r.recordsFiltered ?? r.recordsTotal ?? 0);
        } else {
          this.rows.set([]);
          this.totalRecords.set(0);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }
  applyFilter(): void {
    this.page.set(1);
    this.loadData();
  }
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
    else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
    this.loadData();
  }
  onSearch(): void {
    this.page.set(1);
    this.loadData();
  }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadData();
  }
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }
  visiblePages(): number[] {
    const total = this.totalPages(),
      cur = this.page(),
      d = 2,
      pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++)
      pages.push(i);
    return pages;
  }

  openCreate(): void {
    this.editItem.set(null);
    this.form.set({ name: '', description: '' });
    this.showModal.set(true);
  }

  openEdit(row: ActionAdvancedRow): void {
    this.editItem.set(row);
    this.loadingDetail.set(true);
    this.showModal.set(true);
    this.actionService.getById(row.id).subscribe({
      next: (res) => {
        this.loadingDetail.set(false);
        const d: ActionDetailDto = res?.resources ?? (res as any)?.data;
        if (d)
          this.form.set({ name: d.name, description: d.description || '' });
      },
      error: () => {
        this.loadingDetail.set(false);
        this.form.update((f) => ({
          ...f,
          name: row.name,
          description: row.description,
        }));
      },
    });
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
    if (!f.name) {
      this.showToast('Vui lòng điền đầy đủ tên hành động (*)', false);
      return;
    }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} hành động này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.saving.set(true);
      if (this.isEdit()) {
        const payload: UpdateActionDto = {
          id: this.editItem()!.id,
          name: f.name,
          description: f.description,
        };
        this.actionService.update(payload).subscribe({
          next: (res) => {
            this.saving.set(false);
            if (res.isSucceeded) {
              this.closeModal();
              this.loadData();
              this.showToast('Cập nhật thành công!');
            } else this.showToast(res.message || 'Cập nhật thất bại', false);
          },
          error: (err) => {
            this.saving.set(false);
            this.showToast(err?.error?.message || 'Lỗi hệ thống', false);
          },
        });
      } else {
        const payload: CreateActionDto = {
          name: f.name,
          description: f.description,
        };
        this.actionService.create(payload).subscribe({
          next: (res) => {
            this.saving.set(false);
            if (res.isSucceeded) {
              this.closeModal();
              this.loadData();
              this.showToast('Thêm mới thành công!');
            } else this.showToast(res.message || 'Thêm thất bại', false);
          },
          error: (err) => {
            this.saving.set(false);
            this.showToast(err?.error?.message || 'Lỗi hệ thống', false);
          },
        });
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
      if (result.isConfirmed) {
        this.actionService.delete(id).subscribe({
          next: (res) => {
            if (res.isSucceeded) {
              this.loadData();
              this.showToast('Đã xóa thành công!');
            } else this.showToast(res.message || 'Xóa thất bại', false);
          },
          error: (err) =>
            this.showToast(err?.error?.message || 'Lỗi xóa hệ thống', false),
        });
      }
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
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster',
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster',
      },
    });
  }
}
