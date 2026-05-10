# interceptors/ — HTTP Interceptors

## auth.interceptor.ts

Interceptor chức năng (`HttpInterceptorFn`) xử lý xác thực tự động ở tầng HTTP.

### Luồng xử lý

```
Mọi HTTP request
       │
       ▼
Lấy accessToken từ AuthService
       │
       ├── Có token → Clone request + đính header Authorization: Bearer <token>
       │
       └── Không có token → Gửi request không có token
                │
                ▼
          Gửi request
                │
                ▼
          Response về
                │
                ├── Thành công (2xx) → trả về bình thường
                │
                └── 401 Unauthorized
                        │
                        ├── Có refreshToken → Gọi /auth/refresh-token
                        │       │
                        │       ├── Refresh thành công → Retry request gốc với token mới
                        │       │
                        │       └── Refresh thất bại → clearSession() + redirect /login
                        │
                        └── Không có refreshToken → clearSession() + redirect /login
```

### Đăng ký

Được đăng ký trong `app.config.ts` qua `withInterceptors([authInterceptor])`.