# src/app — Thư mục gốc ứng dụng Angular

## Cấu trúc

```
app/
├── components/     # Tất cả UI components (xem README trong thư mục này)
├── services/       # Business logic + API calls (xem README trong thư mục này)
├── models/         # TypeScript interfaces & DTOs dùng chung
├── guards/         # Route guards bảo vệ các route
├── interceptors/   # HTTP interceptors
├── app.component.* # Root component
├── app.routes.ts   # Định nghĩa routes
└── app.config.ts   # Cấu hình providers (HttpClient, Router, Interceptors)
```

## Nguyên tắc phân tách trách nhiệm

| Lớp             | Trách nhiệm                                                               |
| --------------- | ------------------------------------------------------------------------- |
| **Component**   | Quản lý UI state (signals), xử lý sự kiện từ template, gọi hàm từ Service |
| **Service**     | Gọi HTTP API, xây dựng request body, xử lý/biến đổi dữ liệu trả về        |
| **Model**       | Khai báo kiểu dữ liệu TypeScript, không chứa logic                        |
| **Guard**       | Kiểm tra điều kiện trước khi kích hoạt route                              |
| **Interceptor** | Xử lý request/response ở tầng HTTP (gắn token, refresh token)             |

## Quy tắc quan trọng

- **Component KHÔNG được** import `HttpClient` hay `environment.baseUrl` trực tiếp
- **Mọi HTTP call** phải nằm trong Service tương ứng
- **Business logic phức tạp** (build DataTables body, transform data, format date) thuộc về Service
- Component chỉ nhận kết quả từ Service và cập nhật signal
