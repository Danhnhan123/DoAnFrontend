# models/ — TypeScript Interfaces & DTOs

File duy nhất: `index.ts` — export tất cả các kiểu dữ liệu dùng trong toàn bộ ứng dụng.

## Nhóm kiểu dữ liệu

### Response wrappers
- `ApiResponse<T>` — wrapper chuẩn từ backend (`isSucceeded`, `resources`, `message`, `errors`)
- `PagingData<T>` — phân trang chuẩn (`items`, `total`, `pageIndex`, ...)
- `DTResponse<T>` — phân trang theo DataTables (`draw`, `recordsTotal`, `recordsFiltered`, `data`)

### DataTables
- `DTParameters` — body gửi lên khi dùng DataTables (`draw`, `columns`, `order`, `start`, `length`, `search`)
- `DTColumn` — định nghĩa một cột DataTables
- `SearchQuery` — query phân trang đơn giản (không phải DataTables)

### Auth
- `LoginRequest` — `{ username, password }`
- `LoginResponse` — `{ accessToken, refreshToken, userInfo }`
- `LoginResponseAdminUserInfo` — thông tin user sau đăng nhập (kèm menus, permissions)
- `AuthProfile` — profile đầy đủ từ `/auth/me`

### User
- `UserAdvancedRow` — hàng dữ liệu trong bảng danh sách user
- `UserDetailDto` — chi tiết user (dùng khi mở form edit)
- `CreateUserDto` / `UpdateUserDto` — payload tạo/cập nhật user
- `UserAdvancedDto` — extends `DTParameters`, thêm các filter đặc thù (username, email, roleIds...)

### Role & Permission
- `RoleListDto` — hàng dữ liệu trong bảng vai trò
- `CreateRoleDto` / `UpdateRoleDto` — payload tạo/cập nhật role (kèm `permissions[]`)
- `RolePermissonDto` — một quyền hạn (menuId + actionId)
- `RoleMenuActionDto` — body gửi lên khi cập nhật permission

### Menu
- `MenuAggregate` — menu đầy đủ (có thể có `child[]` khi đã build cây)
- `MenuDetailDto` — chi tiết menu từ API (kèm `actionIds`)
- `CreateMenuDto` / `UpdateMenuDto` — payload tạo/cập nhật menu
- `MenuPermissionDto` — cấu hình quyền hạn của menu (`hasRead`, `hasCreate`, ...)
- `FlatMenu` — menu đã được phẳng hóa (dùng trong bảng phân quyền role)

### Các entities khác
- `UserStatusAdvancedRow/DetailDto/CreateDto/UpdateDto`
- `ActionDto`, `ActionAdvancedRow`, `ActionDetailDto`, `CreateActionDto`, `UpdateActionDto`
- `SystemConfigDetailDto`
- `AuditLogDetailDto`, `ActivityLogDetailDto`
- `DataItem<T>` — kiểu cặp `{ id, name }` dùng chung

## Quy ước đặt tên

| Suffix | Ý nghĩa |
|--------|---------|
| `*Row` / `*AdvancedRow` | Dữ liệu trong bảng danh sách (từ paged API) |
| `*DetailDto` | Chi tiết đầy đủ của một record (từ GET /{id}) |
| `Create*Dto` | Payload gửi lên khi tạo mới |
| `Update*Dto` | Payload gửi lên khi cập nhật (thường kèm `id`) |
| `*Aggregate` | Kiểu phức hợp có thể chứa nested data |