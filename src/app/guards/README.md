# guards/ — Route Guards

## auth.guard.ts

Hai guards được export:

### `authGuard`
Bảo vệ các route yêu cầu đăng nhập (nhóm `/admin/**`).
- Kiểm tra `AuthService.isLoggedIn()` (đọc từ signal)
- Nếu chưa đăng nhập → redirect `/login`
- Nếu đã đăng nhập → cho phép vào

### `guestGuard`
Bảo vệ các route chỉ dành cho khách (route `/login`).
- Nếu đã đăng nhập → redirect `/admin/dashboard`
- Nếu chưa đăng nhập → cho phép vào

## Cách dùng trong routes

```typescript
// app.routes.ts
{
  path: 'admin',
  canActivate: [authGuard],   // Chỉ user đã đăng nhập
  ...
},
{
  path: 'login',
  canActivate: [guestGuard],  // Chỉ user chưa đăng nhập
  ...
}
```