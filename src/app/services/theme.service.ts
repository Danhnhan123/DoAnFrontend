import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'admin_theme';
  private platformId = inject(PLATFORM_ID); // Inject ID môi trường

  // Khởi tạo mặc định là 'light' để an toàn cho SSR
  theme = signal<Theme>('light');

  constructor() {
    // 1. Kiểm tra môi trường để load theme ban đầu từ localStorage
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme;
      if (savedTheme) {
        this.theme.set(savedTheme);
      }
    }

    // 2. Effect sẽ tự động chạy khi theme thay đổi
    effect(() => {
      const t = this.theme();
      // Chỉ thực thi các thao tác DOM và Storage ở phía Browser
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem(this.STORAGE_KEY, t);
      }
    });
  }

  toggle(): void {
    this.theme.set(this.theme() === 'light' ? 'dark' : 'light');
  }
}
