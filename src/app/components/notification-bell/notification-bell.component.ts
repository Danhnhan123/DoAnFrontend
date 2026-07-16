import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { lastValueFrom, Subscription } from 'rxjs';
import { injectQuery, injectQueryClient } from '@tanstack/angular-query-experimental';
import { UserNotificationService } from '../../services/user-notification.service';
import { FcmService } from '../../services/fcm.service';
import { MyNotification } from '../../models';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css',
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private notiService = inject(UserNotificationService);
  private fcm = inject(FcmService);
  private queryClient = injectQueryClient();
  private router = inject(Router);

  open = signal(false);
  private fcmSub?: Subscription;

  listQuery = injectQuery(() => ({
    queryKey: ['my-notifications'],
    queryFn: () =>
      lastValueFrom(
        this.notiService.getMyNotifications({ pageIndex: 1, pageSize: 10, isRead: null })
      ),
  }));

  unreadQuery = injectQuery(() => ({
    queryKey: ['my-notifications-unread'],
    queryFn: () =>
      lastValueFrom(
        this.notiService.getMyNotifications({ pageIndex: 1, pageSize: 1, isRead: false })
      ),
  }));

  notifications = computed<MyNotification[]>(() => {
    const r: any = this.listQuery.data();
    const p = r?.resources ?? r?.data;
    return p?.dataSource ?? p?.items ?? [];
  });
  unreadCount = computed<number>(() => {
    const r: any = this.unreadQuery.data();
    const p = r?.resources ?? r?.data;
    return p?.total ?? p?.totalFiltered ?? 0;
  });
  badgeLabel = computed(() => {
    const n = this.unreadCount();
    return n > 99 ? '99+' : String(n);
  });
  loading = computed(() => this.listQuery.isPending());

  ngOnInit(): void {
    // Nhận thông báo realtime khi app đang mở -> làm mới danh sách + badge.
    this.fcmSub = this.fcm.messageReceived$.subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.fcmSub?.unsubscribe();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.open()) this.open.set(false);
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update(v => !v);
  }

  close(): void {
    this.open.set(false);
  }

  private refresh(): void {
    this.queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    this.queryClient.invalidateQueries({ queryKey: ['my-notifications-unread'] });
  }

  async onClick(n: MyNotification): Promise<void> {
    this.close();
    if (!n.isRead) {
      try {
        await lastValueFrom(this.notiService.markRead(n.id));
      } catch {
        /* ignore */
      }
      this.refresh();
    }
    // directionId là đường dẫn nội bộ được backend gửi kèm để điều hướng tới trang liên quan.
    if (n.directionId) {
      this.router.navigateByUrl(n.directionId);
    }
  }

  async toggleRead(n: MyNotification, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      if (n.isRead) await lastValueFrom(this.notiService.markUnread(n.id));
      else await lastValueFrom(this.notiService.markRead(n.id));
      this.refresh();
    } catch {
      /* ignore */
    }
  }

  viewAll(): void {
    this.close();
    // Mở tab "Thông báo của tôi" trong trang Hồ sơ.
    this.router.navigate(['/admin/profile'], { queryParams: { tab: 'notifications' } });
  }
}
