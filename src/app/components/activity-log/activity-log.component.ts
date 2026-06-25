import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { ActivityLogRow } from '../../models';
import { ActivityLogService } from '../../services/activity-log.service';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activity-log.component.html',
  styleUrl: './activity-log.component.css',
})
export class ActivityLogComponent {
  private activityLogService = inject(ActivityLogService);

  page = signal(1);
  pageSize = signal(20);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  private readonly colMap: Record<string, number> = {
    id: 0,
    action: 1,
    description: 2,
    ipAddress: 3,
    userAgent: 4,
    createdUserName: 5,
    createdDate: 6,
  };

  query = injectQuery(() => ({
    queryKey: [
      'activity-log',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.activityLogService.getPagedAdvanced(
          this.activityLogService.buildPagedBody({
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

  private dtResult(): any {
    const res = this.query.data() as any;
    return res?.resources ?? res?.data;
  }

  logs = computed<ActivityLogRow[]>(() => this.dtResult()?.data ?? []);
  totalRecords = computed<number>(() => {
    const r = this.dtResult();
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });
  totalPages = computed<number>(() =>
    Math.ceil(this.totalRecords() / this.pageSize())
  );
  loading = computed(() => this.query.isPending());

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
  getInitial(name?: string | null): string {
    return (name || 'U')[0].toUpperCase();
  }
}
