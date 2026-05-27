import { Component, signal, computed, OnInit, inject, HostListener, DestroyRef } from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { MenuService } from '../../services/menu.service';
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
  router = inject(Router);
  destroyRef = inject(DestroyRef);

  mobileOpen = signal(false);
  userMenuOpen = signal(false);
  expandedMenus = signal<Set<string>>(new Set());
  sidebarMenus = signal<MenuAggregate[]>([]);
  menuLoading = signal(false);
  menuLoadError = signal(false);

  user = computed(() => this.authService.currentUser());
  isDark = computed(() => this.themeService.theme() === 'dark');

  ngOnInit(): void {
    this.loadSidebarMenus();
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

  private loadSidebarMenus(): void {
    this.menuLoading.set(true);
    this.menuLoadError.set(false);

    this.menuService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const menus: MenuAggregate[] = res?.resources || res?.data || [];
          this.sidebarMenus.set(this.menuService.buildMenuTree(menus));
          this.menuLoading.set(false);
          this.expandActiveParents();
        },
        error: () => {
          const userMenus = this.authService.getMenus();
          this.sidebarMenus.set(
            userMenus.some((m) => m.child?.length)
              ? this.sortedMenus(userMenus)
              : this.menuService.buildMenuTree(userMenus)
          );
          this.menuLoading.set(false);
          this.menuLoadError.set(true);
          this.expandActiveParents();
        },
      });
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
