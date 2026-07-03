import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

const adminChildren: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/dashboard/dashboard.component')
    .then(m => m.DashboardComponent),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./components/product/product.component')
    .then(m => m.ProductComponent),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./components/user/user.component')
    .then(m => m.UserComponent),
  },
  {
    path: 'roles',
    loadComponent: () =>
      import('./components/role/role.component')
    .then(m => m.RoleComponent),
  },
  {
    path: 'menus',
    loadComponent: () =>
      import('./components/menu/menu.component')
    .then(m => m.MenuComponent),
  },
  {
    path: 'system-config',
    loadComponent: () =>
      import('./components/system-config/system-config.component')
    .then(m => m.SystemConfigComponent),
  },
  {
    path: 'audit-log',
    loadComponent: () =>
      import('./components/audit-log/audit-log.component')
    .then(m => m.AuditLogComponent),
  },
  {
    path: 'activity-log',
    loadComponent: () =>
      import('./components/activity-log/activity-log.component')
    .then(m => m.ActivityLogComponent),
  },
  {
    path: 'actions',
    loadComponent: () =>
      import('./components/action/action.component')
    .then(m => m.ActionComponent),
  },
  {
    path: 'user-status',
    loadComponent: () =>
      import('./components/user-status/user-status.component')
    .then(m => m.UserStatusComponent),
  },
  {
    path: 'product-categories',
    loadComponent: () =>
      import('./components/product-category/product-category.component')
        .then(m => m.ProductCategoryComponent),
  },
  {
  path: 'product-variants',
  loadComponent: () =>
    import('./components/product-variant/product-variant.component')
      .then(m => m.ProductVariantComponent),
  },
  {
    path: 'product-attributes',
    loadComponent: () =>
      import('./components/product-attribute/product-attribute.component')
        .then(m => m.ProductAttributeComponent),
  },
  {
    path: 'inbound-orders',
    loadComponent: () =>
      import('./components/inbound-order/inbound-order.component')
        .then(m => m.InboundOrderComponent),
  },
  {
    path: 'iot-devices',
    loadComponent: () =>
      import('./components/iot-device/iot-device.component')
        .then(m => m.IotDeviceComponent),
  },
  {
    path: 'suppliers',
    loadComponent: () =>
      import('./components/supplier/supplier.component')
        .then(m => m.SupplierComponent),
  },
  {
    path: 'unit-of-measures',
    loadComponent: () =>
      import('./components/unit-of-measure/unit-of-measure.component')
        .then(m => m.UnitOfMeasureComponent),
  },
  {
    path: 'warehouses',
    loadComponent: () =>
      import('./components/warehouse/warehouse.component')
        .then(m => m.WarehouseComponent),
  },
  {
    // Vị trí lưu trữ đã gộp vào màn "Kho hàng" -> điều hướng về warehouses.
    path: 'locations',
    redirectTo: 'warehouses',
    pathMatch: 'full',
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./components/notification/notification.component')
        .then(m => m.NotificationComponent),
  },
  {
    path: 'notification-categories',
    loadComponent: () =>
      import('./components/notification-category/notification-category.component')
        .then(m => m.NotificationCategoryComponent),
  },
  {
    path: 'notification-types',
    loadComponent: () =>
      import('./components/notification-type/notification-type.component')
        .then(m => m.NotificationTypeComponent),
  },
];

export const routes: Routes = [
  { path: '', redirectTo: '/admin/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'admin',
        children: adminChildren,
      },
    ],
  },
  { path: '**', redirectTo: '/admin/dashboard' },
];
