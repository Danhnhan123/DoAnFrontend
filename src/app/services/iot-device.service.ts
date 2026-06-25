import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
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
export class IotDeviceService {
  private http = inject(HttpClient);
  private readonly base = environment.baseUrl;

  /**
   * Lấy danh sách thiết bị IoT theo dạng DataTables (phân trang, tìm kiếm, sắp xếp, lọc).
   */
  getPagedAdvanced(
    body: IotDevicePagedAdvancedRequest
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.base}/iot-devices/paged-advanced`,
      body
    );
  }

  /**
   * Lấy chi tiết một thiết bị theo id (dùng khi mở modal sửa).
   */
  getById(id: number): Observable<ApiResponse<IotDeviceDetailDto>> {
    return this.http.get<ApiResponse<IotDeviceDetailDto>>(
      `${this.base}/iot-devices/${id}`
    );
  }

  /**
   * Tạo mới thiết bị IoT. Response trả về Device Key (chỉ hiển thị 1 lần).
   */
  create(
    payload: CreateIotDeviceDto
  ): Observable<ApiResponse<CreateIotDeviceResultDto>> {
    return this.http.post<ApiResponse<CreateIotDeviceResultDto>>(
      `${this.base}/iot-devices`,
      payload
    );
  }

  /**
   * Cập nhật thiết bị IoT.
   */
  update(payload: UpdateIotDeviceDto): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.base}/iot-devices`,
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
    return this.http.post<ApiResponse<IotDeviceApiKeyDto>>(
      `${this.base}/iot-devices/${id}/regenerate-api-key`,
      {}
    );
  }

  /**
   * Xóa mềm thiết bị.
   */
  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.base}/iot-devices/${id}`
    );
  }

  /**
   * Lấy danh sách kho để chọn khi tạo/sửa và lọc.
   */
  getWarehouses(): Observable<ApiResponse<WarehouseOption[]>> {
    return this.http.get<ApiResponse<WarehouseOption[]>>(
      `${this.base}/warehouse`
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
    const colIndex = params.colMap[params.sortField] ?? params.colMap['createdDate'];

    const col = (data: string, value = '') => ({
      data,
      name: data,
      searchable: true,
      orderable: true,
      search: { value, regex: false, fixed: [] as any[] },
    });

    const warehouseValue =
      params.filterWarehouseId != null ? String(params.filterWarehouseId) : '';
    const onlineValue =
      params.filterIsOnline != null ? String(params.filterIsOnline) : '';
    const activeValue =
      params.filterIsActive != null ? String(params.filterIsActive) : '';

    return {
      draw: params.page,
      columns: [
        col('id'),
        col('deviceCode'),
        col('deviceName'),
        col('deviceType', params.filterDeviceType?.trim() || ''),
        col('warehouseId', warehouseValue),
        col('warehouseName'),
        col('location'),
        col('isOnline', onlineValue),
        col('isActive', activeValue),
        col('lastHeartbeat'),
        col('createdDate'),
      ],
      order: [
        {
          column: colIndex,
          dir: params.sortDir,
          name: params.sortField,
        },
      ],
      start: (params.page - 1) * params.pageSize,
      length: params.pageSize,
      search: {
        value: params.search.trim(),
        regex: false,
        fixed: [],
      },
    };
  }
}
