import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, DTParameters } from '../models';
import { buildDataTablesRequest } from '../utils/datatable.util';

/**
 * Màn quản lý mã xác thực người dùng. Backend chỉ cung cấp API READ
 * (POST /user-verification-token/paged-advanced) nên service chỉ có đọc danh sách.
 */
@Injectable({ providedIn: 'root' })
export class UserVerificationTokenService extends ApiService {

  /** Danh sách mã xác thực dạng DataTables (phân trang/tìm/sắp xếp). */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/user-verification-token/paged-advanced',
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
    const columns = ['id', 'code', 'purpose', 'userName', 'expirationDate', 'createdDate'];

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns
    ) as DTParameters;
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
