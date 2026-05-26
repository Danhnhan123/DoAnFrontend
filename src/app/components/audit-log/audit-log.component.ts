import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { AuditLogDetailDto } from '../../models';
import { AuditLogService } from '../../services/audit-log.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AuditLogComponent {
  private auditLogService = inject(AuditLogService);

  page = signal(1);
  pageSize = signal(20);
  search = signal('');
  sortField = signal('changedDate');
  sortDir = signal<'asc' | 'desc'>('desc');
  selectedLog = signal<AuditLogDetailDto | null>(null);

  query = injectQuery(() => ({
    queryKey: [
      'audit-log',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
    ],
    queryFn: () =>
      lastValueFrom(
        this.auditLogService.getPaged({
          pageIndex: this.page(),
          pageSize: this.pageSize(),
          keyword: this.search(),
          sortType: this.sortDir().toUpperCase(),
          orderBy: this.sortField(),
        })
      ),
  }));

  logs = computed<AuditLogDetailDto[]>(() => {
    const d = (this.query.data() as any)?.data;
    return d?.items ?? [];
  });
  totalRecords = computed<number>(() => {
    const d = (this.query.data() as any)?.data;
    return d?.totalCount ?? 0;
  });
  totalPages = computed<number>(() => {
    const d = (this.query.data() as any)?.data;
    return d?.totalPages ?? 0;
  });

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
  viewDetail(log: AuditLogDetailDto): void {
    this.selectedLog.set(log);
  }
  closeDetail(): void {
    this.selectedLog.set(null);
  }

  // Ủy thác các hàm tiện ích sang service
  formatJson(val?: string): string {
    return this.auditLogService.formatJson(val);
  }
  actionClass(action: string): string {
    return this.auditLogService.getActionClass(action);
  }
}
