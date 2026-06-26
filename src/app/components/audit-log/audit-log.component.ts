import { Component, signal, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { AuditLogRow, AuditLogDetailDto, DataItem } from '../../models';
import { AuditLogService } from '../../services/audit-log.service';
import { AuthService } from '../../services/auth.service';

import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
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

  // Bộ lọc nâng cao
  showFilter = signal(false);
  filterActions = signal<string[]>([]);
  filterTargetTypes = signal<string[]>([]);
  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);

  // Trạng thái mở của 2 dropdown chọn nhiều
  actionDropdownOpen = signal(false);
  entityDropdownOpen = signal(false);

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

  query = injectQuery(() => ({
    queryKey: [
      'audit-log',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterActions(),
      this.filterTargetTypes(),
      this.dateFrom(),
      this.dateTo(),
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
            filterActions: this.filterActions(),
            filterTargetTypes: this.filterTargetTypes(),
            dateFrom: this.dateFrom(),
            dateTo: this.dateTo(),
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

  actionsQuery = injectQuery(() => ({
    queryKey: ['audit-log-actions'],
    queryFn: () => lastValueFrom(this.auditLogService.getActions()),
    staleTime: 5 * 60_000,
  }));

  entitiesQuery = injectQuery(() => ({
    queryKey: ['audit-log-entities'],
    queryFn: () => lastValueFrom(this.auditLogService.getAuditEntities()),
    staleTime: 5 * 60_000,
  }));

  logs = computed<AuditLogRow[]>(() => this.dtResult()?.data ?? []);
  totalRecords = computed<number>(() => {
    const r = this.dtResult();
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });
  totalPages = computed<number>(() =>
    Math.ceil(this.totalRecords() / this.pageSize())
  );
  loading = computed(() => this.query.isPending());

  actionOptions = computed<DataItem<string>[]>(() => {
    const r = this.actionsQuery.data() as any;
    return r?.resources ?? r?.data ?? [];
  });
  entityOptions = computed<DataItem<string>[]>(() => {
    const r = this.entitiesQuery.data() as any;
    return r?.resources ?? r?.data ?? [];
  });
  activeFilterCount = computed(
    () =>
      this.filterActions().length +
      this.filterTargetTypes().length +
      (this.dateFrom() ? 1 : 0) +
      (this.dateTo() ? 1 : 0)
  );

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

  // ── Filter helpers ─────────────────────────────────────────────
  toggleFilter(): void {
    this.showFilter.update((v) => !v);
  }

  // Đóng dropdown khi click ra ngoài.
  @HostListener('document:click')
  onDocClick(): void {
    this.actionDropdownOpen.set(false);
    this.entityDropdownOpen.set(false);
  }

  toggleActionDropdown(event: Event): void {
    event.stopPropagation();
    this.entityDropdownOpen.set(false);
    this.actionDropdownOpen.update((v) => !v);
  }
  toggleEntityDropdown(event: Event): void {
    event.stopPropagation();
    this.actionDropdownOpen.set(false);
    this.entityDropdownOpen.update((v) => !v);
  }

  isActionChecked(id: string): boolean {
    return this.filterActions().includes(id);
  }
  toggleAction(id: string, checked: boolean): void {
    this.filterActions.update((arr) =>
      checked ? [...arr, id] : arr.filter((x) => x !== id)
    );
    this.page.set(1);
  }
  actionsLabel(): string {
    const n = this.filterActions().length;
    return n === 0 ? 'Tất cả hành động' : `Đã chọn ${n} hành động`;
  }

  isEntityChecked(id: string): boolean {
    return this.filterTargetTypes().includes(id);
  }
  toggleEntity(id: string, checked: boolean): void {
    this.filterTargetTypes.update((arr) =>
      checked ? [...arr, id] : arr.filter((x) => x !== id)
    );
    this.page.set(1);
  }
  entitiesLabel(): string {
    const n = this.filterTargetTypes().length;
    return n === 0 ? 'Tất cả đối tượng' : `Đã chọn ${n} đối tượng`;
  }

  applyFilter(): void {
    this.page.set(1);
  }
  clearFilter(): void {
    this.filterActions.set([]);
    this.filterTargetTypes.set([]);
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.page.set(1);
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
