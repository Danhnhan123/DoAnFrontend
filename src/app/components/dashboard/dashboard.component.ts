import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FilterSelectComponent,
  FilterSelectOption,
} from '../shared/filter-select.component';

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
interface ChartDay {
  label: string;
  volume: number; // tấn (cột xanh)
  price: number; // đ/kg (cột cam)
}
interface PerfItem {
  label: string;
  percent: number;
  sub: string;
  color: PerfColor;
}
interface PeriodStats {
  stats: StatCard[];
  chart: ChartDay[];
  chartTitle: string;
}
interface WarehouseData {
  tasks: TaskItem[];
  alerts: AlertItem[];
  perf: PerfItem[];
  today: PeriodStats;
  month: PeriodStats;
  year: PeriodStats;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FilterSelectComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  /** Danh sách kho (mockup — chưa gắn API). */
  readonly warehouses: FilterSelectOption[] = [
    { id: 1, name: 'Kho chứa 1 — Hà Nội' },
    { id: 2, name: 'Kho chứa 2 — Cần Thơ' },
    { id: 3, name: 'Kho chứa 3 — An Giang' },
  ];
  selectedWarehouse = signal<number>(1);

  /** Mốc thời gian lọc thống kê tổng quan. */
  readonly periods = [
    { id: 'today', name: 'Hôm nay' },
    { id: 'month', name: 'Tháng này' },
    { id: 'year', name: 'Năm nay' },
  ] as const;
  period = signal<Period>('today');

  private readonly weekdays = [
    'Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy',
  ];

  warehouseName = computed(
    () =>
      this.warehouses.find((w) => w.id === this.selectedWarehouse())?.name ?? ''
  );

  warehouse = computed<WarehouseData>(
    () => this.DATA[this.selectedWarehouse()] ?? this.DATA[1]
  );

  /** Bộ thống kê + biểu đồ theo mốc thời gian đang chọn. */
  periodData = computed<PeriodStats>(() => this.warehouse()[this.period()]);

  /** Nhãn ngày/tháng/năm — lấy theo ngày thực tế hiện tại. */
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

  /** Chiều cao cột (%) chuẩn hoá theo giá trị lớn nhất của từng chuỗi. */
  chartBars = computed(() => {
    const days = this.periodData().chart;
    const maxVol = Math.max(...days.map((d) => d.volume), 1);
    const maxPrice = Math.max(...days.map((d) => d.price), 1);
    return days.map((d) => ({
      label: d.label,
      volPct: Math.round((d.volume / maxVol) * 100),
      pricePct: Math.round((d.price / maxPrice) * 100),
    }));
  });

  setWarehouse(id: number): void {
    if (id != null) this.selectedWarehouse.set(id);
  }
  setPeriod(id: Period): void {
    this.period.set(id);
  }

