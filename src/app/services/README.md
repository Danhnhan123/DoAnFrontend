# services/ — Tầng Business Logic & HTTP

Thư mục này chứa **tất cả** logic gọi API và xử lý dữ liệu. Components không được gọi HTTP trực tiếp.

## Danh sách Services

| Service | Endpoint cơ sở | Mô tả |
|---------|---------------|-------|
| `api.service.ts` | `/` | Base service: `get`, `post`, `put`, `delete`, `getPaged` tổng quát |
| `auth.service.ts` | `/auth` | Đăng nhập, đăng xuất, refresh token, lưu session |
| `theme.service.ts` | — | Quản lý dark/light mode (localStorage + DOM) |
| `user.service.ts` | `/user` | CRUD người dùng, phân trang nâng cao DataTables, build request body |
| `user-status.service.ts` | `/user-status` | CRUD trạng thái người dùng, build DataTables body |
| `role.service.ts` | `/role` | CRUD vai trò, tải menu/actions để phân quyền, flatten menu tree |
| `menu.service.ts` | `/menu` | CRUD menu, build cây menu từ mảng phẳng |
| `action.service.ts` | `/action` | CRUD actions (hành động hệ thống), build DataTables body |
| `activity-log.service.ts` | `/activity-log` | Lấy nhật ký hoạt động người dùng (phân trang) |
| `audit-log.service.ts` | `/audit-log` | Lấy nhật ký kiểm toán DB, format JSON, phân loại hành động |
| `system-config.service.ts` | `/system-config` | CRUD cấu hình hệ thống (key-value) |
| `blog-post.service.ts` | `/blog-post` | CRUD bài viết blog |
| `blog-category.service.ts` | `/blog-category` | CRUD danh mục blog |
| `blog-layout.service.ts` | `/blog-layout` | CRUD layout blog |
| `blog-post-status.service.ts` | `/blog-post-status` | CRUD trạng thái bài viết |
| `feedback.service.ts` | `/feedback` | Quản lý phản hồi người dùng |
| `file-manager.service.ts` | `/file-manager` | Upload/quản lý file |
| `notification.service.ts` | `/notification` | Quản lý thông báo |
| `notification-category.service.ts` | `/notification-category` | CRUD danh mục thông báo |
| `notification-type.service.ts` | `/notification-type` | CRUD loại thông báo |
| `payment-method.service.ts` | `/payment-method` | CRUD phương thức thanh toán |
| `payment-status.service.ts` | `/payment-status` | CRUD trạng thái thanh toán |
| `payment-transaction.service.ts` | `/payment-transaction` | Quản lý giao dịch thanh toán |
| `permission.service.ts` | `/permission` | Quản lý quyền hạn |
| `province.service.ts` | `/province` | Danh sách tỉnh/thành |
| `ward.service.ts` | `/ward` | Danh sách phường/xã |
| `tag.service.ts` | `/tag` | CRUD tag |
| `tag-type.service.ts` | `/tag-type` | CRUD loại tag |
| `user-device.service.ts` | `/user-device` | Quản lý thiết bị người dùng |
| `user-verification-token.service.ts` | `/user-verification-token` | Quản lý token xác thực |

## Hàm tiện ích dùng chung

Được export từ `user.service.ts` để tái sử dụng:

```typescript
import { formatToDDMMYYYY, buildDateRange } from './user.service';

// Chuyển YYYY-MM-DD → DD/MM/YYYY
formatToDDMMYYYY('2024-01-15') // → '15/01/2024'

// Build chuỗi khoảng ngày cho DataTables backend
buildDateRange('2024-01-01', '2024-01-31') // → '01/01/2024 - 31/01/2024'
```

## Pattern: buildPagedBody()

Các service hỗ trợ DataTables (user, action, user-status) cung cấp hàm `buildPagedBody()` để xây dựng request body theo đúng cấu trúc backend C# cần:

```typescript
// Trong component:
const body = this.userService.buildPagedBody({ page, pageSize, search, sortField, ... });
this.userService.getPagedAdvanced(body).subscribe(...)
```

Điều này giúp component hoàn toàn không cần biết về cấu trúc request DataTables.