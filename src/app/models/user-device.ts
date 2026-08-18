/** Một thiết bị đã đăng ký của người dùng (hiển thị trong Profile). */
export interface MyDevice {
  id: number;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  userAgent?: string;
  hasActiveSession: boolean;
  /** Trạng thái realtime: 'active' | 'idle' | 'offline'. */
  status?: string;
  createdDate: string;
  lastModifiedDate?: string;
}

/**
 * Một dòng thiết bị trong màn quản lý (admin) - khớp UserDeviceAggregate
 * của backend (POST /user-device/paged-advanced).
 */
export interface UserDeviceRow {
  id: number;
  deviceName?: string | null;
  platform?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  deviceToken?: string | null;
  userAgent?: string | null;
  createdDate: string;
  userId: number;
  userName?: string | null;
}

/** Payload đăng ký thiết bị (gọi sau khi đăng nhập). */
export interface RegisterDeviceRequest {
  deviceId: string;
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  userAgent?: string;
  deviceToken?: string;
  refreshToken?: string;
}
