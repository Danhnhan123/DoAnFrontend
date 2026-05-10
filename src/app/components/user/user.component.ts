import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  UserAdvancedRow,
  UserDetailDto,
  CreateUserDto,
  UpdateUserDto,
  UserStatusDetailDto,
  DataItem,
  ApiResponse,
} from '../../models';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css',
})
export class UserComponent implements OnInit {
  private userService = inject(UserService);

  rows = signal<UserAdvancedRow[]>([]);
  loading = signal(true);
  totalRecords = signal(0);
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

  statusOptions = signal<UserStatusDetailDto[]>([]);
  roleOptions = signal<DataItem[]>([]);

  showModal = signal(false);
  saving = signal(false);
  loadingDetail = signal(false);
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

  ngOnInit(): void {
    this.loadOptions();
    this.loadData();
  }

  loadOptions(): void {
    this.userService
      .getUserStatuses()
      .subscribe((res) => this.statusOptions.set(res?.resources || []));
    this.userService
      .getRoles()
      .subscribe((res) => this.roleOptions.set(res?.resources || []));
  }

  loadData(): void {
    this.loading.set(true);
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

    this.userService.getPagedAdvanced(body).subscribe({
      next: (res) => {
        this.loading.set(false);
        const r = res?.resources ?? (res as any)?.data;
        if (r?.data) {
          this.rows.set(r.data);
          this.totalRecords.set(r.recordsFiltered ?? r.recordsTotal ?? 0);
        } else {
          this.rows.set([]);
          this.totalRecords.set(0);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }
  applyFilter(): void {
    this.page.set(1);
    this.loadData();
  }
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
    else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
    this.page.set(1);
    this.loadData();
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
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }
  visiblePages(): number[] {
    const total = this.totalPages(),
      cur = this.page(),
      d = 2,
      pages: number[] = [];
    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++)
      pages.push(i);
    return pages;
  }

  openCreate(): void {
    this.previousStatusId = null;
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
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  openEdit(row: UserAdvancedRow): void {
    this.previousStatusId = null;
    this.editItem.set(row);
    this.loadingDetail.set(true);
    this.showModal.set(true);

    this.userService.getById(row.id).subscribe({
      next: (res) => {
        this.loadingDetail.set(false);
        const d: UserDetailDto = res?.resources ?? (res as any)?.data;
        if (d) {
          this.form.set({
            email: d.email,
            passwordHash: '',
            phoneNumber: d.phoneNumber || '',
            gender: d.gender ?? 1,
            firstName: d.firstName,
            lastName: d.lastName,
            userStatusId: d.userStatus?.id || 0,
            lockEnabled: d.lockEnabled || false,
            lockEndDate: d.lockEndDate
              ? this.formatDateTimeLocal(d.lockEndDate)
              : '',
            roles: d.roles?.map((r: any) => r.id) || [],
          });
        }
      },
      error: () => {
        this.loadingDetail.set(false);
        this.form.update((f) => ({
          ...f,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          userStatusId: row.userStatusId,
          lockEnabled: row.lockEnabled,
          lockEndDate: row.lockEndDate
            ? this.formatDateTimeLocal(row.lockEndDate)
            : '',
          roles: row.roles?.map((r) => r.id) || [],
        }));
      },
    });
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
      (s) =>
        s.name.toLowerCase().includes('khóa') ||
        s.name.toLowerCase().includes('lock')
    );
    const activeStatus = this.statusOptions().find(
      (s) =>
        s.name.toLowerCase().includes('hoạt động') ||
        s.name.toLowerCase().includes('active')
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
        this.previousStatusId ||
        (activeStatus ? activeStatus.id : this.statusOptions()[0]?.id);
      this.form.update((f) => ({
        ...f,
        lockEnabled: false,
        lockEndDate: '',
        userStatusId: restoreId,
      }));
    }
  }

  toggleRole(id: number, checked: boolean): void {
    this.form.update((x) => ({
      ...x,
      roles: checked
        ? [...x.roles, id]
        : x.roles.filter((r: number) => r !== id),
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
      this.saving.set(true);

      if (this.isEdit()) {
        const payload: UpdateUserDto = {
          id: this.editItem()!.id,
          userStatusId: f.userStatusId,
          roles: f.roles,
          lockEnabled: f.lockEnabled,
          lockEndDate: f.lockEnabled ? f.lockEndDate : null,
        };
        this.userService.update(payload).subscribe({
          next: (res) => {
            this.saving.set(false);
            if (res.isSucceeded) {
              this.closeModal();
              this.loadData();
              this.showAlert('Cập nhật thành công!');
            } else this.showAlert(res.message || 'Lỗi', false);
          },
          error: (err) => {
            this.saving.set(false);
            this.showAlert(err?.errors?.message || 'Lỗi hệ thống', false);
          },
        });
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
        this.userService.create(payload).subscribe({
          next: (res) => {
            this.saving.set(false);
            if (res.isSucceeded) {
              this.closeModal();
              this.loadData();
              this.showAlert('Thêm thành công!');
            } else this.showAlert(res.message || 'Lỗi', false);
          },
          error: (err) => {
            this.saving.set(false);
            this.showAlert(err?.errors?.message || 'Lỗi hệ thống', false);
          },
        });
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
      if (result.isConfirmed) {
        this.userService.delete(id).subscribe((res: any) => {
          if (res.isSucceeded) {
            this.loadData();
            this.showAlert('Đã xóa thành công!');
          } else this.showAlert(res.message, false);
        });
      }
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
