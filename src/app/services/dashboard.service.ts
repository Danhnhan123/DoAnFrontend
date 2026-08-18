import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  DashboardSummary,
  DashboardTask,
  DashboardChartPoint,
  DashboardEfficiencyMetrics,
  DashboardAlertItem,
  DashboardQueryParams,
} from '../models';

/**
 * Dịch vụ cho màn "Tổng quan vận hành" (dashboard).
 * Gọi các endpoint dashboard của backend: summary / today-tasks / purchase-chart /
 * operational-efficiency / recent-alerts.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  private buildParams(p: DashboardQueryParams): HttpParams {
    let params = new HttpParams();
    if (p.fromDate) params = params.set('fromDate', p.fromDate);
    if (p.toDate) params = params.set('toDate', p.toDate);
    if (p.warehouseId != null) params = params.set('warehouseId', String(p.warehouseId));
    if (p.period) params = params.set('period', p.period);
    return params;
  }

  /** Tổng hợp: tồn kho, công nợ, xay xát, bán hàng, cảnh báo, hiệu quả. */
  getSummary(p: DashboardQueryParams): Observable<ApiResponse<DashboardSummary>> {
    return this.http.get<ApiResponse<DashboardSummary>>(
      `${this.base}/dashboard/summary`,
      { params: this.buildParams(p) }
    );
  }

  /** Lịch công việc hôm nay (thu mua / giao hàng / kiểm định). */
  getTodayTasks(p: DashboardQueryParams): Observable<ApiResponse<DashboardTask[]>> {
    return this.http.get<ApiResponse<DashboardTask[]>>(
      `${this.base}/dashboard/today-tasks`,
      { params: this.buildParams(p) }
    );
  }

  /** Biểu đồ thu mua lúa theo mốc thời gian (7 ngày / 4 tuần / 12 tháng). */
  getPurchaseChart(p: DashboardQueryParams): Observable<ApiResponse<DashboardChartPoint[]>> {
    return this.http.get<ApiResponse<DashboardChartPoint[]>>(
      `${this.base}/dashboard/purchase-chart`,
      { params: this.buildParams(p) }
    );
  }

  /** Chỉ số hiệu quả vận hành (giao đúng hạn / thu hồi công nợ / hao hụt kho). */
  getEfficiency(p: DashboardQueryParams): Observable<ApiResponse<DashboardEfficiencyMetrics>> {
    return this.http.get<ApiResponse<DashboardEfficiencyMetrics>>(
      `${this.base}/dashboard/operational-efficiency`,
      { params: this.buildParams(p) }
    );
  }

  /** 5 cảnh báo gần nhất đang mở. */
  getRecentAlerts(p: DashboardQueryParams): Observable<ApiResponse<DashboardAlertItem[]>> {
    return this.http.get<ApiResponse<DashboardAlertItem[]>>(
      `${this.base}/dashboard/recent-alerts`,
      { params: this.buildParams(p) }
    );
  }
}
