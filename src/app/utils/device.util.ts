const DEVICE_ID_KEY = 'device_id';

/** Lấy (hoặc tạo mới) định danh thiết bị ổn định, lưu trong localStorage. */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  userAgent: string;
}

function detectPlatform(ua: string): string {
  const s = ua.toLowerCase();
  if (/android/.test(s)) return 'Android';
  if (/iphone|ipad|ipod/.test(s)) return 'iOS';
  if (/windows/.test(s)) return 'Windows';
  if (/mac os|macintosh/.test(s)) return 'macOS';
  if (/linux/.test(s)) return 'Linux';
  return 'Web';
}

function detectBrowser(ua: string): string {
  const s = ua.toLowerCase();
  if (/edg\//.test(s)) return 'Edge';
  if (/opr\/|opera/.test(s)) return 'Opera';
  if (/chrome\//.test(s) && !/edg\//.test(s)) return 'Chrome';
  if (/firefox\//.test(s)) return 'Firefox';
  if (/safari\//.test(s) && !/chrome\//.test(s)) return 'Safari';
  return 'Trình duyệt';
}

/** Thông tin thiết bị hiện tại (dùng khi đăng ký thiết bị lúc đăng nhập). */
export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const platform = detectPlatform(ua);
  const browser = detectBrowser(ua);
  return {
    deviceId: getOrCreateDeviceId(),
    deviceName: `${browser} trên ${platform}`,
    platform,
    userAgent: ua,
  };
}
