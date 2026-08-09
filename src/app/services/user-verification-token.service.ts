import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, DTParameters } from '../models';

/**
 * Màn quản lý mã xác thực người dùng. Backend chỉ cung cấp API READ
 * (POST /user-verification-token/paged-advanced) nên service chỉ có đọc danh sách.
 */
@Injectable({ providedIn: 'root' })
export class UserVerificationTokenService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /** Danh sách mã xác thực dạng DataTables (phân trang/tìm/sắp xếp). */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/user-verification-token/paged-advanced`,
      body
    );
  }

  /** Dựng body DataTables cho paged-advanced. */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
  }): DTParameters {
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];
    const col = (data: string) => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value: '', regex: false, fixed: [] as any[] },
    });

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('code'),
        col('purpose'),
        col('userName'),
        col('expirationDate'),
        col('createdDate'),
      ],
      order: [
        { column: colIndex, dir: params.sortDir, name: params.sortField },
      ],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: { value: params.search.trim(), regex: false, fixed: [] },
    };
  }

  /** Nhãn tiếng Việt cho mục đích mã xác thực. */
  purposeLabel(purpose?: string | null): string {
    if (!purpose) return '—';
    const map: Record<string, string> = {
      VERIFY_EMAIL: 'Xác thực email',
      RESET_PASSWORD: 'Đặt lại mật khẩu',
      FORGOT_PASSWORD: 'Quên mật khẩu',
      CHANGE_EMAIL: 'Đổi email',
      TWO_FACTOR: 'Xác thực 2 lớp',
    };
    return map[purpose] ?? purpose;
  }
}
