import { Routes } from "@angular/router";
import { authGuard, guestGuard, firstLoginGuard } from "./guards/auth.guard";
import { menuReadGuard } from "./guards/permission.guard";

const adminChildren: Routes = [
  {
    path: "",
    redirectTo: "dashboard",
    pathMatch: "full",
  },
  {
    path: "dashboard",
    loadComponent: () =>
      import("./components/dashboard/dashboard.component").then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: "reports",
    canMatch: [menuReadGuard],
    data: { menuCode: "REPORTS" },
    loadComponent: () =>
      import("./components/report/report.component").then(
        (m) => m.ReportComponent,
      ),
  },
  {
    path: "profile",
    loadComponent: () =>
      import("./components/profile/profile.component").then(
        (m) => m.ProfileComponent,
      ),
  },
  {
    path: "products",
    canMatch: [menuReadGuard],
    data: { menuCode: "PRODUCT" },
    loadComponent: () =>
      import("./components/product/product.component").then(
        (m) => m.ProductComponent,
      ),
  },
  {
    path: "users",
    canMatch: [menuReadGuard],
    data: { menuCode: "USER" },
    loadComponent: () =>
      import("./components/user/user.component").then((m) => m.UserComponent),
  },
  {
    path: "roles",
    canMatch: [menuReadGuard],
    data: { menuCode: "ROLE" },
    loadComponent: () =>
      import("./components/role/role.component").then((m) => m.RoleComponent),
  },
  {
    path: "menus",
    canMatch: [menuReadGuard],
    data: { menuCode: "MENU_LIST" },
    loadComponent: () =>
      import("./components/menu/menu.component").then((m) => m.MenuComponent),
  },
  {
    path: "system-config",
    canMatch: [menuReadGuard],
    data: { menuCode: "SYSTEM_SETTINGS" },
    loadComponent: () =>
      import("./components/system-config/system-config.component").then(
        (m) => m.SystemConfigComponent,
      ),
  },
  {
    path: "audit-log",
    canMatch: [menuReadGuard],
    data: { menuCode: "AUDIT_LOGS" },
    loadComponent: () =>
      import("./components/audit-log/audit-log.component").then(
        (m) => m.AuditLogComponent,
      ),
  },
  {
    path: "activity-log",
    canMatch: [menuReadGuard],
    data: { menuCode: "ACTIVITY_LOGS" },
    loadComponent: () =>
      import("./components/activity-log/activity-log.component").then(
        (m) => m.ActivityLogComponent,
      ),
  },
  {
    path: "user-device",
    canMatch: [menuReadGuard],
    data: { menuCode: "USER_DEVICE" },
    loadComponent: () =>
      import("./components/user-device/user-device.component").then(
        (m) => m.UserDeviceComponent,
      ),
  },
  {
    path: "user-verification-token",
    canMatch: [menuReadGuard],
    data: { menuCode: "USER_VERIFICATION_TOKEN" },
    loadComponent: () =>
      import(
        "./components/user-verification-token/user-verification-token.component"
      ).then((m) => m.UserVerificationTokenComponent),
  },
  {
    path: "actions",
    canMatch: [menuReadGuard],
    data: { menuCode: "ACTIONS" },
    loadComponent: () =>
      import("./components/action/action.component").then(
        (m) => m.ActionComponent,
      ),
  },
  {
    path: "user-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "USER_STATUS" },
    loadComponent: () =>
      import("./components/user-status/user-status.component").then(
        (m) => m.UserStatusComponent,
      ),
  },
  {
    path: "product-categories",
    canMatch: [menuReadGuard],
    data: { menuCode: "PRODUCT_CATEGORIES" },
    loadComponent: () =>
      import("./components/product-category/product-category.component").then(
        (m) => m.ProductCategoryComponent,
      ),
  },
  {
    path: "product-variants",
    canMatch: [menuReadGuard],
    data: { menuCode: "PRODUCT_VARIANTS" },
    loadComponent: () =>
      import("./components/product-variant/product-variant.component").then(
        (m) => m.ProductVariantComponent,
      ),
  },
  {
    path: "product-attributes",
    canMatch: [menuReadGuard],
    data: { menuCode: "PRODUCT_ATTRIBUTES" },
    loadComponent: () =>
      import("./components/product-attribute/product-attribute.component").then(
        (m) => m.ProductAttributeComponent,
      ),
  },
  {
    path: "inbound-orders",
    canMatch: [menuReadGuard],
    data: { menuCode: "INBOUND_ORDERS" },
    loadComponent: () =>
      import("./components/inbound-putaway/inbound-putaway.component").then(
        (m) => m.InboundPutawayComponent,
      ),
  },
  // Màn "Thiết bị IoT" đã ngưng sử dụng sau khi chuyển cân sang BLE (không còn Menu
  // trong DB nên không thể phân quyền theo menuCode). Bỏ route để mọi truy cập trực
  // tiếp /admin/iot-devices rơi vào 404 thay vì mở được cho mọi tài khoản đăng nhập.
  {
    path: "suppliers",
    canMatch: [menuReadGuard],
    data: { menuCode: "SUPPLIERS" },
    loadComponent: () =>
      import("./components/supplier/supplier.component").then(
        (m) => m.SupplierComponent,
      ),
  },
  {
    path: "rice-varieties",
    canMatch: [menuReadGuard],
    data: { menuCode: "RICE_VARIETIES" },
    loadComponent: () =>
      import("./components/rice-variety/rice-variety.component").then(
        (m) => m.RiceVarietyComponent,
      ),
  },
  {
    path: "farmers",
    canMatch: [menuReadGuard],
    data: { menuCode: "FARMERS" },
    loadComponent: () =>
      import("./components/farmer/farmer.component").then(
        (m) => m.FarmerComponent,
      ),
  },
  {
    path: "customers",
    canMatch: [menuReadGuard],
    data: { menuCode: "CUSTOMERS" },
    loadComponent: () =>
      import("./components/customer/customer.component").then(
        (m) => m.CustomerComponent,
      ),
  },
  {
    path: "organizations",
    canMatch: [menuReadGuard],
    data: { menuCode: "ORGANIZATIONS" },
    loadComponent: () =>
      import("./components/organization/organization.component").then(
        (m) => m.OrganizationComponent,
      ),
  },
  {
    path: "unit-of-measures",
    canMatch: [menuReadGuard],
    data: { menuCode: "UNIT_OF_MEASURES" },
    loadComponent: () =>
      import("./components/unit-of-measure/unit-of-measure.component").then(
        (m) => m.UnitOfMeasureComponent,
      ),
  },
  {
    path: "warehouses",
    canMatch: [menuReadGuard],
    data: { menuCode: "WAREHOUSES" },
    loadComponent: () =>
      import("./components/warehouse/warehouse.component").then(
        (m) => m.WarehouseComponent,
      ),
  },
  {
    // Vị trí lưu trữ đã gộp vào màn "Kho hàng" -> điều hướng về warehouses.
    path: "locations",
    redirectTo: "warehouses",
    pathMatch: "full",
  },
  {
    // Bản đồ khu/cột (sơ đồ mặt phẳng nhìn từ trên xuống của kho).
    path: "warehouse-map",
    canMatch: [menuReadGuard],
    data: { menuCode: "WAREHOUSE_MAP" },
    loadComponent: () =>
      import("./components/warehouse-map/warehouse-map.component").then(
        (m) => m.WarehouseMapComponent,
      ),
  },
  {
    path: "notifications",
    canMatch: [menuReadGuard],
    data: { menuCode: "NOTIFICATION" },
    loadComponent: () =>
      import("./components/notification/notification.component").then(
        (m) => m.NotificationComponent,
      ),
  },
  {
    path: "notification-categories",
    canMatch: [menuReadGuard],
    data: { menuCode: "NOTIFICATION_CATEGORY" },
    loadComponent: () =>
      import(
        "./components/notification-category/notification-category.component"
      ).then((m) => m.NotificationCategoryComponent),
  },
  {
    path: "notification-types",
    canMatch: [menuReadGuard],
    data: { menuCode: "NOTIFICATION_TYPE" },
    loadComponent: () =>
      import("./components/notification-type/notification-type.component").then(
        (m) => m.NotificationTypeComponent,
      ),
  },
  {
    path: "rice-purchase",
    canMatch: [menuReadGuard],
    data: { menuCode: "RICE_PURCHASE" },
    loadComponent: () =>
      import("./components/rice-purchase/rice-purchase.component").then(
        (m) => m.RicePurchaseComponent,
      ),
  },
  {
    path: "milling-yield-configs",
    canMatch: [menuReadGuard],
    data: { menuCode: "MILLING_YIELD_CONFIGS" },
    loadComponent: () =>
      import(
        "./components/milling-yield-config/milling-yield-config.component"
      ).then((m) => m.MillingYieldConfigComponent),
  },
  {
    path: "stock-alert-configs",
    canMatch: [menuReadGuard],
    data: { menuCode: "STOCK_ALERT_CONFIGS" },
    loadComponent: () =>
      import(
        "./components/stock-alert-config/stock-alert-config.component"
      ).then((m) => m.StockAlertConfigComponent),
  },
  {
    path: "alerts",
    canMatch: [menuReadGuard],
    data: { menuCode: "ALERTS" },
    loadComponent: () =>
      import("./components/alert/alert.component").then(
        (m) => m.AlertComponent,
      ),
  },
  {
    path: "inventory-monitoring",
    canMatch: [menuReadGuard],
    data: { menuCode: "INVENTORIES" },
    loadComponent: () =>
      import(
        "./components/inventory-monitoring/inventory-monitoring.component"
      ).then((m) => m.InventoryMonitoringComponent),
  },
  {
    path: "stock-takes",
    canMatch: [menuReadGuard],
    data: { menuCode: "STOCKTAKE" },
    loadComponent: () =>
      import("./components/stock-take/stock-take.component").then(
        (m) => m.StockTakeComponent,
      ),
  },
  {
    path: "stock-transfers",
    canMatch: [menuReadGuard],
    data: { menuCode: "STOCK_TRANSFERS" },
    loadComponent: () =>
      import("./components/stock-transfer/stock-transfer.component").then(
        (m) => m.StockTransferComponent,
      ),
  },
  {
    path: "customer-returns",
    canMatch: [menuReadGuard],
    data: { menuCode: "CUSTOMER_RETURNS" },
    loadComponent: () =>
      import("./components/customer-return/customer-return.component").then(
        (m) => m.CustomerReturnComponent,
      ),
  },
  {
    path: "paddy-lots",
    canMatch: [menuReadGuard],
    data: { menuCode: "PADDY_LOTS" },
    loadComponent: () =>
      import("./components/paddy-lot/paddy-lot.component").then(
        (m) => m.PaddyLotComponent,
      ),
  },
  {
    path: "qr-labels",
    canMatch: [menuReadGuard],
    data: { menuCode: "QR_LABELS" },
    loadComponent: () =>
      import("./components/qr-label/qr-label.component").then(
        (m) => m.QrLabelComponent,
      ),
  },
  {
    path: "milling-orders",
    canMatch: [menuReadGuard],
    data: { menuCode: "MILLING_ORDERS" },
    loadComponent: () =>
      import("./components/milling-order/milling-order.component").then(
        (m) => m.MillingOrderComponent,
      ),
  },
  {
    path: "quality-inspections",
    canMatch: [menuReadGuard],
    data: { menuCode: "QUALITY_INSPECTIONS" },
    loadComponent: () =>
      import(
        "./components/quality-inspection/quality-inspection.component"
      ).then((m) => m.QualityInspectionComponent),
  },
  {
    path: "sales-orders",
    canMatch: [menuReadGuard],
    data: { menuCode: "SALE_ORDERS" },
    loadComponent: () =>
      import("./components/sales-order/sales-order.component").then(
        (m) => m.SalesOrderComponent,
      ),
  },
  {
    path: "outbound-orders",
    canMatch: [menuReadGuard],
    data: { menuCode: "OUTBOUND_ORDERS" },
    loadComponent: () =>
      import("./components/outbound-order/outbound-order.component").then(
        (m) => m.OutboundOrderComponent,
      ),
  },
  {
    path: "party-debts",
    canMatch: [menuReadGuard],
    data: { menuCode: "DEBTS" },
    loadComponent: () =>
      import("./components/party-debt/party-debt.component").then(
        (m) => m.PartyDebtComponent,
      ),
  },
  // ── Các màn quản lý bảng trạng thái (lookup) ──
  {
    path: "inbound-order-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "INBOUND_ORDER_STATUS" },
    loadComponent: () =>
      import(
        "./components/inbound-order-status/inbound-order-status.component"
      ).then((m) => m.InboundOrderStatusComponent),
  },
  {
    path: "outbound-order-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "OUTBOUND_ORDER_STATUS" },
    loadComponent: () =>
      import(
        "./components/outbound-order-status/outbound-order-status.component"
      ).then((m) => m.OutboundOrderStatusComponent),
  },
  {
    path: "stock-take-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "STOCK_TAKE_STATUS" },
    loadComponent: () =>
      import("./components/stock-take-status/stock-take-status.component").then(
        (m) => m.StockTakeStatusComponent,
      ),
  },
  {
    path: "customer-return-order-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "CUSTOMER_RETURN_ORDER_STATUS" },
    loadComponent: () =>
      import(
        "./components/customer-return-order-status/customer-return-order-status.component"
      ).then((m) => m.CustomerReturnOrderStatusComponent),
  },
  {
    path: "return-to-supplier-order-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "RETURN_TO_SUPPLIER_ORDER_STATUS" },
    loadComponent: () =>
      import(
        "./components/return-to-supplier-order-status/return-to-supplier-order-status.component"
      ).then((m) => m.ReturnToSupplierOrderStatusComponent),
  },
  {
    path: "paddy-purchase-schedule-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "PADDY_PURCHASE_SCHEDULE_STATUS" },
    loadComponent: () =>
      import(
        "./components/paddy-purchase-schedule-status/paddy-purchase-schedule-status.component"
      ).then((m) => m.PaddyPurchaseScheduleStatusComponent),
  },
  {
    path: "lot-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "LOT_STATUS" },
    loadComponent: () =>
      import("./components/lot-status/lot-status.component").then(
        (m) => m.LotStatusComponent,
      ),
  },
  {
    path: "milling-order-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "MILLING_ORDER_STATUS" },
    loadComponent: () =>
      import(
        "./components/milling-order-status/milling-order-status.component"
      ).then((m) => m.MillingOrderStatusComponent),
  },
  {
    path: "stock-transfer-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "STOCK_TRANSFER_STATUS" },
    loadComponent: () =>
      import(
        "./components/stock-transfer-status/stock-transfer-status.component"
      ).then((m) => m.StockTransferStatusComponent),
  },
  {
    path: "sales-order-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "SALES_ORDER_STATUS" },
    loadComponent: () =>
      import(
        "./components/sales-order-status/sales-order-status.component"
      ).then((m) => m.SalesOrderStatusComponent),
  },
  {
    path: "purchase-order-status",
    canMatch: [menuReadGuard],
    data: { menuCode: "PURCHASE_ORDER_STATUS" },
    loadComponent: () =>
      import(
        "./components/purchase-order-status/purchase-order-status.component"
      ).then((m) => m.PurchaseOrderStatusComponent),
  },
  // 404 cho các đường dẫn con /admin/* không tồn tại hoặc không đủ quyền READ (giữ layout admin).
  // data.notFound = true -> layout ẩn tiêu đề/phụ đề màn, chỉ hiện nội dung 404.
  {
    path: "**",
    data: { notFound: true },
    loadComponent: () =>
      import("./components/not-found/not-found.component").then(
        (m) => m.NotFoundComponent,
      ),
  },
];

export const routes: Routes = [
  { path: "", redirectTo: "/admin/dashboard", pathMatch: "full" },
  {
    path: "login",
    canActivate: [guestGuard],
    loadComponent: () =>
      import("./components/login/login.component").then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: "quen-mat-khau",
    canActivate: [guestGuard],
    loadComponent: () =>
      import("./components/forgot-password/forgot-password.component").then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: "doi-mat-khau-lan-dau",
    canActivate: [firstLoginGuard],
    loadComponent: () =>
      import(
        "./components/change-password-first/change-password-first.component"
      ).then((m) => m.ChangePasswordFirstComponent),
  },
  {
    path: "",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./components/admin-layout/admin-layout.component").then(
        (m) => m.AdminLayoutComponent,
      ),
    children: [
      {
        path: "admin",
        children: adminChildren,
      },
    ],
  },
  // Mọi đường dẫn không khớp đều nhảy vào trang 404.
  {
    path: "**",
    loadComponent: () =>
      import("./components/not-found/not-found.component").then(
        (m) => m.NotFoundComponent,
      ),
  },
];
