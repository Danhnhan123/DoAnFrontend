import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  MillingYieldConfigDetailDto,
  MillingYieldConfigPagedAdvancedRequest,
  CreateMillingYieldConfigDto,
  UpdateMillingYieldConfigDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class MillingYieldConfigService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: MillingYieldConfigPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/milling-yield-configs/paged-advanced`,
      body
    );
  }

  getById(id: number): Observable<ApiResponse<MillingYieldConfigDetailDto>> {
    return this.http.get<ApiResponse<MillingYieldConfigDetailDto>>(
      `${this.base}/milling-yield-configs/${id}`
    );
  }

  create(payload: CreateMillingYieldConfigDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/milling-yield-configs`,
      payload
    );
  }

  update(payload: UpdateMillingYieldConfigDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/milling-yield-configs`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/milling-yield-configs/${id}`
    );
  }

  /** Danh sách giống lúa cho dropdown (GET /rice-varieties). */
  getRiceVarietyOptions(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.base}/rice-varieties`);
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterRiceVarietyId: number | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): MillingYieldConfigPagedAdvancedRequest {
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const activeValue =
      params.filterIsActive != null ? String(params.filterIsActive) : '';
    const varietyValue =
      params.filterRiceVarietyId != null
        ? String(params.filterRiceVarietyId)
        : '';
    const dateSearch = buildDateRange(
      params.dateFrom ?? '',
      params.dateTo ?? ''
    );

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('riceVarietyId', varietyValue),
        col('riceVarietyName'),
        col('yieldRate'),
        col('moistureFrom'),
        col('moistureTo'),
        col('isActive', activeValue),
        col('createdDate', dateSearch),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
