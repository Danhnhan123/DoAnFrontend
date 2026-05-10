import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
export class DashboardComponent implements OnInit {
  api = inject(ApiService);

  loading = signal(true);
  stats = signal<StatCard[]>([
    { title: 'Tổng người dùng', value: '—', change: '+12%', changeType: 'up', icon: '👥', color: '#6366f1' },
    { title: 'Bài viết', value: '—', change: '+5%', changeType: 'up', icon: '📝', color: '#10b981' },
    { title: 'Giao dịch', value: '—', change: '-2%', changeType: 'down', icon: '💳', color: '#f59e0b' },
    { title: 'Phản hồi', value: '—', change: '+8%', changeType: 'up', icon: '💬', color: '#ec4899' },
  ]);

  recentActivities = signal<any[]>([]);

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    // Try to load dashboard stats, gracefully handle 501
    this.api.get('/dashboard/report-statistics?period=month').subscribe({
      next: res => {
        this.loading.set(false);
        if (res?.resources) {
          // Map data if API returns it
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });

    // Load user stats
    this.api.getPaged<any>('/user/paged', { pageIndex: 1, pageSize: 1 }).subscribe({
      next: res => {
        if (res?.resources) {
          this.stats.update(s => s.map((item, i) =>
            i === 0 ? { ...item, value: res.resources.total?.toLocaleString() || '0' } : item
          ));
        }
      },
      error: () => {}
    });
  }
}