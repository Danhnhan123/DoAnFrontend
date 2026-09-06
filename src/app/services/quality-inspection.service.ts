import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  DTResponse,
  QualityInspectionRow,
  QualityInspectionDetailDto,
  CreateQualityInspectionDto,
  UpdateQualityInspectionDto,
  QualityInspectionPagedRequest,
  QualityInspectionBagProgressDto,
  SaveBagInspectionResultDto,
  CompleteInspectionDto,
  MoistureConfigDto,
} from '../models';
import { buildDateRange } from '../utils/date.utils';

/**
 * Dịch vụ Kiểm định & Cách ly — nối 7 API QualityInspection của backend:
 * GET all, POST paged-advanced, GET {id}, GET by-lot/{paddyLotId}, POST, PUT, DELETE.
 */
@Injectable({ providedIn: 'root' })
export class QualityInspectionService extends ApiService {

  /** Bảng phiếu kiểm định (DataTables: phân trang / tìm / lọc / sắp xếp). */
  getPagedAdvanced(
    body: QualityInspectionPagedRequest
  ): Observable<ApiResponse<DTResponse<QualityInspectionRow>>> {
    return this.apiPost<DTResponse<QualityInspectionRow>>(
      '/quality-inspections/paged-advanced',
      body
    );
  }

  getAll(): Observable<ApiResponse<QualityInspectionRow[]>> {
    return this.apiGet<QualityInspectionRow[]>(
      '/quality-inspections'
    );
  }

  getById(id: number): Observable<ApiResponse<QualityInspectionDetailDto>> {
    return this.apiGet<QualityInspectionDetailDto>(
      `/quality-inspections/${id}`
    );
  }

  /** Lịch sử kiểm định của một lô. */
  getByLot(
    paddyLotId: number
  ): Observable<ApiResponse<QualityInspectionRow[]>> {
    return this.apiGet<QualityInspectionRow[]>(
      `/quality-inspections/by-lot/${paddyLotId}`
    );
  }

  create(payload: CreateQualityInspectionDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/quality-inspections`,
      payload
    );
  }

  /**
   * Kiểm tra LẠI chất lượng lô đang CÁCH LY. Nếu passedInspection=true, BE rút toàn bộ tồn
   * khỏi ô cách ly và sinh phiếu nhập kho để xếp lại vào ô thường (màn Store-in).
   */
  recheck(payload: CreateQualityInspectionDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/quality-inspections/recheck`,
      payload
    );
  }

  update(payload: UpdateQualityInspectionDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/quality-inspections`,
      payload
    );
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(`/quality-inspections/${id}`);
  }

  /** Lấy toàn bộ bao và tiến độ của một phiên kiểm tra cấp bao. */
  getBagProgress(
    inspectionId: number
  ): Observable<ApiResponse<QualityInspectionBagProgressDto>> {
    return this.apiGet<QualityInspectionBagProgressDto>(
      `/quality-inspections/${inspectionId}/bags`
    );
  }

  /** Upsert idempotent kết quả QC của một bao; chưa tạo side-effect nghiệp vụ. */
  saveBagResult(
    inspectionId: number,
    bagId: number,
    payload: SaveBagInspectionResultDto
  ): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      `/quality-inspections/${inspectionId}/bags/${bagId}`,
      payload
    );
  }

  /** Finalize khi 100% bao đã có kết quả và áp dụng disposition lên hàng hóa. */
  complete(
    inspectionId: number,
    payload: CompleteInspectionDto
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      `/quality-inspections/${inspectionId}/complete`,
      payload
    );
  }

  getMoistureConfig(): Observable<ApiResponse<MoistureConfigDto>> {
    return this.apiGet<MoistureConfigDto>(
      `/quality-inspections/config`
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
    const columns = ['lotCode', 'inspectorName', 'inspectedAt', 'moisturePercent', 'impurityPercent', 'moldLevel', 'pestLevel', 'packagingStatus', 'passedInspection', 'handling', 'id'];
    const columnFilters = {
      passedInspection: params.filterPassed != null ? String(params.filterPassed) : '',
      inspectedAt: buildDateRange(params.dateFrom ?? '', params.dateTo ?? ''),
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      columnFilters
    ) as QualityInspectionPagedRequest;
  }
}
