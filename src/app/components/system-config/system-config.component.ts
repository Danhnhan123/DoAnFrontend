import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiResponse, SearchQuery, SystemConfigDetailDto } from '../../models';
import { SystemConfigService } from '../../services/system-config.service';

@Component({
  selector: 'app-system-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-config.component.html',
  styleUrl: './system-config.component.css',
})
export class SystemConfigComponent implements OnInit {
  private systemConfigService = inject(SystemConfigService);

  configs = signal<SystemConfigDetailDto[]>([]);
  loading = signal(true);
  saving = signal(false);
  totalRecords = signal(0);
  page = signal(1);
  pageSize = signal(15);
  search = signal('');
  totalPages = signal(0);

  showModal = signal(false);
  isEdit = signal(false);
  form = signal<any>({ key: '', value: '', description: '' });
  editId = signal<number | null>(null);
  toast = signal<{ msg: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.systemConfigService
      .getPaged({
        pageIndex: this.page(),
        pageSize: this.pageSize(),
        keyword: this.search(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          const d = (res as any)?.data || res;
          if (d?.items) {
            this.configs.set(d.items);
            this.totalRecords.set(d.totalCount || 0);
            this.totalPages.set(d.totalPages || 0);
          } else {
            // Fallback: tải toàn bộ config
            this.systemConfigService.getAll().subscribe({
              next: (r) => {
                this.loading.set(false);
                const list = r?.resources || (r as any)?.data || [];
                this.configs.set(list);
                this.totalRecords.set(list.length);
              },
              error: () => this.loading.set(false),
            });
          }
        },
        error: () => {
          this.systemConfigService.getAll().subscribe({
            next: (r) => {
              this.loading.set(false);
              const list = r?.resources || (r as any)?.data || [];
              this.configs.set(list);
              this.totalRecords.set(list.length);
            },
            error: () => this.loading.set(false),
          });
        },
      });
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
  pages(): number[] {
    const t = this.totalPages(),
      c = this.page(),
      d = 2,
      ps: number[] = [];
    for (let i = Math.max(1, c - d); i <= Math.min(t, c + d); i++) ps.push(i);
    return ps;
  }

  openCreate(): void {
    this.isEdit.set(false);
    this.editId.set(null);
    this.form.set({ key: '', value: '', description: '' });
    this.showModal.set(true);
  }
  openEdit(c: SystemConfigDetailDto): void {
    this.isEdit.set(true);
    this.editId.set(c.id);
    this.form.set({
      key: c.key,
      value: c.value,
      description: c.description || '',
    });
    this.showModal.set(true);
  }
  closeModal(): void {
    this.showModal.set(false);
  }
  setField(f: string, v: any): void {
    this.form.update((x) => ({ ...x, [f]: v }));
  }

  save(): void {
    const f = this.form();
    if (!f.key || !f.value) {
      this.showToast('Key và Value là bắt buộc', false);
      return;
    }
    this.saving.set(true);
    const obs = this.isEdit()
      ? this.systemConfigService.update({ ...f, id: this.editId()! })
      : this.systemConfigService.create(f);
    obs.subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.isSucceeded) {
          this.closeModal();
          this.loadData();
          this.showToast(
            this.isEdit() ? 'Cập nhật thành công!' : 'Thêm thành công!'
          );
        } else this.showToast(r.message || 'Lỗi', false);
      },
      error: (err) => {
        this.saving.set(false);
        this.showToast(err?.error?.message || 'Lỗi', false);
      },
    });
  }

  delete(id: number, key: string): void {
    if (!confirm(`Xóa cấu hình "${key}"?`)) return;
    this.systemConfigService.delete(id).subscribe({
      next: (r) => {
        if (r.isSucceeded) {
          this.loadData();
          this.showToast('Đã xóa!');
        } else this.showToast(r.message || 'Lỗi', false);
      },
    });
  }

  private showToast(msg: string, ok = true): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 3000);
  }
}
