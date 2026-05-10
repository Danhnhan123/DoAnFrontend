import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Redirect root
  { path: '', redirectTo: '/admin/dashboard', pathMatch: 'full' },

  // Login
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent)
  },

  // Admin shell
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./components/user/user.component').then(m => m.UserComponent)
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./components/role/role.component').then(m => m.RoleComponent)
      },
      {
        path: 'menus',
        loadComponent: () =>
          import('./components/menu/menu.component').then(m => m.MenuComponent)
      },
      {
        path: 'system-config',
        loadComponent: () =>
          import('./components/system-config/system-config.component').then(m => m.SystemConfigComponent)
      },
      {
        path: 'audit-log',
        loadComponent: () =>
          import('./components/audit-log/audit-log.component').then(m => m.AuditLogComponent)
      },
      {
        path: 'activity-log',
        loadComponent: () =>
          import('./components/activity-log/activity-log.component').then(m => m.ActivityLogComponent)
      },
      {
        path: 'actions',
        loadComponent: () =>
          import('./components/action/action.component').then(m => m.ActionComponent)
      },
      {
        path : 'user-status',
        loadComponent: () =>
          import('./components/user-status/user-status.component').then(m => m.UserStatusComponent)
      }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '/admin/dashboard' }
];