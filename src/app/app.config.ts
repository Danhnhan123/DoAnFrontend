import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Nạp phiên (profile + quyền + menu) từ API TRƯỚC khi app chạy, nếu còn token.
    // Nhờ vậy guard/route và directive phân quyền có dữ liệu ngay khi tải lại trang,
    // mà không cần lưu thông tin user ở localStorage.
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      if (!auth.getToken()) return;
      return firstValueFrom(auth.loadSession());
    }),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    provideTanStackQuery(new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 0,
          retry: 1,
        },
      },
    })),
  ]
};