import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, MyDevice, RegisterDeviceRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class UserDeviceService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

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
