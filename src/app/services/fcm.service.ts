import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  Messaging,
  MessagePayload,
} from 'firebase/messaging';
import { environment } from '../../environments/environment';
import { UserDeviceService } from './user-device.service';
import { getDeviceInfo } from '../utils/device.util';

/**
 * Firebase Cloud Messaging: xin quyền, lấy device token và gửi về backend (gắn vào thiết bị),
 * đồng thời nhận thông báo khi app đang mở (foreground) qua messageReceived$.
 * Thông báo khi app ở nền do public/firebase-messaging-sw.js xử lý.
 */
@Injectable({ providedIn: 'root' })
export class FcmService {
  private userDeviceService = inject(UserDeviceService);

  private messaging?: Messaging;
  private initialized = false;

  /** Phát payload khi nhận thông báo lúc app đang mở. */
  readonly messageReceived$ = new Subject<MessagePayload>();

  /** Khởi tạo FCM (gọi sau khi đăng nhập). Không cấu hình firebase -> bỏ qua an toàn. */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (!environment.firebase?.apiKey) return;

    const supported = await isSupported().catch(() => false);
    if (!supported) return;

    try {
      const app: FirebaseApp = getApps().length
        ? getApps()[0]
        : initializeApp(environment.firebase);
      this.messaging = getMessaging(app);
      this.initialized = true;

      onMessage(this.messaging, (payload) => this.messageReceived$.next(payload));

      await this.requestPermissionAndRegisterToken();
    } catch {
      /* bỏ qua lỗi khởi tạo FCM */
    }
  }

  private async requestPermissionAndRegisterToken(): Promise<void> {
    if (!this.messaging || typeof Notification === 'undefined') return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: swReg,
      });
      if (token) this.registerToken(token);
    } catch {
      /* người dùng từ chối quyền hoặc lỗi lấy token -> bỏ qua */
    }
  }

  private registerToken(token: string): void {
    const info = getDeviceInfo();
    this.userDeviceService
      .registerDevice({
        deviceId: info.deviceId,
        deviceName: info.deviceName,
        platform: info.platform,
        userAgent: info.userAgent,
        deviceToken: token,
      })
      .subscribe({ next: () => {}, error: () => {} });
  }
}
