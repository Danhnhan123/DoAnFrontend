import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  RiceVarietyDetailDto,
  RiceVarietyPagedAdvancedRequest,
  CreateRiceVarietyDto,
  UpdateRiceVarietyDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

@Injectable({ providedIn: 'root' })
export class RiceVarietyService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  getPagedAdvanced(
    body: RiceVarietyPagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/rice-varieties/paged-advanced`,
      body
    );
  }

  getById(id: number): Observable<ApiResponse<RiceVarietyDetailDto>> {
    return this.http.get<ApiResponse<RiceVarietyDetailDto>>(
      `${this.base}/rice-varieties/${id}`
    );
  }

  create(payload: CreateRiceVarietyDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/rice-varieties`,
      payload
    );
  }

  update(payload: UpdateRiceVarietyDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/rice-varieties`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/rice-varieties/${id}`
    );
  }

  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterName?: string | null;
    filterCode?: string | null;
    filterIsActive: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): RiceVarietyPagedAdvancedRequest {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const activeValue =
      params.filterIsActive != null ? String(params.filterIsActive) : '';
    const dateSearch = buildDateRange(params.dateFrom ?? '', params.dateTo ?? '');

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('name', params.filterName?.trim() || ''),
        col('code', params.filterCode?.trim() || ''),
        col('season'),
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
