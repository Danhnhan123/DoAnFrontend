import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  router = inject(Router);

  username = signal('');
  password = signal('');
  loading = signal(false);
  errorMsg = signal('');
  showPass = signal(false);

  isDark = () => this.themeService.theme() === 'dark';

  submit(): void {
    if (!this.username() || !this.password()) {
      this.errorMsg.set('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');

    this.authService.login({ username: this.username(), password: this.password() }).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.isSucceeded) {
          // Tài khoản mới/đã reset: buộc đổi mật khẩu trước khi vào hệ thống.
          if (res.resources?.userInfo?.mustChangePassword) {
            this.router.navigate(['/doi-mat-khau-lan-dau']);
          } else {
            this.router.navigate(['/admin/dashboard']);
          }
        } else {
          this.errorMsg.set(res.message || 'Đăng nhập thất bại');
        }
      },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    });
  }
  togglePass() {
    this.showPass.update(v => !v);
  }
}