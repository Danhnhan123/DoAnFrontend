import { Component, signal, computed, effect, OnInit, inject, HostListener, DestroyRef } from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, lastValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { MenuService } from '../../services/menu.service';
import { RealtimeService } from '../../services/realtime.service';
import { MenuAggregate } from '../../models';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  menuService = inject(MenuService);
  realtimeService = inject(RealtimeService);
  router = inject(Router);
  destroyRef = inject(DestroyRef);

  mobileOpen = signal(false);
  userMenuOpen = signal(false);
  expandedMenus = signal<Set<string>>(new Set());

  user = computed(() => this.authService.currentUser());
  isDark = computed(() => this.themeService.theme() === 'dark');

  /**
   * Sidebar lấy menu theo phân quyền của user đang đăng nhập (API /auth/me/menus).
   * Dùng TanStack Query với key ['sidebar-menus', userId] để khi cập nhật vai trò
   * ở trang Vai trò người dùng, ta chỉ cần invalidate key này -> sidebar tự refetch
   * và render lại, không cần reload trang hay đăng nhập lại.
   */
  sidebarQuery = injectQuery(() => ({
    queryKey: ['sidebar-menus', this.authService.currentUser()?.id ?? 0],
    queryFn: () => lastValueFrom(this.menuService.getMyMenus()),
  }));

  /**
   * Menu hiển thị: ưu tiên dữ liệu mới nhất từ API; trong lúc chờ tải lần đầu thì
   * dùng tạm menu theo quyền đã lưu khi đăng nhập để hiển thị tức thì (UX mượt).
   */
  sidebarMenus = computed<MenuAggregate[]>(() => {
    const res = this.sidebarQuery.data() as any;
    const raw: MenuAggregate[] =
      res?.resources ?? res?.data ?? this.authService.getMenus() ?? [];
    if (!raw?.length) return [];
    return raw.some((m) => m.child?.length)
      ? this.sortedMenus(raw)
      : this.menuService.buildMenuTree(raw);
  });

  menuLoading = computed(
    () => this.sidebarQuery.isPending() && this.sidebarMenus().length === 0
  );

  /** Tự mở rộng nhánh đang active mỗi khi danh sách menu thay đổi (lần đầu hoặc sau refetch). */
  private _expandOnMenuChange = effect(() => {
    this.sidebarMenus();
    this.expandActiveParents();
  });

  ngOnInit(): void {
    // Mở kết nối realtime: khi DB đổi, server báo -> các màn đang mở tự refetch.
    this.realtimeService.start();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.expandActiveParents());
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeUserMenu();
  }

  toggleExpand(id: string, event?: Event): void {
    if (event) event.preventDefault();
    this.expandedMenus.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedMenus().has(id);
  }

  menuKey(menu: MenuAggregate): string {
    return String(menu.id);
  }

  hasChildren(menu: MenuAggregate): boolean {
    return !!menu.child?.length;
  }

  sortedMenus(menus: MenuAggregate[] | undefined): MenuAggregate[] {
    return [...(menus || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  routerLinkFor(menu: MenuAggregate): string {
    const url = (menu.url || '').trim();
    if (!url || url === '#') return '';
    return url.startsWith('/') ? url : `/${url}`;
  }

  closeMobileMenu(): void {
    this.mobileOpen.set(false);
  }

  displayIcon(menu: MenuAggregate): string {
    const icon = (menu.icon || '').trim();
    if (!icon || icon.includes(' ')) return '';
    return icon;
  }

  private expandActiveParents(): void {
    const activePath = this.router.url.split('?')[0];
    const parents = new Set<string>();

    const walk = (items: MenuAggregate[], ancestors: string[] = []): boolean => {
      let found = false;
      for (const item of items) {
        const key = this.menuKey(item);
        const itemUrl = this.routerLinkFor(item);
        const childFound = walk(item.child || [], [...ancestors, key]);
        const selfFound = !!itemUrl && activePath.startsWith(itemUrl);

        if (selfFound || childFound) {
          ancestors.forEach((ancestor) => parents.add(ancestor));
          if (childFound) parents.add(key);
          found = true;
        }
      }
      return found;
    };

    walk(this.sidebarMenus());
    this.expandedMenus.update((current) => new Set([...current, ...parents]));
  }

  logout(): void {
    this.closeUserMenu();
    this.realtimeService.stop();
    this.authService.logout().subscribe({
      next: () => {},
      error: () => {},
    });
  }

  getInitials(): string {
    const user = this.user();
    if (!user?.fullName) return 'A';
    return user.fullName
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
