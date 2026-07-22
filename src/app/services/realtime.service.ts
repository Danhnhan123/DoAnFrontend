import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { injectQueryClient } from '@tanstack/angular-query-experimental';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Realtime "invalidate-on-change": server (SignalR) chỉ báo "entity X vừa đổi",
 * FE map sang queryKey và gọi invalidateQueries để TanStack tự refetch 1 lần.
 *
 * Muốn bật realtime cho màn nào: thêm 1 dòng map entity -> queryKey ở dưới
 * (và thêm tên entity vào RealtimeEntityNames phía backend).
 */
const REALTIME_MAP: Record<string, string[]> = {
  User: ['users'],
  Role: ['roles', 'role-options', 'sidebar-menus'],
  Menu: ['menus', 'all-menus', 'sidebar-menus'],
  UserStatus: ['user-statuses', 'user-status-options'],
  Action: ['actions', 'all-actions'],
  Product: ['products', 'product-options'],
  ProductCategory: ['product-categories', 'product-category-options'],
  ProductVariant: ['product-variants', 'inbound-product-variant-options'],
  ProductAttribute: ['product-attributes'],
  Supplier: ['suppliers'],
  UnitOfMeasure: ['unit-of-measures'],
  IotDevice: ['iot-devices'],
  Warehouse: ['warehouses', 'warehouse-options', 'inbound-warehouse-options'],
  Location: ['locations'],
  InboundOrder: ['inbound-orders'],
  Inventory: ['inventories', 'inventory-summary'],
  InventoryTransaction: [
    'inventory-transactions',
    'inventories',
    'inventory-summary',
  ],
  Alert: ['alerts', 'alerts-summary'],
  SystemConfig: ['system-configs'],
  Notification: ['notifications'],
  NotificationCategory: ['notification-categories', 'notification-category-options'],
  NotificationType: ['notification-types'],
  AuditLog: ['audit-log'],
  ActivityLog: ['activity-log'],
  PaddyLot: ['paddy-lots'],
};

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private queryClient = injectQueryClient();
  private auth = inject(AuthService);

  private connection?: signalR.HubConnection;
  private started = false;

  private pendingKeys = new Set<string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Mở kết nối realtime (gọi 1 lần sau khi đăng nhập). */
  start(): void {
    if (this.started) return;
    this.started = true;

    // baseUrl dạng .../api/v1 -> hub nằm ở gốc host: .../hubs/data-change
    const hubUrl =
      environment.baseUrl.replace(/\/api\/v\d+\/?$/, '') + '/hubs/data-change';

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => this.auth.getToken() ?? '',
        // Xác thực bằng token (không dùng cookie) -> tắt credentials để tránh
        // lỗi CORS "Cannot use wildcard in Access-Control-Allow-Origin when
        // credentials flag is true" (server đang trả Allow-Origin: *).
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on('EntityChanged', (names: string[]) =>
      this.onEntitiesChanged(names)
    );

    this.connection.start().catch(() => {
      // Không kết nối được thì app vẫn chạy bình thường (chỉ mất realtime).
      this.started = false;
    });
  }

  /** Đóng kết nối (gọi khi đăng xuất). */
  stop(): void {
    this.connection?.stop().catch(() => {});
    this.connection = undefined;
    this.started = false;
    this.pendingKeys.clear();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private onEntitiesChanged(names: string[]): void {
    if (!Array.isArray(names)) return;

    for (const name of names) {
      (REALTIME_MAP[name] ?? []).forEach((k) => this.pendingKeys.add(k));
    }
    if (this.pendingKeys.size === 0) return;

    // Gom nhiều sự kiện liên tiếp (vd import nhiều dòng) -> chỉ refetch 1 lần.
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flush(), 300);
  }

  private flush(): void {
    const keys = Array.from(this.pendingKeys);
    this.pendingKeys.clear();
    this.debounceTimer = null;

    // invalidateQueries chỉ refetch query đang active (màn đang mở) -> tiết kiệm.
    for (const key of keys) {
      this.queryClient.invalidateQueries({ queryKey: [key] });
    }
  }
}
