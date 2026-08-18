import { DTParameters } from './search';

/**
 * Một dòng thiết bị IoT hiển thị trên bảng.
 * Trùng cấu trúc với IotDeviceAggregate / IotDeviceDetailDto của backend.
 */
export interface IotDeviceRow {
  id: number;

  warehouseId: number;
  warehouseName?: string | null;
  warehouseCode?: string | null;

  deviceName: string;
  deviceCode: string;
  deviceType: string;

  location?: string | null;
  mqttTopic?: string | null;

  lastHeartbeat?: string | null;
  isOnline: boolean;
  isActive: boolean;

  createdDate: string;
  lastModifiedDate?: string | null;
}

export interface IotDeviceDetailDto extends IotDeviceRow {}

/**
 * Payload tạo mới thiết bị.
 * apiKey để trống thì backend tự sinh Device Key.
 */
export interface CreateIotDeviceDto {
  warehouseId: number;
  deviceName: string;
  deviceCode: string;
  deviceType: string;
  location?: string | null;
  mqttTopic?: string | null;
  apiKey?: string | null;
  isActive: boolean;
}

/**
 * Payload cập nhật thiết bị. Không có apiKey (đổi key qua API regenerate riêng).
 */
export interface UpdateIotDeviceDto {
  id: number;
  warehouseId: number;
  deviceName: string;
  deviceCode: string;
  deviceType: string;
  location?: string | null;
  mqttTopic?: string | null;
  isActive: boolean;
}

/**
 * Kết quả trả về khi tạo thiết bị (Device Key chỉ hiển thị 1 lần).
 */
export interface CreateIotDeviceResultDto {
  id: number;
  deviceCode: string;
  apiKey: string;
  headerName: string;
  note: string;
}

/**
 * Kết quả trả về khi cấp lại Device Key.
 */
export interface IotDeviceApiKeyDto {
  id: number;
  deviceCode: string;
  apiKey: string;
  headerName: string;
}

export interface IotDevicePagedAdvancedRequest extends DTParameters {}
