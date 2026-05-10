import { Component, signal, computed, OnInit, inject } from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
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
  router = inject(Router);

  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);
  expandedMenus = signal<Set<number>>(new Set());

  menus = computed(() => this.authService.getMenus());
  user = computed(() => this.authService.currentUser());
  isDark = computed(() => this.themeService.theme() === 'dark');

  ngOnInit(): void {}

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  toggleExpand(id: any, event?: Event): void {
    if (event) {
      event.preventDefault(); // Chặn hành vi click nhầm của trình duyệt
    }
    const numId = Number(id); // Ép về số để Set nhận diện chính xác
    this.expandedMenus.update((set) => {
      const next = new Set(set);
      next.has(numId) ? next.delete(numId) : next.add(numId);
      return next;
    });
  }

  isExpanded(id: any): boolean {
    return this.expandedMenus().has(Number(id)); // Ép về số
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {},
      error: () => {},
    });
  }

  getMenuIcon(icon?: string): string {
    return icon || '📁';
  }

  getInitials(): string {
    const user = this.user();
    if (!user?.fullName) return 'A';
    return user.fullName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
