import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ReportFilterOptions,
  ReportOverview,
  ReportPage,
  ReportQueryParams,
  ReportTab,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.baseUrl}/reports`;

  private readonly endpoints: Record<Exclude<ReportTab, 'overview'>, string> = {
    stock: 'inventory-by-lot',
    purchase: 'purchase',
    'milling-loss': 'milling-yield',
    sales: 'sales-revenue',
    'two-way-debt': 'debt-documents',
    quality: 'quality-alerts',
    'relative-profit': 'relative-profit',
    'source-effectiveness': 'source-effectiveness',
  };

  getFilterOptions(): Observable<ApiResponse<ReportFilterOptions>> {
    return this.http.get<ApiResponse<ReportFilterOptions>>(
      `${this.base}/filter-options`
    );
  }

  getOverview(
    query: ReportQueryParams
  ): Observable<ApiResponse<ReportOverview>> {
    return this.http.get<ApiResponse<ReportOverview>>(`${this.base}/overview`, {
      params: this.buildParams(query),
    });
  }

  getReport(
    type: Exclude<ReportTab, 'overview'>,
    query: ReportQueryParams
  ): Observable<ApiResponse<ReportPage>> {
    return this.http.get<ApiResponse<ReportPage>>(
      `${this.base}/${this.endpoints[type]}`,
      { params: this.buildParams(query) }
    );
  }

  exportReport(
    type: Exclude<ReportTab, 'overview'>,
    format: 'xlsx' | 'csv',
    query: ReportQueryParams
  ): Observable<Blob> {
    return this.http.get(`${this.base}/${type}/export`, {
      params: this.buildParams(query).set('format', format),
      responseType: 'blob',
    });
  }

  private buildParams(query: ReportQueryParams): HttpParams {
    let params = new HttpParams()
      .set('fromDate', query.fromDate)
      .set('toDate', query.toDate)
      .set('pageIndex', String(query.pageIndex ?? 1))
      .set('pageSize', String(query.pageSize ?? 20))
      .set('sortDirection', query.sortDirection ?? 'desc');

    const optional: Record<string, unknown> = {
      warehouseId: query.warehouseId,
      riceVarietyId: query.riceVarietyId,
      productVariantId: query.productVariantId,
      paddyLotId: query.paddyLotId,
      locationId: query.locationId,
      farmerId: query.farmerId,
      customerId: query.customerId,
      productType: query.productType,
      channel: query.channel,
      status: query.status,
      sortBy: query.sortBy,
    };

    Object.entries(optional).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}
