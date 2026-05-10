import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityLogDetailDto } from '../../models';
import { ActivityLogService } from '../../services/activity-log.service';

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activity-log.component.html',
  styleUrl: './activity-log.component.css',
})
export class ActivityLogComponent implements OnInit {
  private activityLogService = inject(ActivityLogService);

  logs = signal<ActivityLogDetailDto[]>([]);
  loading = signal(true);
  totalRecords = signal(0);
  page = signal(1);
  pageSize = signal(20);
  search = signal('');
  totalPages = signal(0);
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.activityLogService
      .getPaged({
        pageIndex: this.page(),
        pageSize: this.pageSize(),
        keyword: this.search(),
        sortType: this.sortDir().toUpperCase(),
        orderBy: this.sortField(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          const d = (res as any)?.data;
          if (d?.items) {
            this.logs.set(d.items);
            this.totalRecords.set(d.totalCount || 0);
            this.totalPages.set(d.totalPages || 0);
          } else {
            this.logs.set([]);
            this.totalRecords.set(0);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.page.set(1);
    this.loadData();
  }
  sort(f: string): void {
    if (this.sortField() === f)
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      this.sortField.set(f);
      this.sortDir.set('desc');
    }
    this.page.set(1);
    this.loadData();
  }
  sortIcon(f: string): string {
    if (this.sortField() !== f) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
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
  getInitial(name: string): string {
    return (name || 'U')[0].toUpperCase();
  }
}
