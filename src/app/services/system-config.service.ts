import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  SearchQuery,
  PagingData,
  SystemConfigDetailDto,
} from '../models';

export interface CreateSystemConfigDto {
  /** Tên cấu hình (bắt buộc theo BE). */
  name: string;
  /** Khóa cấu hình (BE: ConfigKey). */
  configKey: string;
  /** Giá trị cấu hình (BE: ConfigValue). */
  configValue: string;
  description?: string;
}

export interface UpdateSystemConfigDto extends CreateSystemConfigDto {
  id: number;
}

@Injectable({ providedIn: 'root' })
export class SystemConfigService extends ApiService {

  /** Lấy danh sách config phân trang */
  getPaged(
    query: SearchQuery
  ): Observable<ApiResponse<PagingData<SystemConfigDetailDto>>> {
    return this.apiPost<PagingData<SystemConfigDetailDto>>(
      '/system-config/paged',
      query
    );
  }

  /** Lấy tất cả config (không phân trang - fallback) */
  getAll(): Observable<ApiResponse<SystemConfigDetailDto[]>> {
    return this.apiGet<SystemConfigDetailDto[]>(
      '/system-config'
    );
  }

  /** Tạo config mới */
  create(payload: CreateSystemConfigDto): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/system-config',
      payload
    );
  }

  /** Cập nhật config */
  update(payload: UpdateSystemConfigDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/system-config',
      payload
    );
  }

  /** Xóa config theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(
      `/system-config/${id}`
    );
  }
}
