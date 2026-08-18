import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { UserDeviceRow } from '../../models';
import { UserDeviceService } from '../../services/user-device.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

/**
 * Màn quản lý thiết bị người dùng (admin).
 * Backend chỉ có API READ (paged-advanced) nên màn chỉ hiển thị danh sách
 * (tìm kiếm / sắp xếp / phân trang), không có nút thêm/sửa/xoá.
 */
@Component({
  selector: 'app-user-device',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './user-device.component.html',
  styleUrl: './user-device.component.css',
})
export class UserDeviceComponent {
  private userDeviceService = inject(UserDeviceService);

  page = signal(1);
  pageSize = signal(20);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  private readonly colMap: Record<string, number> = {
    id: 0,
    deviceName: 1,
    platform: 2,
    osVersion: 3,
    appVersion: 4,
    userAgent: 5,
    userName: 6,
    createdDate: 7,
  };

  query = injectQuery(() => ({
    queryKey: [
      'user-device',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.userDeviceService.getPagedAdvanced(
          this.userDeviceService.buildPagedBody({
            page: this.page(),
            pageSize: this.pageSize(),
            search: this.search(),
            sortField: this.sortField(),
            sortDir: this.sortDir(),
            colMap: this.colMap,
          })
        )
      ),
  }));

  devices = computed<UserDeviceRow[]>(() => this.dtResult()?.data ?? []);
  totalRecords = computed<number>(() => {
    const r = this.dtResult();
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });
  totalPages = computed<number>(() =>
    Math.ceil(this.totalRecords() / this.pageSize())
  );
  loading = computed(() => this.query.isPending());

  private dtResult(): any {
    const res = this.query.data() as any;
    return res?.resources ?? res?.data;
  }

  onSearch(): void {
    this.page.set(1);
  }
  sort(f: string): void {
    if (this.sortField() === f)
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      this.sortField.set(f);
      this.sortDir.set('desc');
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
}
