import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';
import { DashboardService } from '../../services/dashboard.service';
import { WarehouseService } from '../../services/warehouse.service';
import {
  DashboardSummary,
  DashboardTask,
  DashboardChartPoint,
  DashboardAlertItem,
  DashboardEfficiencyMetrics,
} from '../../models';

type StatIcon = 'leaf' | 'rice' | 'truck' | 'coins';
type TaskIcon = 'buy' | 'ship' | 'retail' | 'check';
type TaskStatus = 'confirmed' | 'pending';
type AlertLevel = 'warn' | 'danger';
type PerfColor = 'green' | 'amber' | 'blue';
type Period = 'today' | 'month' | 'year';

interface StatCard {
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'down' | 'neutral';
  icon: StatIcon;
}
interface TaskItem {
  time: string;
  title: string;
  sub: string;
  status: TaskStatus;
  icon: TaskIcon;
}
interface AlertItem {
  level: AlertLevel;
  text: string;
  time: string;
}
interface PerfItem {
  label: string;
  percent: number;
  sub: string;
  color: PerfColor;
}

/**
 * Màn "Tổng quan vận hành" — gắn API dashboard thật.
 * - Dropdown kho: lấy từ WarehouseService (kèm mục "Tất cả kho" = null).
 * - Mốc thời gian (Hôm nay/Tháng/Năm): đổi date-range cho thẻ thống kê + hiệu quả,
 *   và đổi period cho biểu đồ thu mua (7 ngày / 4 tuần / 12 tháng).
 * Dữ liệu lấy qua TanStack Query, tự refetch khi đổi kho hoặc mốc thời gian.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FilterSelectComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly warehouseService = inject(WarehouseService);

  /** null = tất cả kho. */
  selectedWarehouse = signal<number | null>(null);

  readonly periods = [
    { id: 'today', name: 'Hôm nay' },
    { id: 'month', name: 'Tháng này' },
    { id: 'year', name: 'Năm nay' },
  ] as const;
  period = signal<Period>('today');

  // ── Phân trang cho 2 panel giữa ───────────────────────────────────────────
  readonly taskPageSize = 6;
  readonly alertPageSize = 5;
  taskPage = signal(1);
  alertPage = signal(1);

  private readonly weekdays = [
    'Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy',
  ];

  // ── Khoảng thời gian theo mốc đang chọn (gửi lên summary/efficiency) ──────
  private dateRange = computed(() => {
    const now = new Date();
    const end = this.toIso(now);
    let start: Date;
    switch (this.period()) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    return { fromDate: this.toIso(start), toDate: end };
  });

  // ========== TanStack Queries ==========

  private warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouse-options'],
    queryFn: () => lastValueFrom(this.warehouseService.getAll()),
    staleTime: 60_000,
  }));

  private summaryQuery = injectQuery(() => ({
    queryKey: ['dashboard-summary', this.selectedWarehouse(), this.period()],
    queryFn: () =>
      lastValueFrom(
        this.dashboardService.getSummary({
          warehouseId: this.selectedWarehouse(),
          fromDate: this.dateRange().fromDate,
          toDate: this.dateRange().toDate,
        })
      ),
  }));

  private tasksQuery = injectQuery(() => ({
    queryKey: ['dashboard-tasks', this.selectedWarehouse()],
    queryFn: () =>
      lastValueFrom(
        this.dashboardService.getTodayTasks({
          warehouseId: this.selectedWarehouse(),
        })
      ),
  }));

  private chartQuery = injectQuery(() => ({
    queryKey: ['dashboard-chart', this.selectedWarehouse(), this.period()],
    queryFn: () =>
      lastValueFrom(
        this.dashboardService.getPurchaseChart({
          warehouseId: this.selectedWarehouse(),
          period: this.period(),
        })
      ),
  }));

  private alertsQuery = injectQuery(() => ({
    queryKey: ['dashboard-alerts', this.selectedWarehouse()],
    queryFn: () =>
      lastValueFrom(
        this.dashboardService.getRecentAlerts({
          warehouseId: this.selectedWarehouse(),
        })
      ),
  }));

  // ========== Dữ liệu suy ra từ query ==========

  warehouses = computed<FilterSelectOption[]>(() =>
    ((this.warehousesQuery.data() as any)?.resources ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
    }))
  );

  warehouseName = computed(() => {
    const id = this.selectedWarehouse();
    if (id == null) return 'Tất cả kho';
    return this.warehouses().find((w) => w.id === id)?.name ?? '';
  });

  private summary = computed<DashboardSummary | null>(
    () => (this.summaryQuery.data() as any)?.resources ?? null
  );

  loading = computed(
    () =>
      this.summaryQuery.isPending() ||
      this.chartQuery.isPending() ||
      this.tasksQuery.isPending()
  );
  errorMsg = computed(() =>
    this.summaryQuery.isError() ? 'Không tải được dữ liệu tổng quan.' : null
  );

  /** Tiêu đề biểu đồ theo mốc. */
  chartTitle = computed(() => {
    switch (this.period()) {
      case 'month':
        return 'Thu mua lúa theo tuần';
      case 'year':
        return 'Thu mua lúa 12 tháng';
      default:
        return 'Thu mua lúa 7 ngày';
    }
  });

  dateLabel = computed(() => {
    const now = new Date();
    switch (this.period()) {
      case 'today': {
        const wd = this.weekdays[now.getDay()];
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        return `${wd}, ${dd}/${mm}/${now.getFullYear()}`;
      }
      case 'month':
        return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
      default:
        return `Năm ${now.getFullYear()}`;
    }
  });

  // ── Thẻ thống kê ──────────────────────────────────────────────────────────
  stats = computed<StatCard[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const inv = s.inventory;
    const sales = s.sales;
    const debt = s.debt;
    return [
      {
        label: 'Tồn lúa',
        value: this.fmtTons(inv.paddyKg),
        change: this.deltaText(inv.paddyDeltaTodayKg),
        changeType: this.deltaType(inv.paddyDeltaTodayKg),
        icon: 'leaf',
      },
      {
        label: 'Tồn gạo',
        value: this.fmtTons(inv.riceKg),
        change: this.deltaText(inv.riceDeltaTodayKg),
        changeType: this.deltaType(inv.riceDeltaTodayKg),
        icon: 'rice',
      },
      {
        label: 'Đơn chờ giao',
        value: `${sales.pendingDeliveryCount} đơn`,
        change: `${sales.pendingDeliveryActionRequiredCount} cần xử lý`,
        changeType: 'neutral',
        icon: 'truck',
      },
      {
        label: 'Công nợ',
        value: this.fmtMillion(debt.totalDebt),
        change: `Phải thu: ${this.fmtMillion(debt.customerReceivable)}`,
        changeType: debt.overdueReceivable > 0 ? 'up' : 'neutral',
        icon: 'coins',
      },
    ];
  });

  // ── Công việc hôm nay ─────────────────────────────────────────────────────
  tasks = computed<TaskItem[]>(() =>
    ((this.tasksQuery.data() as any)?.resources ?? []).map(
      (t: DashboardTask) => ({
        time: t.time,
        title: t.title,
        sub: t.description,
        status: t.status === 'Đã xác nhận' ? 'confirmed' : 'pending',
        icon: this.taskIcon(t.type),
      })
    )
  );

  // ── Cảnh báo gần nhất ─────────────────────────────────────────────────────
  alerts = computed<AlertItem[]>(() =>
    ((this.alertsQuery.data() as any)?.resources ?? []).map(
      (a: DashboardAlertItem) => ({
        level:
          (a.severity || '').toLowerCase() === 'critical' ? 'danger' : 'warn',
        text: a.message,
        time: a.timeAgo,
      })
    )
  );

  // ── Phân trang công việc / cảnh báo ───────────────────────────────────────
  taskTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.tasks().length / this.taskPageSize))
  );
  /** Trang hiện tại đã kẹp trong [1, tổng trang] (phòng khi dữ liệu co lại). */
  taskPageSafe = computed(() => Math.min(this.taskPage(), this.taskTotalPages()));
  pagedTasks = computed<TaskItem[]>(() => {
    const start = (this.taskPageSafe() - 1) * this.taskPageSize;
    return this.tasks().slice(start, start + this.taskPageSize);
  });

  alertTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.alerts().length / this.alertPageSize))
  );
  alertPageSafe = computed(() =>
    Math.min(this.alertPage(), this.alertTotalPages())
  );
  pagedAlerts = computed<AlertItem[]>(() => {
    const start = (this.alertPageSafe() - 1) * this.alertPageSize;
    return this.alerts().slice(start, start + this.alertPageSize);
  });

  // ── Hiệu quả vận hành ─────────────────────────────────────────────────────
  perf = computed<PerfItem[]>(() => {
    const e: DashboardEfficiencyMetrics | undefined = this.summary()?.efficiency;
    if (!e) return [];
    return [
      {
        label: 'Tỷ lệ giao đúng hạn',
        percent: e.onTimeDeliveryRate,
        sub: `Mục tiêu ${e.onTimeDeliveryTarget}%`,
        color: e.onTimeDeliveryRate >= e.onTimeDeliveryTarget ? 'green' : 'amber',
      },
      {
        label: 'Thu hồi công nợ',
        percent: e.debtRecoveryRate,
        sub: 'Kỳ hiện tại',
        color: 'blue',
      },
      {
        label: 'Hao hụt kho',
        percent: e.warehouseLossRate,
        sub: `Ngưỡng ${e.warehouseLossTarget}%`,
        color: e.warehouseLossRate <= e.warehouseLossTarget ? 'green' : 'amber',
      },
    ];
  });

  // ── Cột biểu đồ (chuẩn hoá % theo giá trị lớn nhất) ───────────────────────
  chartBars = computed(() => {
    const points: DashboardChartPoint[] =
      (this.chartQuery.data() as any)?.resources ?? [];
    const maxVol = Math.max(...points.map((d) => d.volumeTons), 1);
    const maxPrice = Math.max(...points.map((d) => d.averagePrice), 1);
    return points.map((d) => {
      const volLabel = this.fmtNumber(d.volumeTons);
      const priceLabel = this.fmtNumber(d.averagePrice, 0);
      return {
        label: d.dayOfWeek,
        volPct: Math.round((d.volumeTons / maxVol) * 90),
        pricePct: Math.round((d.averagePrice / maxPrice) * 90),
        volLabel,
        priceLabel,
        tip: `${d.dayOfWeek} — Sản lượng: ${volLabel} tấn · Giá TB: ${priceLabel} đ/kg`,
      };
    });
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  setWarehouse(id: number | null): void {
    this.selectedWarehouse.set(id ?? null);
    this.taskPage.set(1);
    this.alertPage.set(1);
  }
  setPeriod(id: Period): void {
    this.period.set(id);
  }

  setTaskPage(p: number): void {
    this.taskPage.set(Math.min(Math.max(1, p), this.taskTotalPages()));
  }
  setAlertPage(p: number): void {
    this.alertPage.set(Math.min(Math.max(1, p), this.alertTotalPages()));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private toIso(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private fmtNumber(n: number, digits = 1): string {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }).format(n);
  }

  private fmtTons(kg: number): string {
    return `${this.fmtNumber((kg ?? 0) / 1000)} tấn`;
  }

  private fmtMillion(v: number): string {
    return `${this.fmtNumber((v ?? 0) / 1_000_000)} tr`;
  }

  private deltaText(kg: number): string {
    const t = (kg ?? 0) / 1000;
    if (Math.abs(t) < 0.001) return 'Không đổi hôm nay';
    const sign = t > 0 ? '+' : '−';
    return `${sign}${this.fmtNumber(Math.abs(t))}t hôm nay`;
  }

  private deltaType(kg: number): 'up' | 'down' | 'neutral' {
    if ((kg ?? 0) > 0) return 'up';
    if ((kg ?? 0) < 0) return 'down';
    return 'neutral';
  }

  private taskIcon(type: string): TaskIcon {
    switch (type) {
      case 'PURCHASE':
        return 'buy';
      case 'DELIVERY':
        return 'ship';
      case 'INSPECTION':
        return 'check';
      default:
        return 'retail';
    }
  }
}
