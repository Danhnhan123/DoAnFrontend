import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  MyDevice,
  RegisterDeviceRequest,
  DTParameters,
} from '../models';

@Injectable({ providedIn: 'root' })
export class UserDeviceService extends ApiService {

  // ── Màn quản lý thiết bị (admin) ─────────────────────────────────
  /** Danh sách thiết bị dạng DataTables (phân trang/tìm/sắp xếp). Chỉ READ. */
  getPagedAdvanced(body: DTParameters): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/user-device/paged-advanced',
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
    const columns = ['id', 'deviceName', 'platform', 'osVersion', 'appVersion', 'userAgent', 'userName', 'createdDate'];

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

  /** Đăng ký/cập nhật thiết bị hiện tại (gọi sau khi login). */
  registerDevice(payload: RegisterDeviceRequest): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/user-device/register', payload);
  }

  /** Danh sách thiết bị đã đăng ký của người dùng. */
  getMyDevices(): Observable<ApiResponse<MyDevice[]>> {
    return this.apiGet<MyDevice[]>('/user-device/my-devices');
  }

  /** Đăng xuất khỏi một thiết bị cụ thể (theo DeviceId). */
  logoutDevice(deviceId: string): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/user-device/logout', { deviceId });
  }

  /** Đăng xuất một thiết bị theo Id bản ghi (dùng cho thiết bị không có DeviceId). */
  logoutDeviceById(id: number): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/user-device/logout-by-id', { id });
  }

  /** Đăng xuất khỏi tất cả thiết bị khác (giữ thiết bị hiện tại). */
  logoutOtherDevices(deviceId: string): Observable<ApiResponse<any>> {
    return this.apiPost<any>('/user-device/logout-others', { deviceId });
  }
}
