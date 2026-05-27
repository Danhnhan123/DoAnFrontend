import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';
import {
  UserAdvancedRow,
  UserDetailDto,
  CreateUserDto,
  UpdateUserDto,
  UserStatusDetailDto,
  DataItem,
} from '../../models';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css',
})
export class UserComponent {
  private userService = inject(UserService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(10);
  search = signal('');
  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterUsername = signal('');
  filterFullname = signal('');
  filterEmail = signal('');
  filterPhone = signal('');
  filterStatusIds = signal<number[]>([]);
  filterRoleIds = signal<number[]>([]);
  filterDateFrom = signal('');
  filterDateTo = signal('');

  showModal = signal(false);
  editItem = signal<UserAdvancedRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    email: '',
    passwordHash: 'Abc@123456',
    phoneNumber: '',
    gender: 1,
    firstName: '',
    lastName: '',
    userStatusId: 0,
    lockEnabled: false,
    lockEndDate: '',
    roles: [],
  });
  previousStatusId: number | null = null;

  private readonly colMap: Record<string, number> = {
    firstName: 1,
    email: 2,
    phoneNumber: 3,
    userStatusName: 4,
    createdDate: 5,
  };

  // ── Queries ──────────────────────────────────────────────────────────────

  listQuery = injectQuery(() => ({
    queryKey: [
      'users',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterUsername(),
      this.filterFullname(),
      this.filterEmail(),
      this.filterPhone(),
      this.filterStatusIds(),
      this.filterRoleIds(),
      this.filterDateFrom(),
      this.filterDateTo(),
    ],
    queryFn: () => {
      const body = this.userService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterUsername: this.filterUsername(),
        filterFullname: this.filterFullname(),
        filterEmail: this.filterEmail(),
        filterPhone: this.filterPhone(),
        filterStatusIds: this.filterStatusIds(),
        filterRoleIds: this.filterRoleIds(),
        filterDateFrom: this.filterDateFrom(),
        filterDateTo: this.filterDateTo(),
      });
      return lastValueFrom(this.userService.getPagedAdvanced(body));
    },
  }));

  statusesQuery = injectQuery(() => ({
    queryKey: ['user-status-options'],
    queryFn: () => lastValueFrom(this.userService.getUserStatuses()),
  }));

  rolesQuery = injectQuery(() => ({
    queryKey: ['role-options'],
    queryFn: () => lastValueFrom(this.userService.getRoles()),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['user-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.userService.getById(this.editItem()!.id)),
  }));

  rows = computed<UserAdvancedRow[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });
  totalRecords = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });
  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  statusOptions = computed<UserStatusDetailDto[]>(
    () => (this.statusesQuery.data() as any)?.resources ?? []
  );
  roleOptions = computed<DataItem[]>(
    () => (this.rolesQuery.data() as any)?.resources ?? []
  );

  activeCount = computed<number>(() =>
    this.rows().filter(r =>
      (r.userStatusName || '').toLowerCase().includes('hoạt động') ||
      (r.userStatusName || '').toLowerCase().includes('active')
    ).length
  );
  managerCount = computed<number>(() =>
    this.rows().filter(r =>
      (r.roles || []).some((role: any) =>
        (role.name || '').toLowerCase().includes('quản lý') ||
        (role.name || '').toLowerCase().includes('manager')
      )
    ).length
  );
  staffCount = computed<number>(() =>
    this.rows().filter(r =>
      (r.roles || []).some((role: any) =>
        (role.name || '').toLowerCase().includes('nhân viên') ||
        (role.name || '').toLowerCase().includes('staff')
      )
    ).length
  );

  private _prevDetailData: any = null;
  get _detailSynced(): boolean {
    const d = this.detailQuery.data();
    if (d && d !== this._prevDetailData) {
      this._prevDetailData = d;
      const detail: UserDetailDto = (d as any)?.resources ?? (d as any)?.data;
      if (detail) {
        this.form.set({
          email: detail.email,
          passwordHash: '',
          phoneNumber: detail.phoneNumber || '',
          gender: detail.gender ?? 1,
          firstName: detail.firstName,
          lastName: detail.lastName,
          userStatusId: detail.userStatus?.id || 0,
          lockEnabled: detail.lockEnabled || false,
          lockEndDate: detail.lockEndDate ? this.formatDateTimeLocal(detail.lockEndDate) : '',
          roles: detail.roles?.map((r: any) => r.id) || [],
        });
      }
    }
    return true;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateUserDto) =>
      lastValueFrom(this.userService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['users'] });
        this.showAlert('Thêm thành công!');
      } else this.showAlert(res.message || 'Lỗi', false);
    },
    onError: (err: any) => this.showAlert(err?.errors?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateUserDto) =>
      lastValueFrom(this.userService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['users'] });
        this.showAlert('Cập nhật thành công!');
      } else this.showAlert(res.message || 'Lỗi', false);
    },
    onError: (err: any) => this.showAlert(err?.errors?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.userService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['users'] });
        this.showAlert('Đã xóa thành công!');
      } else this.showAlert(res.message, false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi xóa', false),
  }));

  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  // ── UI Helpers ────────────────────────────────────────────────────────────

  toggleFilter(): void { this.showFilter.set(!this.showFilter()); }
  applyFilter(): void { this.page.set(1); }
  clearFilter(): void {
    this.filterUsername.set('');
    this.filterFullname.set('');
    this.filterEmail.set('');
    this.filterPhone.set('');
    this.filterStatusIds.set([]);
    this.filterRoleIds.set([]);
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.applyFilter();
  }

  sort(field: string): void {
    if (this.sortField() === field)
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { this.sortField.set(field); this.sortDir.set('asc'); }
    this.page.set(1);
  }
  onSearch(): void { this.page.set(1); }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }
  visiblePages(): number[] {
    const total = this.totalPages(), cur = this.page(), d = 2, pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) pages.push(i);
    return pages;
  }

  openView(row: UserAdvancedRow): void {
    this.openEdit(row);
  }

  openCreate(): void {
    this.previousStatusId = null;
    this._prevDetailData = null;
    this.editItem.set(null);
    this.form.set({
      email: '',
      passwordHash: 'Abc@123456',
      phoneNumber: '',
      gender: 1,
      firstName: '',
      lastName: '',
      userStatusId: this.statusOptions()[0]?.id || 0,
      lockEnabled: false,
      lockEndDate: '',
      roles: [],
    });
    this.showModal.set(true);
  }

  private formatDateTimeLocal(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  openEdit(row: UserAdvancedRow): void {
    this.previousStatusId = null;
    this._prevDetailData = null;
    this.editItem.set(row);
    this.form.set({
      email: row.email,
      passwordHash: '',
      phoneNumber: '',
      gender: 1,
      firstName: row.firstName,
      lastName: row.lastName,
      userStatusId: row.userStatusId,
      lockEnabled: row.lockEnabled,
      lockEndDate: row.lockEndDate ? this.formatDateTimeLocal(row.lockEndDate) : '',
      roles: row.roles?.map((r) => r.id) || [],
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }
  setField(f: string, v: any): void {
    this.form.update((x) => ({ ...x, [f]: v }));
  }

  toggleLock(checked: boolean): void {
    const lockedStatus = this.statusOptions().find(
      (s) => s.name.toLowerCase().includes('khóa') || s.name.toLowerCase().includes('lock')
    );
    const activeStatus = this.statusOptions().find(
      (s) => s.name.toLowerCase().includes('hoạt động') || s.name.toLowerCase().includes('active')
    );
    if (checked) {
      this.previousStatusId = this.form().userStatusId;
      this.form.update((f) => ({
        ...f,
        lockEnabled: true,
        userStatusId: lockedStatus ? lockedStatus.id : f.userStatusId,
      }));
    } else {
      const restoreId =
        this.previousStatusId || (activeStatus ? activeStatus.id : this.statusOptions()[0]?.id);
      this.form.update((f) => ({ ...f, lockEnabled: false, lockEndDate: '', userStatusId: restoreId }));
    }
  }

  toggleRole(id: number, checked: boolean): void {
    this.form.update((x) => ({
      ...x,
      roles: checked ? [...x.roles, id] : x.roles.filter((r: number) => r !== id),
    }));
  }
  isRoleSelected(id: number): boolean {
    return this.form().roles.includes(id);
  }

  save(): void {
    const f = this.form();
    if (!f.email || !f.firstName || !f.lastName) {
      this.showAlert('Vui lòng điền các trường bắt buộc', false);
      return;
    }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} người dùng này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#4f46e5',
    }).then((result) => {
      if (!result.isConfirmed) return;
      if (this.isEdit()) {
        const payload: UpdateUserDto = {
          id: this.editItem()!.id,
          userStatusId: f.userStatusId,
          roles: f.roles,
          lockEnabled: f.lockEnabled,
          lockEndDate: f.lockEnabled ? f.lockEndDate : null,
        };
        this.updateMutation.mutate(payload);
      } else {
        const payload: CreateUserDto = {
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.email,
          gender: f.gender,
          phoneNumber: f.phoneNumber,
          passwordHash: f.password,
          roles: f.roles,
        };
        this.createMutation.mutate(payload);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa người dùng?',
      text: `Bạn có chắc muốn xóa "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) this.deleteMutation.mutate(id);
    });
  }

  getInitial(f: string, l: string): string {
    return ((f?.[0] || '') + (l?.[0] || '')).toUpperCase() || 'U';
  }
  sortIcon(field: string): string {
    if (this.sortField() !== field) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }
  private showAlert(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#4f46e5',
    });
  }
}