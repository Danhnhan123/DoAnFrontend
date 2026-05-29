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
      import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./components/product/product.component').then(m => m.ProductComponent),
  },
  {
    path: 'inbound',
    loadComponent: () =>
      import('./components/inbound/inbound.component').then(m => m.InboundComponent),
  },
  {
    path: 'outbound',
    loadComponent: () =>
      import('./components/outbound/outbound.component').then(m => m.OutboundComponent),
  },
  {
    path: 'stocktake',
    loadComponent: () =>
      import('./components/stocktake/stocktake.component').then(m => m.StocktakeComponent),
  },
  {
    path: 'warehouse',
    loadComponent: () =>
      import('./components/warehouse/warehouse.component').then(m => m.WarehouseComponent),
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./components/reports/reports.component').then(m => m.ReportsComponent),
  },
  {
    path: 'alert',
    loadComponent: () =>
      import('./components/alert/alert.component').then(m => m.AlertComponent),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./components/user/user.component').then(m => m.UserComponent),
  },
  {
    path: 'roles',
    loadComponent: () =>
      import('./components/role/role.component').then(m => m.RoleComponent),
  },
  {
    path: 'menus',
    loadComponent: () =>
      import('./components/menu/menu.component').then(m => m.MenuComponent),
  },
  {
    path: 'system-config',
    loadComponent: () =>
      import('./components/system-config/system-config.component').then(m => m.SystemConfigComponent),
  },
  {
    path: 'audit-log',
    loadComponent: () =>
      import('./components/audit-log/audit-log.component').then(m => m.AuditLogComponent),
  },
  {
    path: 'activity-log',
    loadComponent: () =>
      import('./components/activity-log/activity-log.component').then(m => m.ActivityLogComponent),
  },
  {
    path: 'actions',
    loadComponent: () =>
      import('./components/action/action.component').then(m => m.ActionComponent),
  },
  {
    path: 'user-status',
    loadComponent: () =>
      import('./components/user-status/user-status.component').then(m => m.UserStatusComponent),
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
      {
        path: 'inbound',
        loadComponent: () =>
          import('./components/inbound/inbound.component').then(m => m.InboundComponent),
      },
      {
        path: 'outbound',
        loadComponent: () =>
          import('./components/outbound/outbound.component').then(m => m.OutboundComponent),
      },
      {
        path: 'stocktake',
        loadComponent: () =>
          import('./components/stocktake/stocktake.component').then(m => m.StocktakeComponent),
      },
      {
        path: 'warehouse',
        loadComponent: () =>
          import('./components/warehouse/warehouse.component').then(m => m.WarehouseComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./components/reports/reports.component').then(m => m.ReportsComponent),
      },
      {
        path: 'alert',
        loadComponent: () =>
          import('./components/alert/alert.component').then(m => m.AlertComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/admin/dashboard' },
];
