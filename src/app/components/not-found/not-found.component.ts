import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Trang 404 — hiển thị khi truy cập đường dẫn không tồn tại
 * (hoặc màn hình chưa được xây dựng). Mọi route không khớp đều nhảy vào đây.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
})
export class NotFoundComponent {
  private router = inject(Router);

  goHome(): void {
    this.router.navigateByUrl('/admin/dashboard');
  }

  goBack(): void {
    // Quay lại trang trước; nếu không có lịch sử thì về trang chủ.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.goHome();
    }
  }
}
