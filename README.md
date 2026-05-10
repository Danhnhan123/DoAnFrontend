# DoAnFrontend — Angular Admin Panel

Dự án **Admin Panel** xây dựng bằng **Angular 19** (Standalone Components + Signals), giao tiếp với backend qua REST API.

---

## Yêu cầu môi trường

| Công cụ     | Phiên bản khuyến nghị |
| ----------- | --------------------- |
| Node.js     | ≥ 20.x                |
| npm         | ≥ 10.x                |
| Angular CLI | ≥ 19.x                |

---

## Cài đặt & Chạy dự án

```bash
# Cài dependencies
npm install

# Chạy development server
ng serve

# Build production
ng build --configuration production
```

Ứng dụng chạy tại `http://localhost:4200` theo mặc định.

---

## Cấu trúc thư mục

```
DoAnFrontend/
├── src/
│   ├── app/                   # Toàn bộ source code Angular
│   │   ├── components/        # UI Components (xem chi tiết bên dưới)
│   │   ├── services/          # Business logic + HTTP calls
│   │   ├── models/            # TypeScript interfaces & DTOs
│   │   ├── guards/            # Route guards (auth, guest)
│   │   ├── interceptors/      # HTTP interceptors (auth token, refresh)
│   │   ├── app.routes.ts      # Khai báo routes
│   │   └── app.config.ts      # Cấu hình ứng dụng
│   ├── environments/          # Cấu hình môi trường (dev/prod)
│   ├── index.html             # HTML gốc
│   ├── main.ts                # Entry point
│   └── styles.css             # Global CSS
├── public/                    # Static assets
├── angular.json               # Angular workspace config
├── package.json
└── tsconfig.json
```

---

## Luồng code tổng quan

```
User Action (click/input)
        │
        ▼
  Component (.ts)          ← Chỉ xử lý UI state & gọi Service
        │
        ▼
    Service (.ts)          ← Chứa toàn bộ HTTP calls & business logic
        │
        ▼
  Auth Interceptor         ← Tự động đính Bearer token vào request
        │
        ▼
    Backend API            ← REST API (baseUrl trong environment.ts)
        │
        ▼
  Service (xử lý response)
        │
        ▼
  Component (cập nhật signal → Angular tự re-render)
```

---

## Kiến trúc quan trọng

### Signals (Angular 19)

Dự án dùng **Angular Signals** (`signal()`, `computed()`, `effect()`) thay cho `BehaviorSubject` để quản lý state — giúp change detection tối ưu hơn.

### Standalone Components

Tất cả components đều là **standalone** (không có `NgModule`), lazy-loaded qua `loadComponent()` trong routes.

### Authentication Flow

1. Đăng nhập → `AuthService.login()` → lưu `accessToken` + `refreshToken` vào `localStorage`
2. Mọi request HTTP → `authInterceptor` tự gắn `Authorization: Bearer <token>`
3. Nếu nhận 401 → interceptor tự gọi `refreshToken`, retry request gốc
4. Nếu refresh thất bại → `AuthService.clearSession()` → redirect về `/login`

---

## Công nghệ sử dụng

- **Angular 19** — framework chính
- **SweetAlert2** — hộp thoại xác nhận/thông báo
- **TypeScript** — ngôn ngữ chính
- **CSS thuần** — không dùng thư viện UI component
