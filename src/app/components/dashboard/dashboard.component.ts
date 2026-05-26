import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { ApiService } from '../../services/api.service';

interface StatCard {
  title: string;
  value: string | number;
  change: string;
  changeType: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  private api = inject(ApiService);

  // ── Query 1: Dashboard statistics ────────────────────────────────────────
  statsQuery = injectQuery(() => ({
    queryKey: ['dashboard-stats'],
    queryFn: () =>
      lastValueFrom(this.api.get('/dashboard/report-statistics?period=month')),
    retry: false,
  }));

  // ── Query 2: User count (paged with pageSize=1 to get total) ─────────────
  userCountQuery = injectQuery(() => ({
    queryKey: ['dashboard-user-count'],
    queryFn: () =>
      lastValueFrom(
        this.api.getPaged<any>('/user/paged', { pageIndex: 1, pageSize: 1 })
      ),
  }));

  loading = computed(
    () => this.statsQuery.isPending() || this.userCountQuery.isPending()
  );

  stats = computed<StatCard[]>(() => {
    const userCountRes = this.userCountQuery.data() as any;
    const userCount =
      userCountRes?.resources?.total?.toLocaleString() ?? '—';

    return [
      {
        title: 'Tổng người dùng',
        value: userCount,
        change: '+12%',
        changeType: 'up',
        icon: '👥',
        color: '#6366f1',
      },
      {
        title: 'Bài viết',
        value: '—',
        change: '+5%',
        changeType: 'up',
        icon: '📝',
        color: '#10b981',
      },
      {
        title: 'Giao dịch',
        value: '—',
        change: '-2%',
        changeType: 'down',
        icon: '💳',
        color: '#f59e0b',
      },
      {
        title: 'Phản hồi',
        value: '—',
        change: '+8%',
        changeType: 'up',
        icon: '💬',
        color: '#ec4899',
      },
    ];
  });

  recentActivities = computed<any[]>(() => []);
}