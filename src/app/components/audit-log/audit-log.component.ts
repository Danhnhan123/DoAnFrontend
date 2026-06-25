import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { AuditLogRow, AuditLogDetailDto } from '../../models';
import { AuditLogService } from '../../services/audit-log.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AuditLogComponent {
  private auditLogService = inject(AuditLogService);
  private authService = inject(AuthService);

  page = signal(1);
  pageSize = signal(20);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');
  selectedId = signal<number | null>(null);

  private readonly colMap: Record<string, number> = {
    id: 0,
    action: 1,
    targetType: 2,
    targetId: 3,
    description: 4,
    ipAddress: 5,
    createdUserName: 6,
    createdDate: 7,
  };

  private roleIds(): number[] {
    return this.authService.currentUser()?.roles?.map((r) => r.id) ?? [];
  }

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
        this.auditLogService.getPagedAdvanced(
          this.auditLogService.buildPagedBody({
            page: this.page(),
            pageSize: this.pageSize(),
            search: this.search(),
            sortField: this.sortField(),
            sortDir: this.sortDir(),
            colMap: this.colMap,
            userId: this.authService.currentUser()?.id ?? 0,
            roleIds: this.roleIds(),
          })
        )
      ),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['audit-log-detail', this.selectedId()],
    enabled: !!this.selectedId(),
    queryFn: () =>
      lastValueFrom(this.auditLogService.getById(this.selectedId()!)),
  }));

  logs = computed<AuditLogRow[]>(() => {
    const r = this.dtResult();
    return r?.data ?? [];
  });
  totalRecords = computed<number>(() => {
    const r = this.dtResult();
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });
  totalPages = computed<number>(() =>
    Math.ceil(this.totalRecords() / this.pageSize())
  );
  loading = computed(() => this.query.isPending());

  selectedLog = computed<AuditLogDetailDto | null>(() => {
    const d = this.detailQuery.data() as any;
    return d?.resources ?? d?.data ?? null;
  });
  loadingDetail = computed(() => this.detailQuery.isFetching());

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
  viewDetail(log: AuditLogRow): void {
    this.selectedId.set(log.id);
  }
  closeDetail(): void {
    this.selectedId.set(null);
  }

  formatJson(val?: string | null): string {
    return this.auditLogService.formatJson(val);
  }
  actionClass(action: string): string {
    return this.auditLogService.getActionClass(action);
  }
}
