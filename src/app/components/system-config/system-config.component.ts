import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import { SystemConfigDetailDto } from '../../models';
import {
  SystemConfigService,
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
} from '../../services/system-config.service';

@Component({
  selector: 'app-system-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-config.component.html',
  styleUrl: './system-config.component.css',
})
export class SystemConfigComponent {
  private systemConfigService = inject(SystemConfigService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(15);
  search = signal('');

  showModal = signal(false);
  isEdit = signal(false);
  form = signal<any>({ name: '', configKey: '', configValue: '', description: '' });
  editId = signal<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  listQuery = injectQuery(() => ({
    queryKey: ['system-configs', this.page(), this.pageSize(), this.search()],
    queryFn: () =>
      lastValueFrom(
        this.systemConfigService.getPaged({
          pageIndex: this.page(),
          pageSize: this.pageSize(),
          keyword: this.search(),
        })
      ),
  }));

  /** BE trả ApiResponse.resources = PagingData { dataSource, total, totalFiltered, totalPages }. */
  private paging = computed<any>(() => {
    const res = this.listQuery.data() as any;
    return res?.resources ?? res?.data ?? null;
  });
  configs = computed<SystemConfigDetailDto[]>(() => {
    const p = this.paging();
    return p?.dataSource ?? p?.items ?? [];
  });
  totalRecords = computed<number>(() => {
    const p = this.paging();
    return p?.totalFiltered ?? p?.total ?? p?.totalCount ?? 0;
  });
  totalPages = computed<number>(() => {
    const p = this.paging();
    return p?.totalPages ?? 0;
  });
  loading = computed(() => this.listQuery.isPending());

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateSystemConfigDto) =>
      lastValueFrom(this.systemConfigService.create(payload)),
    onSuccess: (r: any) => {
      if (r.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['system-configs'] });
        this.showAlert('Thêm thành công!');
      } else this.showAlert(r.message || 'Lỗi', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateSystemConfigDto) =>
      lastValueFrom(this.systemConfigService.update(payload)),
    onSuccess: (r: any) => {
      if (r.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['system-configs'] });
        this.showAlert('Cập nhật thành công!');
      } else this.showAlert(r.message || 'Lỗi', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.systemConfigService.delete(id)),
    onSuccess: (r: any) => {
      if (r.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['system-configs'] });
        this.showAlert('Đã xóa!');
      } else this.showAlert(r.message || 'Lỗi', false);
    },
  }));

  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  // ── UI Helpers ────────────────────────────────────────────────────────────

  onSearch(): void { this.page.set(1); }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  pages(): number[] {
    const t = this.totalPages(), c = this.page(), d = 2, ps: number[] = [];
    for (let i = Math.max(1, c - d); i <= Math.min(t, c + d); i++) ps.push(i);
    return ps;
  }

  openCreate(): void {
    this.isEdit.set(false);
    this.editId.set(null);
    this.form.set({ name: '', configKey: '', configValue: '', description: '' });
    this.showModal.set(true);
  }
  openEdit(c: SystemConfigDetailDto): void {
    this.isEdit.set(true);
    this.editId.set(c.id);
    this.form.set({
      name: c.name,
      configKey: c.configKey,
      configValue: c.configValue,
      description: c.description || '',
    });
    this.showModal.set(true);
  }
  closeModal(): void { this.showModal.set(false); }
  setField(f: string, v: any): void {
    this.form.update((x) => ({ ...x, [f]: v }));
  }

  save(): void {
    const f = this.form();
    if (!f.name || !f.configKey || !f.configValue) {
      this.showAlert('Tên, Key và Value là bắt buộc', false);
      return;
    }
    const payload: CreateSystemConfigDto = {
      name: f.name.trim(),
      configKey: f.configKey.trim(),
      configValue: f.configValue,
      description: f.description?.trim() || undefined,
    };
    if (this.isEdit()) {
      this.updateMutation.mutate({ ...payload, id: this.editId()! } as UpdateSystemConfigDto);
    } else {
      this.createMutation.mutate(payload);
    }
  }

  delete(id: number, key: string): void {
    Swal.fire({
      title: 'Xóa cấu hình?',
      text: `Bạn có chắc muốn xóa cấu hình "${key}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then(result => {
      if (result.isConfirmed) this.deleteMutation.mutate(id);
    });
  }

  private showAlert(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#15803d',
    });
  }
}
