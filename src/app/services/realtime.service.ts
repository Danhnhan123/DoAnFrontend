import { Injectable, inject } from "@angular/core";
import { Subject } from "rxjs";
import * as signalR from "@microsoft/signalr";
import { injectQueryClient } from "@tanstack/angular-query-experimental";
import { environment } from "../../environments/environment";
import { AuthService } from "./auth.service";

/**
 * Realtime "invalidate-on-change": server (SignalR) chỉ báo "entity X vừa đổi",
 * FE map sang queryKey và gọi invalidateQueries để TanStack tự refetch 1 lần.
 *
 * Muốn bật realtime cho màn nào: thêm 1 dòng map entity -> queryKey ở dưới
 * (và thêm tên entity vào RealtimeEntityNames phía backend).
 */
/** Màn Tổng quan — hầu như mọi nghiệp vụ đều làm số liệu ở đây đổi. */
const DASHBOARD = [
  "dashboard-summary",
  "dashboard-tasks",
  "dashboard-chart",
  "dashboard-alerts",
];

/** Màn Báo cáo & biểu đồ. */
const REPORTS = ["reports", "report-filter-options"];

/** Mọi chỗ đang đọc tồn kho (bảng tồn, KPI, nguồn chọn hàng của kiểm kê/chuyển kho). */
const INVENTORY_VIEWS = [
  "inventories",
  "inventory-summary",
  "stock-take-scope-inventories",
  "stock-transfer-source-inventory",
];

/** Popup/tab thông báo ở header và trong trang cá nhân. */
const NOTIFICATION_VIEWS = [
  "notifications",
  "notification-detail",
  "my-notifications",
  "my-notifications-unread",
  "profile-notifications",
  "profile-notifications-unread",
];

/** Các màn kiểm định & cách ly. */
const QC_VIEWS = [
  "quality-inspections",
  "quality-inspection-detail",
  "qc-history",
  "qc-lot-options",
  "qc-awaiting-qc-lots",
  "qc-quarantined-lots",
];

