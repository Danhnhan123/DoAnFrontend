import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  DataItem,
  UserBulkRow,
  UserBatchRowError,
  UserImportRow,
  CreateUserDto,
} from '../../models';
import { UserService } from '../../services/user.service';
import { FilterSelectComponent } from '../shared/filter-select.component';

@Component({
  selector: 'app-user-bulk-create',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterSelectComponent],
  templateUrl: './user-bulk-create.component.html',
  styleUrl: './user-bulk-create.component.css',
})
export class UserBulkCreateComponent {
  private userService = inject(UserService);

  @Input() roleOptions: DataItem[] = [];
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  rows = signal<UserBulkRow[]>([this.emptyRow()]);
  batchRoles = signal<number[]>([]);
  /** Lỗi theo dòng, key = chỉ số dòng (0-based). */
  rowErrors = signal<Record<number, string[]>>({});
  generalError = signal('');
  importing = signal(false);
  saving = signal(false);

  readonly genderOptions = [
    { id: 1, name: 'Nam' },
    { id: 0, name: 'Nữ' },
  ];

  private emptyRow(): UserBulkRow {
    return { username: '', email: '', firstName: '', lastName: '', phoneNumber: '', gender: 1, roles: [] };
  }

  // ── Thao tác bảng ──────────────────────────────────────────────────────────
  addRow(): void {
    this.rows.update(r => [...r, { ...this.emptyRow(), roles: [...this.batchRoles()] }]);
  }

  removeRow(i: number): void {
    this.rows.update(r => r.filter((_, idx) => idx !== i));
    this.clearErrors();
  }

  setCell(i: number, field: keyof UserBulkRow, value: any): void {
    this.rows.update(r => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  setRowRoles(i: number, roles: number[]): void {
    this.setCell(i, 'roles', roles);
  }

  applyBatchRolesToAll(): void {
    const roles = [...this.batchRoles()];
    this.rows.update(r => r.map(row => ({ ...row, roles: [...roles] })));
  }

  clearErrors(): void {
    this.rowErrors.set({});
    this.generalError.set('');
  }

  rowError(i: number): string[] {
    return this.rowErrors()[i] || [];
  }

  // ── Import file ────────────────────────────────────────────────────────────
  downloadTemplate(format: 'xlsx' | 'csv'): void {
    this.userService.downloadImportTemplate(format).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'csv' ? 'mau-tao-user.csv' : 'mau-tao-user.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.showAlert('Không tải được file mẫu', false),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing.set(true);
    this.userService.parseImport(file).subscribe({
      next: res => {
        this.importing.set(false);
        input.value = '';
        if (res.isSucceeded && res.resources) {
          const imported = res.resources.map(
            (r: UserImportRow) =>
              ({
                username: r.username || '',
                email: r.email || '',
                firstName: r.firstName || '',
                lastName: r.lastName || '',
                phoneNumber: r.phoneNumber || '',
                gender: r.gender ?? 1,
                roles: [...this.batchRoles()],
              } as UserBulkRow)
          );
          if (imported.length === 0) {
            this.showAlert('File không có dữ liệu', false);
            return;
          }
          this.rows.set(imported);
          this.clearErrors();
          this.showAlert(`Đã nạp ${imported.length} dòng từ file`);
        } else {
          this.showAlert(res.message || 'Không đọc được file', false);
        }
      },
      error: err => {
        this.importing.set(false);
        input.value = '';
        this.showAlert(err?.error?.message || 'Không đọc được file', false);
      },
    });
  }

  // ── Validate + submit ──────────────────────────────────────────────────────
  private validate(): boolean {
    const rows = this.rows();
    if (rows.length === 0) {
      this.generalError.set('Chưa có dòng nào để tạo');
      return false;
    }

    const usernameRegex = /^[a-zA-Z0-9]{6,30}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seenUser: Record<string, number> = {};
    const seenEmail: Record<string, number> = {};
    const errs: Record<number, string[]> = {};

    rows.forEach((row, i) => {
      const e: string[] = [];
      if (!row.username) e.push('Thiếu tên đăng nhập');
      else if (!usernameRegex.test(row.username)) e.push('Tên đăng nhập 6-30 ký tự, chỉ chữ và số');
      if (!row.email) e.push('Thiếu email');
      else if (!emailRegex.test(row.email)) e.push('Email sai định dạng');
      if (!row.firstName) e.push('Thiếu họ');
      if (!row.lastName) e.push('Thiếu tên');
      if (!row.roles || row.roles.length === 0) e.push('Chưa chọn vai trò');

      if (row.username) {
        const k = row.username.trim().toLowerCase();
        if (seenUser[k] !== undefined) e.push(`Tên đăng nhập trùng dòng ${seenUser[k] + 1}`);
        else seenUser[k] = i;
      }
      if (row.email) {
        const k = row.email.trim().toLowerCase();
        if (seenEmail[k] !== undefined) e.push(`Email trùng dòng ${seenEmail[k] + 1}`);
        else seenEmail[k] = i;
      }

      if (e.length) errs[i] = e;
    });

    this.rowErrors.set(errs);
    if (Object.keys(errs).length > 0) {
      this.generalError.set('Danh sách còn lỗi, vui lòng sửa các dòng được đánh dấu đỏ.');
      return false;
    }
    this.generalError.set('');
    return true;
  }

  submit(): void {
    if (this.saving()) return;
    if (!this.validate()) return;

    const payload: CreateUserDto[] = this.rows().map(r => ({
      username: r.username.trim(),
      email: r.email.trim(),
      firstName: r.firstName.trim(),
      lastName: r.lastName.trim(),
      phoneNumber: r.phoneNumber?.trim() || undefined,
      gender: r.gender,
      roles: r.roles,
    }));

    Swal.fire({
      title: 'Xác nhận tạo hàng loạt',
      text: `Tạo ${payload.length} người dùng? Mật khẩu sẽ được gửi vào email từng người.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Tạo tất cả',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#15803d',
    }).then(result => {
      if (!result.isConfirmed) return;
      this.saving.set(true);
      this.userService.createList(payload).subscribe({
        next: (res: any) => {
          this.saving.set(false);
          if (res.isSucceeded) {
            this.showAlert(`Đã tạo ${payload.length} người dùng thành công!`);
            this.saved.emit();
          } else {
            this.applyServerErrors(res);
          }
        },
        error: (err: any) => {
          this.saving.set(false);
          this.applyServerErrors(err?.error);
        },
      });
    });
  }

  /** Ánh xạ lỗi theo dòng do backend trả về (errors = [{ row, errors[] }], row 1-based). */
  private applyServerErrors(res: any): void {
    const serverErrors = res?.errors;
    if (Array.isArray(serverErrors) && serverErrors.length > 0) {
      const errs: Record<number, string[]> = {};
      serverErrors.forEach((se: UserBatchRowError) => {
        if (se && typeof se.row === 'number') errs[se.row - 1] = se.errors || [];
      });
      this.rowErrors.set(errs);
      this.generalError.set(res?.message || 'Danh sách còn lỗi, vui lòng sửa lại.');
    } else {
      this.showAlert(res?.message || 'Tạo thất bại', false);
    }
  }

  cancel(): void {
    this.closed.emit();
  }

  private showAlert(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#15803d',
    });
  }
}
