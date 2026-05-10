# components/ — UI Components

Mỗi component là một **standalone Angular component** với 4 file: `.ts`, `.html`, `.css`, `.spec.ts`.

## Sơ đồ layout tổng thể

```
/login                    → LoginComponent
/admin/**                 → AdminLayoutComponent (shell)
    ├── /admin/dashboard  → DashboardComponent
    ├── /admin/users      → UserComponent
    ├── /admin/roles      → RoleComponent
    ├── /admin/menus      → MenuComponent
    ├── /admin/actions    → ActionComponent
    ├── /admin/user-status → UserStatusComponent
    ├── /admin/system-config → SystemConfigComponent
    ├── /admin/audit-log  → AuditLogComponent
    └── /admin/activity-log → ActivityLogComponent
```

## Danh sách components

### Layout & Navigation

| Component | Mô tả |
|-----------|-------|
| `admin-layout` | Shell chứa sidebar + header + `<router-outlet>` cho toàn khu vực admin |
| `sidebar` | Menu điều hướng dọc bên trái, hiển thị dựa trên `menus` từ `AuthService` |
| `header` | Thanh tiêu đề trên cùng (logo, nút toggle theme, thông tin user, logout) |
| `footer` | Footer chung |
| `blog-layout` | Shell cho khu vực blog (client-facing) |
| `auth` | Wrapper layout cho trang xác thực |

### Xác thực

| Component | Mô tả |
|-----------|-------|
| `login` | Form đăng nhập, gọi `AuthService.login()` |
| `register` | Form đăng ký tài khoản mới |

### Quản trị người dùng

| Component | Mô tả |
|-----------|-------|
| `user` | Danh sách + CRUD người dùng (bộ lọc nâng cao DataTables, phân trang, khóa tài khoản) |
| `user-status` | Danh sách + CRUD trạng thái người dùng |
| `user-device` | Quản lý thiết bị đăng nhập của user |
| `user-verification-token` | Quản lý token xác minh email/số điện thoại |

### Phân quyền

| Component | Mô tả |
|-----------|-------|
| `role` | Danh sách + CRUD vai trò, giao diện matrix phân quyền (menu × action) |
| `permission` | Tổng hợp phân quyền theo menu/action |
| `action` | Danh sách + CRUD hành động hệ thống (Xem, Thêm, Sửa, Xóa, Export...) |
| `menu` | Danh sách + CRUD menu (cây menu), gán actions cho từng menu |

### Nội dung Blog

| Component | Mô tả |
|-----------|-------|
| `blog-post` | Danh sách + CRUD bài viết |
| `blog-category` | Danh sách + CRUD danh mục bài viết |
| `blog-post-status` | Danh sách + CRUD trạng thái bài viết |
| `tag` | Danh sách + CRUD tag |
| `tag-type` | Danh sách + CRUD loại tag |

### Thanh toán

| Component | Mô tả |
|-----------|-------|
| `payment-transaction` | Danh sách giao dịch thanh toán |
| `payment-method` | Danh sách + CRUD phương thức thanh toán |
| `payment-status` | Danh sách + CRUD trạng thái thanh toán |

### Hệ thống & Tiện ích

| Component | Mô tả |
|-----------|-------|
| `dashboard` | Tổng quan thống kê (số user, bài viết, giao dịch, phản hồi) |
| `system-config` | Danh sách + CRUD cấu hình hệ thống (key-value) |
| `audit-log` | Xem nhật ký thay đổi dữ liệu DB (INSERT/UPDATE/DELETE) |
| `activity-log` | Xem nhật ký hành động người dùng |
| `notification` | Quản lý thông báo |
| `notification-category` | Danh sách + CRUD danh mục thông báo |
| `notification-type` | Danh sách + CRUD loại thông báo |
| `feedback` | Xem và quản lý phản hồi từ người dùng |
| `file-manager` | Upload và quản lý file |
| `province` | Danh sách tỉnh/thành phố |
| `ward` | Danh sách phường/xã |

## Quy tắc viết Component

### ✅ Component NÊN làm
```typescript
// Inject Service
private userService = inject(UserService);

// Gọi hàm từ Service
this.userService.getPagedAdvanced(body).subscribe(res => {
  this.rows.set(res.resources.data);
});

// Quản lý UI state bằng signal
loading = signal(true);
rows = signal<UserRow[]>([]);

// Xử lý UI logic thuần (pagination, sort toggle, open/close modal)
sort(field: string) { ... }
setPage(p: number) { ... }
```

### ❌ Component KHÔNG được làm
```typescript
// KHÔNG inject HttpClient trực tiếp
private http = inject(HttpClient);  // ❌

// KHÔNG dùng environment.baseUrl
private base = environment.baseUrl; // ❌

// KHÔNG xây dựng request body phức tạp inline
const body = { draw: 1, columns: [...], order: [...] }; // ❌ (thuộc về Service)
```

## Pattern CRUD chuẩn

```
ngOnInit() → loadData()
                 │
                 ▼
           Service.getPaged()
                 │
         ┌───────┴──────────┐
    Thành công          Thất bại
         │                  │
  rows.set(data)    loading.set(false)

openCreate() / openEdit(row)
         │
         ▼
   form.set(...)
   showModal.set(true)
         │
         ▼ (user submit)
       save()
         │
         ▼
   Service.create() / Service.update()
         │
   ┌─────┴──────┐
Thành công   Thất bại
   │              │
closeModal()  showAlert(error)
loadData()
```