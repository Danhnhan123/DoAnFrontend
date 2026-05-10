import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  SearchQuery,
  PagingData,
  SystemConfigDetailDto,
} from '../models';

export interface CreateSystemConfigDto {
  key: string;
  value: string;
  description?: string;
}

export interface UpdateSystemConfigDto extends CreateSystemConfigDto {
  id: number;
}

@Injectable({ providedIn: 'root' })
export class SystemConfigService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Lấy danh sách config phân trang */
  getPaged(
    query: SearchQuery
  ): Observable<ApiResponse<PagingData<SystemConfigDetailDto>>> {
    return this.http.post<ApiResponse<PagingData<SystemConfigDetailDto>>>(
      `${this.base}/system-config/paged`,
      query
    );
  }

  /** Lấy tất cả config (không phân trang - fallback) */
  getAll(): Observable<ApiResponse<SystemConfigDetailDto[]>> {
    return this.http.get<ApiResponse<SystemConfigDetailDto[]>>(
      `${this.base}/system-config`
    );
  }

  /** Tạo config mới */
  create(payload: CreateSystemConfigDto): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/system-config`,
      payload
    );
  }

  /** Cập nhật config */
  update(payload: UpdateSystemConfigDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/system-config`,
      payload
    );
  }

  /** Xóa config theo ID */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/system-config/${id}`
    );
  }
}
