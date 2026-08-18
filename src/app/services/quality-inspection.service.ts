import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  DTResponse,
  QualityInspectionRow,
  QualityInspectionDetailDto,
  CreateQualityInspectionDto,
  UpdateQualityInspectionDto,
  QualityInspectionPagedRequest,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

/**
 * Dịch vụ Kiểm định & Cách ly — nối 7 API QualityInspection của backend:
 * GET all, POST paged-advanced, GET {id}, GET by-lot/{paddyLotId}, POST, PUT, DELETE.
 */
@Injectable({ providedIn: 'root' })
export class QualityInspectionService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Bảng phiếu kiểm định (DataTables: phân trang / tìm / lọc / sắp xếp). */
  getPagedAdvanced(
    body: QualityInspectionPagedRequest
  ): Observable<ApiResponse<DTResponse<QualityInspectionRow>>> {
    return this.http.post<ApiResponse<DTResponse<QualityInspectionRow>>>(
      `${this.base}/quality-inspections/paged-advanced`,
      body
    );
  }

  getAll(): Observable<ApiResponse<QualityInspectionRow[]>> {
    return this.http.get<ApiResponse<QualityInspectionRow[]>>(
      `${this.base}/quality-inspections`
    );
  }

  getById(id: number): Observable<ApiResponse<QualityInspectionDetailDto>> {
    return this.http.get<ApiResponse<QualityInspectionDetailDto>>(
      `${this.base}/quality-inspections/${id}`
    );
  }

  /** Lịch sử kiểm định của một lô. */
  getByLot(
    paddyLotId: number
  ): Observable<ApiResponse<QualityInspectionRow[]>> {
    return this.http.get<ApiResponse<QualityInspectionRow[]>>(
      `${this.base}/quality-inspections/by-lot/${paddyLotId}`
    );
  }

  create(payload: CreateQualityInspectionDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/quality-inspections`,
      payload
    );
  }

  /**
   * Kiểm tra LẠI chất lượng lô đang CÁCH LY. Nếu passedInspection=true, BE rút toàn bộ tồn
   * khỏi ô cách ly và sinh phiếu nhập kho để xếp lại vào ô thường (màn Store-in).
   */
  recheck(payload: CreateQualityInspectionDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/quality-inspections/recheck`,
      payload
    );
  }

  update(payload: UpdateQualityInspectionDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/quality-inspections`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/quality-inspections/${id}`
    );
  }

  /** Dựng body DataTables cho /quality-inspections/paged-advanced. */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterPassed: boolean | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }): QualityInspectionPagedRequest {
    const colIndex =
      params.colMap[params.sortField] ?? params.colMap['inspectedAt'] ?? 0;

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const passedValue =
      params.filterPassed != null ? String(params.filterPassed) : '';
    const dateSearch = buildDateRange(params.dateFrom ?? '', params.dateTo ?? '');

    return {
      draw: params.page,
      columns: [
        col('lotCode'),
        col('inspectorName'),
        col('inspectedAt', dateSearch),
        col('moisturePercent'),
        col('impurityPercent'),
        col('moldLevel'),
        col('pestLevel'),
        col('packagingStatus'),
        col('passedInspection', passedValue),
        col('handling'),
        col('id'),
      ],
      order: [{ column: colIndex, dir: params.sortDir, name: params.sortField }],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }
}