  // ── Dữ liệu mockup theo từng kho ─────────────────────────────────────────
  private readonly DATA: Record<number, WarehouseData> = {
    1: {
      tasks: [
        { time: '08:00', title: 'Thu mua lúa - Nguyễn Văn An', sub: 'ấp 3, xã Phú Hưng · ~5 tấn lúa IR50404', status: 'confirmed', icon: 'buy' },
        { time: '09:30', title: 'Thu mua lúa - Trần Thị Bé', sub: 'ấp 7, xã An Lạc Thôn · ~3.5 tấn lúa OM5451', status: 'pending', icon: 'buy' },
        { time: '14:00', title: 'Giao hàng - ĐB-2026-045', sub: 'Công ty TNHH Phú Thịnh · 2 tấn gạo 5kg', status: 'confirmed', icon: 'ship' },
        { time: '15:30', title: 'Giao lẻ - 12 bao cần chuẩn bị', sub: 'Gạo thơm 2kg x8, Gạo ST25 5kg x4', status: 'pending', icon: 'retail' },
        { time: '16:30', title: 'Kiểm tra lô lúa LT-2026-012', sub: 'Độ ẩm, tạp chất, vị trí cột lúa trong kho', status: 'pending', icon: 'check' },
      ],
      alerts: [
        { level: 'warn', text: 'Lô LT-2026-012 (lúa IR50404): độ ẩm 16.2% > ngưỡng 15%', time: '30p trước' },
        { level: 'danger', text: 'Tồn gạo ST25 còn 450kg — dưới mức tối thiểu (500kg)', time: '1h trước' },
        { level: 'warn', text: 'Công nợ khách Phú Thịnh: 18tr quá hạn 15 ngày', time: 'Hôm nay' },
      ],
      perf: [
        { label: 'Tỷ lệ giao đúng', percent: 94.2, sub: 'Mục tiêu 95%', color: 'amber' },
        { label: 'Đơn giao đúng hạn', percent: 94.2, sub: '7 ngày gần nhất', color: 'green' },
        { label: 'Thu hồi công nợ', percent: 76.3, sub: 'Tháng này', color: 'blue' },
        { label: 'Hao hụt kho', percent: 0.8, sub: 'Dưới ngưỡng 1%', color: 'green' },
      ],
      today: {
        chartTitle: 'Thu mua lúa 7 ngày',
        stats: [
          { label: 'Tồn lúa', value: '124.5 tấn', change: '+8.2t hôm nay', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '43.8 tấn', change: '-2.1t hôm nay', changeType: 'down', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '7 đơn', change: '3 cần xử lý', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '42.5 tr', change: 'Phải thu: 18tr', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'T2', volume: 12, price: 9 }, { label: 'T3', volume: 9, price: 13 },
          { label: 'T4', volume: 16, price: 8 }, { label: 'T5', volume: 10, price: 14 },
          { label: 'T6', volume: 11, price: 12 }, { label: 'T7', volume: 20, price: 15 },
          { label: 'CN', volume: 1.5, price: 1 },
        ],
      },
      month: {
        chartTitle: 'Thu mua lúa theo tuần',
        stats: [
          { label: 'Tồn lúa', value: '138.6 tấn', change: '+182t nhập tháng này', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '51.4 tấn', change: '+96t xuất tháng này', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '156 đơn', change: '18 chờ xử lý', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '51.8 tr', change: 'Thu hồi 320tr', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'Tuần 1', volume: 42, price: 11 }, { label: 'Tuần 2', volume: 55, price: 12 },
          { label: 'Tuần 3', volume: 38, price: 10 }, { label: 'Tuần 4', volume: 47, price: 13 },
        ],
      },
      year: {
        chartTitle: 'Thu mua lúa 12 tháng',
        stats: [
          { label: 'Tồn lúa', value: '152.3 tấn', change: '+2.150t nhập năm nay', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '60.2 tấn', change: '+1.180t xuất năm nay', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '1.842 đơn', change: 'Đã giao 1.786', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '64.0 tr', change: 'Thu hồi 3,9 tỷ', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'T1', volume: 120, price: 10 }, { label: 'T2', volume: 140, price: 11 },
          { label: 'T3', volume: 160, price: 12 }, { label: 'T4', volume: 180, price: 11 },
          { label: 'T5', volume: 175, price: 13 }, { label: 'T6', volume: 190, price: 12 },
          { label: 'T7', volume: 182, price: 14 }, { label: 'T8', volume: 168, price: 13 },
          { label: 'T9', volume: 155, price: 12 }, { label: 'T10', volume: 175, price: 11 },
          { label: 'T11', volume: 188, price: 12 }, { label: 'T12', volume: 205, price: 14 },
        ],
      },
    },
    2: {
      tasks: [
        { time: '07:30', title: 'Thu mua lúa - HTX Tân Phú', sub: 'ấp Tân Lộc · ~18 tấn lúa Đài Thơm 8', status: 'confirmed', icon: 'buy' },
        { time: '10:00', title: 'Thu mua lúa - Lê Văn Cường', sub: 'xã Thới Thạnh · ~7 tấn lúa OM18', status: 'pending', icon: 'buy' },
        { time: '13:00', title: 'Giao hàng - ĐB-2026-051', sub: 'Siêu thị Miền Tây · 5 tấn gạo 10kg', status: 'confirmed', icon: 'ship' },
        { time: '15:00', title: 'Giao lẻ - 24 bao cần chuẩn bị', sub: 'Gạo Đài Thơm 5kg x16, ST25 5kg x8', status: 'pending', icon: 'retail' },
        { time: '17:00', title: 'Kiểm tra lô lúa CT-2026-034', sub: 'Độ ẩm, tạp chất, phân loại nhập kho', status: 'pending', icon: 'check' },
      ],
      alerts: [
        { level: 'danger', text: 'Lô CT-2026-034 (lúa OM18): độ ẩm 17.8% > ngưỡng 15%', time: '15p trước' },
        { level: 'warn', text: 'Đơn ĐB-2026-051 sắp tới hạn giao trong 2 giờ', time: '45p trước' },
      ],
      perf: [
        { label: 'Tỷ lệ giao đúng', percent: 96.1, sub: 'Mục tiêu 95%', color: 'green' },
        { label: 'Đơn giao đúng hạn', percent: 91.5, sub: '7 ngày gần nhất', color: 'amber' },
        { label: 'Thu hồi công nợ', percent: 82.0, sub: 'Tháng này', color: 'blue' },
        { label: 'Hao hụt kho', percent: 1.2, sub: 'Trên ngưỡng 1%', color: 'amber' },
      ],
      today: {
        chartTitle: 'Thu mua lúa 7 ngày',
        stats: [
          { label: 'Tồn lúa', value: '208.3 tấn', change: '+12.5t hôm nay', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '67.2 tấn', change: '+3.4t hôm nay', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '12 đơn', change: '5 cần xử lý', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '65.8 tr', change: 'Phải thu: 30tr', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'T2', volume: 22, price: 12 }, { label: 'T3', volume: 18, price: 15 },
          { label: 'T4', volume: 25, price: 11 }, { label: 'T5', volume: 20, price: 16 },
          { label: 'T6', volume: 24, price: 14 }, { label: 'T7', volume: 30, price: 18 },
          { label: 'CN', volume: 4, price: 3 },
        ],
      },
      month: {
        chartTitle: 'Thu mua lúa theo tuần',
        stats: [
          { label: 'Tồn lúa', value: '221.0 tấn', change: '+325t nhập tháng này', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '74.5 tấn', change: '+152t xuất tháng này', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '264 đơn', change: '32 chờ xử lý', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '78.2 tr', change: 'Thu hồi 540tr', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'Tuần 1', volume: 78, price: 13 }, { label: 'Tuần 2', volume: 92, price: 14 },
          { label: 'Tuần 3', volume: 70, price: 12 }, { label: 'Tuần 4', volume: 85, price: 15 },
        ],
      },
      year: {
        chartTitle: 'Thu mua lúa 12 tháng',
        stats: [
          { label: 'Tồn lúa', value: '236.7 tấn', change: '+3.180t nhập năm nay', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '82.0 tấn', change: '+1.860t xuất năm nay', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '3.120 đơn', change: 'Đã giao 3.056', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '95.5 tr', change: 'Thu hồi 6,4 tỷ', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'T1', volume: 210, price: 12 }, { label: 'T2', volume: 230, price: 13 },
          { label: 'T3', volume: 255, price: 14 }, { label: 'T4', volume: 240, price: 13 },
          { label: 'T5', volume: 268, price: 15 }, { label: 'T6', volume: 290, price: 14 },
          { label: 'T7', volume: 300, price: 16 }, { label: 'T8', volume: 278, price: 15 },
          { label: 'T9', volume: 255, price: 13 }, { label: 'T10', volume: 275, price: 14 },
          { label: 'T11', volume: 288, price: 15 }, { label: 'T12', volume: 320, price: 17 },
        ],
      },
    },
    3: {
      tasks: [
        { time: '08:15', title: 'Thu mua lúa - Phạm Thị Hoa', sub: 'ấp Bình Thành · ~4 tấn lúa Jasmine 85', status: 'confirmed', icon: 'buy' },
        { time: '11:00', title: 'Giao hàng - ĐB-2026-060', sub: 'Đại lý Ba Chúc · 1.5 tấn gạo 5kg', status: 'pending', icon: 'ship' },
        { time: '14:30', title: 'Giao lẻ - 8 bao cần chuẩn bị', sub: 'Gạo Jasmine 5kg x8', status: 'confirmed', icon: 'retail' },
        { time: '16:00', title: 'Kiểm tra lô lúa AG-2026-018', sub: 'Độ ẩm, tạp chất, vị trí cột lúa trong kho', status: 'pending', icon: 'check' },
      ],
      alerts: [
        { level: 'warn', text: 'Tồn lúa Jasmine 85 giảm 4.3 tấn so với hôm qua', time: '2h trước' },
      ],
      perf: [
        { label: 'Tỷ lệ giao đúng', percent: 92.8, sub: 'Mục tiêu 95%', color: 'amber' },
        { label: 'Đơn giao đúng hạn', percent: 95.0, sub: '7 ngày gần nhất', color: 'green' },
        { label: 'Thu hồi công nợ', percent: 70.5, sub: 'Tháng này', color: 'blue' },
        { label: 'Hao hụt kho', percent: 0.5, sub: 'Dưới ngưỡng 1%', color: 'green' },
      ],
      today: {
        chartTitle: 'Thu mua lúa 7 ngày',
        stats: [
          { label: 'Tồn lúa', value: '89.6 tấn', change: '-4.3t hôm nay', changeType: 'down', icon: 'leaf' },
          { label: 'Tồn gạo', value: '25.1 tấn', change: '+1.2t hôm nay', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '4 đơn', change: '1 cần xử lý', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '21.0 tr', change: 'Phải thu: 6tr', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'T2', volume: 8, price: 10 }, { label: 'T3', volume: 6, price: 8 },
          { label: 'T4', volume: 9, price: 12 }, { label: 'T5', volume: 5, price: 9 },
          { label: 'T6', volume: 7, price: 11 }, { label: 'T7', volume: 11, price: 13 },
          { label: 'CN', volume: 1, price: 1 },
        ],
      },
      month: {
        chartTitle: 'Thu mua lúa theo tuần',
        stats: [
          { label: 'Tồn lúa', value: '96.2 tấn', change: '+118t nhập tháng này', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '29.8 tấn', change: '+64t xuất tháng này', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '92 đơn', change: '11 chờ xử lý', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '27.4 tr', change: 'Thu hồi 180tr', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'Tuần 1', volume: 28, price: 9 }, { label: 'Tuần 2', volume: 34, price: 10 },
          { label: 'Tuần 3', volume: 22, price: 8 }, { label: 'Tuần 4', volume: 30, price: 11 },
        ],
      },
      year: {
        chartTitle: 'Thu mua lúa 12 tháng',
        stats: [
          { label: 'Tồn lúa', value: '104.5 tấn', change: '+1.240t nhập năm nay', changeType: 'up', icon: 'leaf' },
          { label: 'Tồn gạo', value: '34.0 tấn', change: '+720t xuất năm nay', changeType: 'up', icon: 'rice' },
          { label: 'Đơn chờ giao', value: '1.080 đơn', change: 'Đã giao 1.058', changeType: 'neutral', icon: 'truck' },
          { label: 'Công nợ', value: '33.2 tr', change: 'Thu hồi 2,1 tỷ', changeType: 'up', icon: 'coins' },
        ],
        chart: [
          { label: 'T1', volume: 60, price: 8 }, { label: 'T2', volume: 72, price: 9 },
          { label: 'T3', volume: 89, price: 10 }, { label: 'T4', volume: 75, price: 9 },
          { label: 'T5', volume: 82, price: 11 }, { label: 'T6', volume: 95, price: 10 },
          { label: 'T7', volume: 88, price: 12 }, { label: 'T8', volume: 80, price: 11 },
          { label: 'T9', volume: 70, price: 9 }, { label: 'T10', volume: 84, price: 10 },
          { label: 'T11', volume: 92, price: 11 }, { label: 'T12', volume: 110, price: 13 },
        ],
      },
    },
  };
}
