import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { buildDataTablesRequest } from '../utils/datatable.util';
import {
  ApiResponse,
  IotDeviceDetailDto,
  IotDevicePagedAdvancedRequest,
  CreateIotDeviceDto,
  UpdateIotDeviceDto,
  CreateIotDeviceResultDto,
  IotDeviceApiKeyDto,
  WarehouseOption,
} from '../models';

@Injectable({ providedIn: 'root' })
export class IotDeviceService extends ApiService {

  /**
   * Lấy danh sách thiết bị IoT theo dạng DataTables (phân trang, tìm kiếm, sắp xếp, lọc).
   */
  getPagedAdvanced(
    body: IotDevicePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.apiPost<any>(
      '/iot-devices/paged-advanced',
      body
    );
  }

  /**
   * Lấy chi tiết một thiết bị theo id (dùng khi mở modal sửa).
   */
  getById(id: number): Observable<ApiResponse<IotDeviceDetailDto>> {
    return this.apiGet<IotDeviceDetailDto>(
      `/iot-devices/${id}`
    );
  }

  /**
   * Tạo mới thiết bị IoT. Response trả về Device Key (chỉ hiển thị 1 lần).
   */
  create(
    payload: CreateIotDeviceDto
  ): Observable<ApiResponse<CreateIotDeviceResultDto>> {
    return this.apiPost<CreateIotDeviceResultDto>(
      '/iot-devices',
      payload
    );
  }

  /**
   * Cập nhật thiết bị IoT.
   */
  update(payload: UpdateIotDeviceDto): Observable<ApiResponse<any>> {
    return this.apiPut<any>(
      '/iot-devices',
      payload
    );
  }

  /**
   * Bật/tắt trạng thái hoạt động của thiết bị.
   */
  updateActiveStatus(
    id: number,
    isActive: boolean
  ): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(
      `${this.base}/iot-devices/${id}/active-status?isActive=${isActive}`,
      {}
    );
  }

  /**
   * Cấp lại Device Key mới cho thiết bị (key cũ sẽ bị vô hiệu).
   */
  regenerateApiKey(
    id: number
  ): Observable<ApiResponse<IotDeviceApiKeyDto>> {
    return this.apiPost<IotDeviceApiKeyDto>(
      `/iot-devices/${id}/regenerate-api-key`,
      {}
    );
  }

  /**
   * Xóa mềm thiết bị.
   */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiDelete<any>(
      `/iot-devices/${id}`
    );
  }

  /**
   * Lấy danh sách kho để chọn khi tạo/sửa và lọc.
   */
  getWarehouses(): Observable<ApiResponse<WarehouseOption[]>> {
    return this.apiGet<WarehouseOption[]>(
      '/warehouse'
    );
  }

  /**
   * Dựng body DataTables gửi lên API paged-advanced.
   * - search.value: từ khóa tìm kiếm chung
   * - order: cột + chiều sắp xếp
   * - columns[].search.value: bộ lọc theo từng cột (kho, loại, online, kích hoạt)
   */
  buildPagedBody(params: {
    page: number;
    pageSize: number;
    search: string;
    sortField: string;
    sortDir: 'asc' | 'desc';
    colMap: Record<string, number>;
    filterWarehouseId: number | null;
    filterDeviceType: string | null;
    filterIsOnline: boolean | null;
    filterIsActive: boolean | null;
  }): IotDevicePagedAdvancedRequest {
    const columns = ['id', 'deviceCode', 'deviceName', 'deviceType', 'warehouseId', 'warehouseName', 'location', 'isOnline', 'isActive', 'lastHeartbeat', 'createdDate'];
    const columnFilters = {
      deviceType: params.filterDeviceType?.trim() || '',
      warehouseId: params.filterWarehouseId != null ? String(params.filterWarehouseId) : '',
      isOnline: params.filterIsOnline != null ? String(params.filterIsOnline) : '',
      isActive: params.filterIsActive != null ? String(params.filterIsActive) : '',
    };

    return buildDataTablesRequest(
      {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sortField: params.sortField,
        sortDir: params.sortDir,
      },
      columns,
      columnFilters
    ) as IotDevicePagedAdvancedRequest;
  }
}
