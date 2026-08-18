import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { UserVerificationTokenRow } from '../../models';
import { UserVerificationTokenService } from '../../services/user-verification-token.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

/**
 * Màn quản lý mã xác thực người dùng (admin).
 * Backend chỉ có API READ (paged-advanced) nên màn chỉ hiển thị danh sách
 * (tìm kiếm / sắp xếp / phân trang), không có nút thêm/sửa/xoá.
 */
@Component({
  selector: 'app-user-verification-token',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './user-verification-token.component.html',
  styleUrl: './user-verification-token.component.css',
})
export class UserVerificationTokenComponent {
  private tokenService = inject(UserVerificationTokenService);

  page = signal(1);
  pageSize = signal(20);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  private readonly colMap: Record<string, number> = {
    id: 0,
    code: 1,
    purpose: 2,
    userName: 3,
    expirationDate: 4,
    createdDate: 5,
  };

  query = injectQuery(() => ({
    queryKey: [
      'user-verification-token',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.tokenService.getPagedAdvanced(
          this.tokenService.buildPagedBody({
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

  tokens = computed<UserVerificationTokenRow[]>(() => this.dtResult()?.data ?? []);
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

  purposeLabel(p?: string | null): string {
    return this.tokenService.purposeLabel(p);
  }
  /** Mã còn hiệu lực (chưa dùng và chưa hết hạn). */
  isValid(t: UserVerificationTokenRow): boolean {
    return !t.isUsed && new Date(t.expirationDate) > new Date();
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
