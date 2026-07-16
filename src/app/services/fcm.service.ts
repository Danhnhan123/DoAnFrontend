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

  /** Trạng thái quyền hiện tại: 'default' | 'granted' | 'denied' | 'unsupported'. */
  permissionState(): string {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  /** Khởi tạo FCM (gọi sau khi đăng nhập). Không cấu hình firebase -> bỏ qua an toàn. */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (!environment.firebase?.apiKey) {
      console.warn('[FCM] Bỏ qua: environment.firebase.apiKey trống (cấu hình chưa được nạp lúc build).');
      return;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.warn('[FCM] Trình duyệt không hỗ trợ Web Push/FCM (hoặc không phải HTTPS).');
      return;
    }

    try {
      const app: FirebaseApp = getApps().length
        ? getApps()[0]
        : initializeApp(environment.firebase);
      this.messaging = getMessaging(app);
      this.initialized = true;

      onMessage(this.messaging, (payload) => this.messageReceived$.next(payload));

      // Thử xin quyền + lấy token ngay lúc tải (một số trình duyệt chỉ hiện popup khi
      // có thao tác người dùng -> có thể bấm nút "Bật thông báo" trên chuông để xin lại).
      await this.requestPermission();
    } catch (e) {
      console.error('[FCM] Lỗi khởi tạo:', e);
    }
  }

  /** Xin quyền thông báo + lấy token + gửi lên server. Có thể gọi từ click (đáng tin cậy hơn). */
  async requestPermission(): Promise<void> {
    if (!this.initialized) {
      await this.init();
      return;
    }
    if (!this.messaging || typeof Notification === 'undefined') return;
    try {
      const permission = await Notification.requestPermission();
      console.log('[FCM] Notification.permission =', permission);
      if (permission !== 'granted') return;

      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: swReg,
      });
      if (token) {
        console.log('[FCM] Đã lấy device token, đăng ký lên server.');
        this.registerToken(token);
      } else {
        console.warn('[FCM] Không lấy được token — kiểm tra vapidKey và service worker /firebase-messaging-sw.js.');
      }
    } catch (e) {
      console.error('[FCM] Lỗi xin quyền/lấy token:', e);
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