const REALTIME_MAP: Record<string, string[]> = {
  // ── Người dùng & phân quyền ────────────────────────────────────────────
  User: ["users", "user-detail", "user-statistics", "notification-user-options"],
  Role: ["roles", "role-options", "role-permissions", "sidebar-menus", "users", "user-detail"],
  Permission: ["role-permissions", "menu-permissions", "sidebar-menus"],
  UserRole: ["users", "user-detail", "role-permissions", "sidebar-menus"],
  Menu: [
    "menus",
    "all-menus",
    "menu-detail",
    "menu-permissions",
    "menu-action-options",
    "sidebar-menus",
  ],
  UserStatus: ["user-statuses", "user-status-detail", "user-status-options", "users"],
  Action: ["actions", "all-actions", "action-detail", "menu-action-options", "role-permissions"],
  UserDevice: ["devices", "my-devices", "user-device"],

  // ── Danh mục dùng chung ────────────────────────────────────────────────
  Product: ["products", "product-detail", "product-edit-detail", "product-options", "product-variants", ...REPORTS],
  ProductCategory: [
    "product-categories",
    "product-categories-all",
    "product-category-detail",
    "product-category-options",
    "products",
  ],
  ProductVariant: [
    "product-variants",
    "product-variant-detail",
    "variant-options",
    "variant-attribute-options",
    "variant-uom-options",
    "variant-rice-variety-options",
    "product-options",
    "products",
    "rice-purchase",
    "sales-order-options",
    ...INVENTORY_VIEWS,
    ...REPORTS,
  ],
  ProductAttribute: ["product-attributes", "product-attribute-detail", "variant-attribute-options"],
  Supplier: ["suppliers", "supplier-detail"],
  Customer: ["customers", "customer-detail", "customer-returns", "sales-orders", "party-debts"],
  Farmer: ["farmers", "farmer-detail", "rice-purchase", "party-debts"],
  RiceVariety: [
    "rice-varieties",
    "rice-variety-detail",
    "rice-variety-options",
    "variant-rice-variety-options",
    "rice-purchase",
    "paddy-lots",
    "milling-orders",
  ],
  Organization: ["organizations", "organization-detail"],
  UnitOfMeasure: ["unit-of-measures", "unit-of-measure-detail", "variant-uom-options"],
  Warehouse: [
    "warehouses",
    "warehouses-all",
    "warehouse-detail",
    "warehouse-options",
    "locations",
    "rice-purchase",
    ...DASHBOARD,
    ...REPORTS,
  ],
  Location: [
    "locations",
    "locations-all",
    "location-detail",
    "location-options",
    ...INVENTORY_VIEWS,
    ...REPORTS,
  ],

  // ── Nhập kho ───────────────────────────────────────────────────────────
  InboundOrder: ["inbound-orders", "inbound-order-detail", "inbound-putaway", "rice-purchase", ...DASHBOARD, ...REPORTS],
  InboundOrderItem: ["inbound-orders", "inbound-order-detail", "inbound-putaway", "rice-purchase", ...DASHBOARD, ...REPORTS],
  PurchaseOrder: [...DASHBOARD, ...REPORTS],
  PurchaseOrderItem: [...DASHBOARD, ...REPORTS],

  // ── Thu mua lúa ────────────────────────────────────────────────────────
  PaddyPurchaseSchedule: ["rice-purchase", ...DASHBOARD, ...REPORTS],
  PaddyPurchaseReceipt: [
    "rice-purchase",
    "inbound-putaway",
    "paddy-lots",
    "party-debts",
    ...DASHBOARD,
    ...REPORTS,
  ],

  // ── Lô lúa & chất lượng ────────────────────────────────────────────────
  PaddyLot: [
    "paddy-lots",
    "milling-orders",
    "inbound-putaway",
    ...QC_VIEWS,
    ...INVENTORY_VIEWS,
    ...DASHBOARD,
    ...REPORTS,
  ],
  PaddyLotBag: ["paddy-lots", "stock-takes", ...INVENTORY_VIEWS, ...REPORTS],
  PaddyLotBagContent: ["paddy-lots", "stock-takes", ...INVENTORY_VIEWS, ...REPORTS],
  PaddyLotBagMovement: ["paddy-lots", "stock-takes", ...INVENTORY_VIEWS, ...REPORTS],
  QualityInspection: ["paddy-lots", "inbound-orders", ...QC_VIEWS, ...DASHBOARD, ...REPORTS],

  // ── Tồn kho ────────────────────────────────────────────────────────────
  Inventory: ["paddy-lots", "alerts", "alerts-summary", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  InventoryTransaction: ["inventory-transactions", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  StockTake: ["stock-takes", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  StockTakeItem: ["stock-takes", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  StockTransfer: ["stock-transfers", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  StockTransferItem: ["stock-transfers", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],

  // ── Bán hàng & xuất kho ────────────────────────────────────────────────
  SalesOrder: [
    "sales-orders",
    "sales-order-options",
    "outbound-orders",
    "milling-orders",
    "milling-order-options",
    "party-debts",
    ...DASHBOARD,
    ...REPORTS,
  ],
  SalesOrderItem: ["sales-orders", "outbound-orders", "milling-orders", ...DASHBOARD, ...REPORTS],
  OutboundOrder: ["outbound-orders", "sales-orders", "party-debts", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  OutboundOrderItem: ["outbound-orders", "sales-orders", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  OutboundOrderItemAllocation: ["outbound-orders", "sales-orders", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  DeliveryNote: ["outbound-orders", "sales-orders"],

  // ── Xay xát ────────────────────────────────────────────────────────────
  MillingOrder: [
    "milling-orders",
    "milling-order-options",
    "sales-orders",
    "paddy-lots",
    ...INVENTORY_VIEWS,
    ...DASHBOARD,
    ...REPORTS,
  ],
  MillingOrderInput: ["milling-orders", "paddy-lots", ...INVENTORY_VIEWS, ...REPORTS],
  MillingOrderOutput: ["milling-orders", "paddy-lots", ...INVENTORY_VIEWS, ...REPORTS],

  // ── Trả hàng ───────────────────────────────────────────────────────────
  CustomerReturnOrder: ["customer-returns", "customer-return", "party-debts", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  CustomerReturnOrderItem: ["customer-returns", "customer-return", ...INVENTORY_VIEWS, ...REPORTS],
  ReturnToSupplierOrder: ["party-debts", ...INVENTORY_VIEWS, ...DASHBOARD, ...REPORTS],
  ReturnToSupplierOrderItem: [...INVENTORY_VIEWS, ...REPORTS],

  // ── Công nợ ────────────────────────────────────────────────────────────
  PartyDebt: ["party-debts", ...DASHBOARD, ...REPORTS],
  DebtTransaction: ["party-debts", ...DASHBOARD, ...REPORTS],

  // ── Cấu hình & cảnh báo ────────────────────────────────────────────────
  Alert: ["alerts", "alerts-summary", ...DASHBOARD, ...REPORTS],
  StockAlertConfig: ["stock-alert-configs", "stock-alert-config-detail", "alerts", "alerts-summary"],
  MillingYieldConfig: ["milling-yield-configs", "milling-yield-config-detail", "yield-configs", "milling-orders"],
  SystemConfig: ["system-configs"],
  // Không map IotDevice: tầng IoT đã bị gỡ khỏi backend (cân đổi sang BLE nối
  // thẳng app) nên server không bao giờ phát entity này nữa.

  // ── Thông báo ──────────────────────────────────────────────────────────
  Notification: NOTIFICATION_VIEWS,
  UserNotification: NOTIFICATION_VIEWS,
  NotificationCategory: [
    "notification-categories",
    "notification-category-detail",
    "notification-category-options",
  ],
  NotificationType: ["notification-types", "notification-type-detail"],

  // ── Bảng trạng thái (màn quản trị trạng thái) ──────────────────────────
  InboundOrderStatus: ["inbound-order-status", "inbound-order-status-detail", "inbound-orders"],
  OutboundOrderStatus: ["outbound-order-status", "outbound-order-status-detail", "outbound-orders"],
  SalesOrderStatus: ["sales-order-status", "sales-order-status-detail", "sales-orders"],
  PurchaseOrderStatus: ["purchase-order-status", "purchase-order-status-detail"],
  StockTakeStatus: ["stock-take-status", "stock-take-status-detail", "stock-takes"],
  StockTransferStatus: ["stock-transfer-status", "stock-transfer-status-detail", "stock-transfers"],
  MillingOrderStatus: ["milling-order-status", "milling-order-status-detail", "milling-orders"],
  CustomerReturnOrderStatus: [
    "customer-return-order-status",
    "customer-return-order-status-detail",
    "customer-returns",
  ],
  ReturnToSupplierOrderStatus: [
    "return-to-supplier-order-status",
    "return-to-supplier-order-status-detail",
  ],
  PaddyPurchaseScheduleStatus: [
    "paddy-purchase-schedule-status",
    "paddy-purchase-schedule-status-detail",
    "rice-purchase",
  ],
  LotStatus: ["lot-status", "lot-status-detail", "paddy-lots"],

  // ── Nhật ký ────────────────────────────────────────────────────────────
  AuditLog: ["audit-log", "audit-log-detail", "audit-log-actions", "audit-log-entities"],
  ActivityLog: ["activity-log"],
};

/**
 * Các entity khi thay đổi có thể ảnh hưởng PHÂN QUYỀN của user đang đăng nhập.
 * Khi nhận được -> nạp lại phiên (permissions + menus) vào bộ nhớ để guard/route
 * và directive [appHasPerm] tự cập nhật ngay, không cần tải lại trang.
 */
const PERMISSION_AFFECTING = new Set<string>([
  "Role",
  "Permission",
  "UserRole",
  "Menu",
  "Action",
]);

@Injectable({ providedIn: "root" })
export class RealtimeService {
  private queryClient = injectQueryClient();
  private auth = inject(AuthService);

  private connection?: signalR.HubConnection;
  private started = false;

  private pendingKeys = new Set<string>();
  private pendingEntities = new Set<string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionReloadTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly entitiesChanged$ = new Subject<Set<string>>();

  /**
   * Luồng tên entity vừa thay đổi (đã gom nhiều sự kiện liên tiếp).
   *
   * Dành cho các màn KHÔNG dùng TanStack Query (tự quản lý state bằng signal)
   * nên không được invalidateQueries đánh thức — ví dụ màn Công nợ.
   * Màn dùng TanStack Query không cần đăng ký: đã tự refetch qua REALTIME_MAP.
   */
  readonly changes = this.entitiesChanged$.asObservable();

  /**
   * Đăng ký reload khi một trong các entity quan tâm thay đổi.
   * Trả về Subscription để component tự hủy trong ngOnDestroy.
   */
  onEntities(entityNames: string[], reload: () => void) {
    const watched = new Set(entityNames);
    return this.changes.subscribe((changed) => {
      for (const name of changed) {
        if (watched.has(name)) {
          reload();
          return;
        }
      }
    });
  }

  /** Mở kết nối realtime (gọi 1 lần sau khi đăng nhập). */
  start(): void {
    if (this.started) return;
    this.started = true;

    // baseUrl dạng .../api/v1 -> hub nằm ở gốc host: .../hubs/data-change
    const hubUrl =
      environment.baseUrl.replace(/\/api\/v\d+\/?$/, "") + "/hubs/data-change";

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => this.auth.getToken() ?? "",
        // Xác thực bằng token (không dùng cookie) -> tắt credentials để tránh
        // lỗi CORS "Cannot use wildcard in Access-Control-Allow-Origin when
        // credentials flag is true" (server đang trả Allow-Origin: *).
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on("EntityChanged", (names: string[]) =>
      this.onEntitiesChanged(names),
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
    this.pendingEntities.clear();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.sessionReloadTimer) {
      clearTimeout(this.sessionReloadTimer);
      this.sessionReloadTimer = null;
    }
  }

  private onEntitiesChanged(names: string[]): void {
    if (!Array.isArray(names)) return;

    for (const name of names) {
      this.pendingEntities.add(name);
      (REALTIME_MAP[name] ?? []).forEach((k) => this.pendingKeys.add(k));
    }

    // Nếu có thay đổi ảnh hưởng phân quyền -> nạp lại phiên (permissions + menus)
    // để guard/route + directive [appHasPerm] tự cập nhật cho MỌI phiên đang mở.
    // "User" cũng nạp lại phiên để thông tin cá nhân (tên/avatar trên topbar,
    // sidebar) tự cập nhật khi hồ sơ bị sửa ở nơi khác (vd mobile), không cần reload.
    if (names.some((n) => PERMISSION_AFFECTING.has(n)) || names.includes("User")) {
      this.scheduleSessionReload();
    }

    if (this.pendingKeys.size === 0 && this.pendingEntities.size === 0) return;

    // Gom nhiều sự kiện liên tiếp (vd import nhiều dòng) -> chỉ refetch 1 lần.
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flush(), 300);
  }

  /** Debounce nạp lại phiên (tránh gọi nhiều lần khi có chùm sự kiện). */
  private scheduleSessionReload(): void {
    if (!this.auth.getToken()) return;
    if (this.sessionReloadTimer) clearTimeout(this.sessionReloadTimer);
    this.sessionReloadTimer = setTimeout(() => {
      this.sessionReloadTimer = null;
      this.auth.loadSession().subscribe();
    }, 300);
  }

  private flush(): void {
    const keys = Array.from(this.pendingKeys);
    const entities = new Set(this.pendingEntities);
    this.pendingKeys.clear();
    this.pendingEntities.clear();
    this.debounceTimer = null;

    // invalidateQueries chỉ refetch query đang active (màn đang mở) -> tiết kiệm.
    for (const key of keys) {
      this.queryClient.invalidateQueries({ queryKey: [key] });
    }

    // Báo cho các màn tự quản lý state (không dùng TanStack Query) tải lại.
    if (entities.size > 0) this.entitiesChanged$.next(entities);
  }
}
