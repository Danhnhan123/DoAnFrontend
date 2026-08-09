import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  MyDevice,
  RegisterDeviceRequest,
  DTParameters,
} from '../models';

@Injectable({ providedIn: 'root' })
export class UserDeviceService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  // ── Màn quản lý thiết bị (admin) ─────────────────────────────────
  /** Danh sách thiết bị dạng DataTables (phân trang/tìm/sắp xếp). Chỉ READ. */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/user-device/paged-advanced`,
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
        col('deviceName'),
        col('platform'),
        col('osVersion'),
        col('appVersion'),
        col('userAgent'),
        col('userName'),
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

  /** Đăng ký/cập nhật thiết bị hiện tại (gọi sau khi login). */
  registerDevice(payload: RegisterDeviceRequest): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/user-device/register`, payload);
  }

  /** Danh sách thiết bị đã đăng ký của người dùng. */
  getMyDevices(): Observable<ApiResponse<MyDevice[]>> {
    return this.http.get<ApiResponse<MyDevice[]>>(`${this.base}/user-device/my-devices`);
  }

  /** Đăng xuất khỏi một thiết bị cụ thể. */
  logoutDevice(deviceId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/user-device/logout`, { deviceId });
  }

  /** Đăng xuất khỏi tất cả thiết bị khác (giữ thiết bị hiện tại). */
  logoutOtherDevices(deviceId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.base}/user-device/logout-others`, { deviceId });
  }
}
