# src/ — Thư mục nguồn ứng dụng

## Cấu trúc

```
src/
├── app/              # Toàn bộ Angular app (components, services, models...)
├── environments/     # Biến cấu hình theo môi trường (baseUrl API, ...)
├── index.html        # HTML gốc — chứa <app-root>
├── main.ts           # Entry point — bootstrapApplication()
├── main.server.ts    # Entry point cho SSR (Angular Universal)
├── server.ts         # Express server cho SSR
└── styles.css        # Global CSS (CSS variables, reset, theme light/dark)
```

## Điểm khởi động ứng dụng

**`main.ts`** — Bootstrap ứng dụng:

```typescript
bootstrapApplication(AppComponent, appConfig);
```

**`app.config.ts`** — Đăng ký providers toàn cục:

- `provideRouter(routes)` — hệ thống routing
- `provideHttpClient(withFetch(), withInterceptors([authInterceptor]))` — HTTP client + auth interceptor

**`app.routes.ts`** — Định nghĩa tất cả routes:

- `/` → redirect `/admin/dashboard`
- `/login` (canActivate: `guestGuard`) → `LoginComponent`
- `/admin/**` (canActivate: `authGuard`) → `AdminLayoutComponent` + lazy-loaded children

## Global Styles (styles.css)

File `styles.css` định nghĩa:

- **CSS Variables** cho theme (`--color-primary`, `--color-bg`, ...)
- **Attribute-based theming**: `[data-theme="dark"]` để toggle dark mode
- **Reset** và typography cơ bản
- Utility classes dùng chung
