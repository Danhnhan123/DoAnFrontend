import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-change-password-first',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password-first.component.html',
  styleUrl: './change-password-first.component.css',
})
export class ChangePasswordFirstComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  router = inject(Router);

  oldPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  loading = signal(false);
  errorMsg = signal('');
  showOld = signal(false);
  showNew = signal(false);

  private readonly complexityRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).*$/;

  submit(): void {
    const oldP = this.oldPassword();
    const newP = this.newPassword();
    const confirmP = this.confirmPassword();

    if (!oldP || !newP || !confirmP) {
      this.errorMsg.set('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (newP.length < 10) {
      this.errorMsg.set('Mật khẩu mới phải có ít nhất 10 ký tự');
      return;
    }
    if (!this.complexityRegex.test(newP)) {
      this.errorMsg.set('Mật khẩu mới phải gồm chữ hoa, chữ thường, số và ký tự đặc biệt');
      return;
    }
    if (newP !== confirmP) {
      this.errorMsg.set('Xác nhận mật khẩu không khớp');
      return;
    }
    if (newP === oldP) {
      this.errorMsg.set('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    this.userService
      .changeMyPassword({ oldPassword: oldP, newPassword: newP, confirmNewPassword: confirmP })
      .subscribe({
        next: res => {
          this.loading.set(false);
          if (res.isSucceeded) {
            this.authService.clearMustChangePassword();
            this.router.navigate(['/admin/dashboard']);
          } else {
            this.errorMsg.set(res.message || 'Đổi mật khẩu thất bại');
          }
        },
        error: err => {
          this.loading.set(false);
          this.errorMsg.set(err?.error?.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.');
        },
      });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
