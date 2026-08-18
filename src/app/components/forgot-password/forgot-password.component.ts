import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  router = inject(Router);

  email = signal('');
  loading = signal(false);
  errorMsg = signal('');
  done = signal(false);

  submit(): void {
    const email = this.email().trim();
    if (!email) {
      this.errorMsg.set('Vui lòng nhập email');
      return;
    }
    // Kiểm tra định dạng email cơ bản.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMsg.set('Email không đúng định dạng');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');

    this.authService.forgotPassword(email).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.isSucceeded) {
          this.done.set(true);
        } else {
          this.errorMsg.set(res.message || 'Không gửi được yêu cầu. Vui lòng thử lại.');
        }
      },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || 'Không gửi được yêu cầu. Vui lòng thử lại.');
      },
    });
  }

  goLogin(): void {
    this.router.navigate(['/login']);
  }
}
