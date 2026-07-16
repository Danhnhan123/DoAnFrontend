import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { getOrCreateDeviceId } from '../utils/device.util';

/**
 * Kết nối SignalR presence để:
 * - Báo trạng thái thiết bị hiện tại (active/idle) — idle khi 30' không gọi API.
 * - Nghe "ForceLogout" -> đăng xuất tại chỗ khi bị đăng xuất từ thiết bị khác.
 * - Nghe "DevicesChanged" -> phát tín hiệu để màn Profile làm mới danh sách thiết bị.
 * (offline do server tự phát hiện khi kết nối bị ngắt — tắt màn hình/đóng tab.)
 */
@Injectable({ providedIn: 'root' })
export class DevicePresenceService {
  private auth = inject(AuthService);

  private connection?: signalR.HubConnection;
  private started = false;
  private lastActivity = Date.now();
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private currentStatus: 'active' | 'idle' = 'active';

  /** Phát khi danh sách/trạng thái thiết bị thay đổi (Profile lắng nghe để refetch). */
  readonly devicesChanged$ = new Subject<void>();

  private readonly IDLE_MS = 30 * 60 * 1000; // 30 phút

  start(): void {
    if (this.started) return;
    this.started = true;

    const hubUrl =
      environment.baseUrl.replace(/\/api\/v\d+\/?$/, '') +
      '/hubs/device-presence?deviceId=' +
      encodeURIComponent(getOrCreateDeviceId());

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => this.auth.getToken() ?? '',
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('ForceLogout', () => this.onForceLogout());
    this.connection.on('DevicesChanged', () => this.devicesChanged$.next());

    this.connection.start().catch(() => {
      this.started = false;
    });

    this.lastActivity = Date.now();
    this.currentStatus = 'active';
    this.idleTimer = setInterval(() => this.checkIdle(), 60 * 1000);
  }

  stop(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
    this.connection?.stop().catch(() => {});
    this.connection = undefined;
    this.started = false;
  }

  /** Gọi mỗi khi có request API (từ interceptor) -> đánh dấu đang hoạt động. */
  markActivity(): void {
    this.lastActivity = Date.now();
    if (this.currentStatus === 'idle') {
      this.currentStatus = 'active';
      this.report('active');
    }
  }

  private checkIdle(): void {
    if (Date.now() - this.lastActivity >= this.IDLE_MS && this.currentStatus !== 'idle') {
      this.currentStatus = 'idle';
      this.report('idle');
    }
  }

  private report(status: 'active' | 'idle'): void {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      this.connection.invoke('ReportStatus', status).catch(() => {});
    }
  }

  private onForceLogout(): void {
    this.stop();
    // Xoá phiên cục bộ + điều hướng về trang đăng nhập.
    this.auth.clearSession();
  }
}
