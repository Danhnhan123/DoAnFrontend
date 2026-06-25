import { Component, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
import Swal from 'sweetalert2';

import {
  IotDeviceRow,
  IotDeviceDetailDto,
  CreateIotDeviceDto,
  UpdateIotDeviceDto,
  WarehouseOption,
} from '../../models';
import { IotDeviceService } from '../../services/iot-device.service';

@Component({
  selector: 'app-iot-device',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './iot-device.component.html',
  styleUrl: './iot-device.component.css',
})
export class IotDeviceComponent {
  private deviceService = inject(IotDeviceService);
  private queryClient = injectQueryClient();

  // =========================
  // 1. State cho bảng
  // =========================

  page = signal(1);
  pageSize = signal(10);
  search = signal('');

  sortField = signal('createdDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  showFilter = signal(false);
  filterWarehouseId = signal<number | null>(null);
  filterDeviceType = signal<string | null>(null);
  filterIsOnline = signal<boolean | null>(null);
  filterIsActive = signal<boolean | null>(null);

  readonly deviceTypes = ['SCALE', 'SENSOR', 'GATEWAY', 'CONTROLLER', 'OTHER'];

  // =========================
  // 2. State cho modal form
  // =========================

  showModal = signal(false);
  editItem = signal<IotDeviceRow | null>(null);
  isEdit = computed(() => !!this.editItem());

  form = signal<any>({
    warehouseId: 0,
    deviceName: '',
    deviceCode: '',
    deviceType: 'SCALE',
    location: '',
    mqttTopic: '',
    apiKey: '',
    isActive: true,
  });

  /**
   * Map tên field frontend sang index cột trong body DataTables.
   * Khi bấm sort, backend lấy columns[order[0].column].data để sort.
   */
  private readonly colMap: Record<string, number> = {
    id: 0,
    deviceCode: 1,
    deviceName: 2,
    deviceType: 3,
    warehouseId: 4,
    warehouseName: 5,
    location: 6,
    isOnline: 7,
    isActive: 8,
    lastHeartbeat: 9,
    createdDate: 10,
  };

  // =========================
  // 3. Queries
  // =========================

  listQuery = injectQuery(() => ({
    queryKey: [
      'iot-devices',
      this.page(),
      this.pageSize(),
      this.search(),
      this.sortField(),
      this.sortDir(),
      this.filterWarehouseId(),
      this.filterDeviceType(),
      this.filterIsOnline(),
      this.filterIsActive(),
    ],
    queryFn: () => {
      const body = this.deviceService.buildPagedBody({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search(),
        sortField: this.sortField(),
        sortDir: this.sortDir(),
        colMap: this.colMap,
        filterWarehouseId: this.filterWarehouseId(),
        filterDeviceType: this.filterDeviceType(),
        filterIsOnline: this.filterIsOnline(),
        filterIsActive: this.filterIsActive(),
      });

      return lastValueFrom(this.deviceService.getPagedAdvanced(body));
    },
  }));

  warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouse-options'],
    queryFn: () => lastValueFrom(this.deviceService.getWarehouses()),
  }));

  detailQuery = injectQuery(() => ({
    queryKey: ['iot-device-detail', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.deviceService.getById(this.editItem()!.id)),
  }));

  // =========================
  // 4. Computed data cho HTML
  // =========================

  rows = computed<IotDeviceRow[]>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.data ?? [];
  });

  totalRecords = computed<number>(() => {
    const res = this.listQuery.data();
    const r = (res as any)?.resources ?? (res as any)?.data;
    return r?.recordsFiltered ?? r?.recordsTotal ?? 0;
  });

  loading = computed(() => this.listQuery.isPending());
  loadingDetail = computed(() => this.detailQuery.isFetching());

  warehouseOptions = computed<WarehouseOption[]>(() => {
    return (this.warehousesQuery.data() as any)?.resources ?? [];
  });

  onlineCount = computed(() => this.rows().filter((x) => x.isOnline).length);
  offlineCount = computed(() => this.rows().filter((x) => !x.isOnline).length);
  activeCount = computed(() => this.rows().filter((x) => x.isActive).length);

  private syncDetail = effect(() => {
    const d = this.detailQuery.data();

    if (!d || !this.showModal() || !this.isEdit()) return;

    const detail: IotDeviceDetailDto =
      (d as any)?.resources ?? (d as any)?.data;

    if (!detail) return;

    this.form.set({
      warehouseId: detail.warehouseId || 0,
      deviceName: detail.deviceName || '',
      deviceCode: detail.deviceCode || '',
      deviceType: detail.deviceType || 'SCALE',
      location: detail.location || '',
      mqttTopic: detail.mqttTopic || '',
      apiKey: '',
      isActive: detail.isActive ?? true,
    });
  });

  // =========================
  // 5. Mutations
  // =========================

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateIotDeviceDto) =>
      lastValueFrom(this.deviceService.create(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['iot-devices'] });
        this.showDeviceKey(res?.resources, 'Tạo thiết bị thành công!');
      } else {
        this.showAlert(res.message || 'Thêm thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(
        err?.error?.message || err?.errors?.message || 'Lỗi hệ thống',
        false
      ),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateIotDeviceDto) =>
      lastValueFrom(this.deviceService.update(payload)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['iot-devices'] });
        this.showAlert('Cập nhật thiết bị thành công!');
      } else {
        this.showAlert(res.message || 'Cập nhật thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(
        err?.error?.message || err?.errors?.message || 'Lỗi hệ thống',
        false
      ),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) => lastValueFrom(this.deviceService.delete(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['iot-devices'] });
        this.showAlert('Đã xóa thiết bị!');
      } else {
        this.showAlert(res.message || 'Xóa thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi xóa', false),
  }));

  toggleActiveMutation = injectMutation(() => ({
    mutationFn: (vars: { id: number; isActive: boolean }) =>
      lastValueFrom(
        this.deviceService.updateActiveStatus(vars.id, vars.isActive)
      ),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['iot-devices'] });
        this.showAlert(res.message || 'Đã cập nhật trạng thái!');
      } else {
        this.showAlert(res.message || 'Cập nhật trạng thái thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  regenerateKeyMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.deviceService.regenerateApiKey(id)),
    onSuccess: (res: any) => {
      if (res.isSucceeded) {
        this.showDeviceKey(res?.resources, 'Cấp lại Device Key thành công!');
      } else {
        this.showAlert(res.message || 'Cấp lại key thất bại', false);
      }
    },
    onError: (err: any) =>
      this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  // =========================
  // 6. Table helpers
  // =========================

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }

  applyFilter(): void {
    this.page.set(1);
  }

  clearFilter(): void {
    this.filterWarehouseId.set(null);
    this.filterDeviceType.set(null);
    this.filterIsOnline.set(null);
    this.filterIsActive.set(null);
    this.applyFilter();
  }

  onSearch(): void {
    this.page.set(1);
  }

  sort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }

    this.page.set(1);
  }

  sortIcon(field: string): string {
    if (this.sortField() !== field) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }

  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }

  visiblePages(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const d = 2;
    const pages: number[] = [];

    for (let i = Math.max(1, cur - d); i <= Math.min(total, cur + d); i++) {
      pages.push(i);
    }

    return pages;
  }

  // =========================
  // 7. Modal helpers
  // =========================

  openCreate(): void {
    this.editItem.set(null);

    this.form.set({
      warehouseId: this.warehouseOptions()[0]?.id || 0,
      deviceName: '',
      deviceCode: '',
      deviceType: 'SCALE',
      location: '',
      mqttTopic: '',
      apiKey: '',
      isActive: true,
    });

    this.showModal.set(true);
  }

  openEdit(row: IotDeviceRow): void {
    this.editItem.set(row);

    this.form.set({
      warehouseId: row.warehouseId || 0,
      deviceName: row.deviceName || '',
      deviceCode: row.deviceCode || '',
      deviceType: row.deviceType || 'SCALE',
      location: row.location || '',
      mqttTopic: row.mqttTopic || '',
      apiKey: '',
      isActive: row.isActive ?? true,
    });

    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }

  setField(field: string, value: any): void {
    this.form.update((x) => ({ ...x, [field]: value }));
  }

  // =========================
  // 8. Save / delete / actions
  // =========================

  save(): void {
    const f = this.form();

    if (!f.warehouseId || !f.deviceName?.trim() || !f.deviceCode?.trim() || !f.deviceType?.trim()) {
      this.showAlert(
        'Vui lòng nhập Kho, Tên thiết bị, Mã thiết bị và Loại thiết bị',
        false
      );
      return;
    }

    if (!/^[A-Za-z0-9_-]+$/.test(f.deviceCode.trim())) {
      this.showAlert(
        'Mã thiết bị chỉ được chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới.',
        false
      );
      return;
    }

    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';

    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có muốn ${actionText} thiết bị IoT này không?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#4f46e5',
    }).then((result) => {
      if (!result.isConfirmed) return;

      if (this.isEdit()) {
        const payload: UpdateIotDeviceDto = {
          id: this.editItem()!.id,
          warehouseId: Number(f.warehouseId),
          deviceName: f.deviceName.trim(),
          deviceCode: f.deviceCode.trim(),
          deviceType: f.deviceType.trim(),
          location: f.location?.trim() || null,
          mqttTopic: f.mqttTopic?.trim() || null,
          isActive: !!f.isActive,
        };

        this.updateMutation.mutate(payload);
      } else {
        const payload: CreateIotDeviceDto = {
          warehouseId: Number(f.warehouseId),
          deviceName: f.deviceName.trim(),
          deviceCode: f.deviceCode.trim(),
          deviceType: f.deviceType.trim(),
          location: f.location?.trim() || null,
          mqttTopic: f.mqttTopic?.trim() || null,
          apiKey: f.apiKey?.trim() || null,
          isActive: !!f.isActive,
        };

        this.createMutation.mutate(payload);
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Xóa thiết bị?',
      text: `Bạn có chắc muốn xóa "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteMutation.mutate(id);
      }
    });
  }

  toggleActive(row: IotDeviceRow): void {
    const next = !row.isActive;

    Swal.fire({
      title: next ? 'Kích hoạt thiết bị?' : 'Tạm ngưng thiết bị?',
      text: `Thiết bị "${row.deviceName}" sẽ ${next ? 'được kích hoạt' : 'bị tạm ngưng'}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#4f46e5',
    }).then((result) => {
      if (result.isConfirmed) {
        this.toggleActiveMutation.mutate({ id: row.id, isActive: next });
      }
    });
  }

  regenerateKey(row: IotDeviceRow): void {
    Swal.fire({
      title: 'Cấp lại Device Key?',
      text: `Key cũ của "${row.deviceName}" sẽ bị vô hiệu. ESP32 cần được cấu hình lại với key mới.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cấp lại key',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#f59e0b',
    }).then((result) => {
      if (result.isConfirmed) {
        this.regenerateKeyMutation.mutate(row.id);
      }
    });
  }

  /**
   * Hiển thị Device Key vừa tạo/cấp lại để người dùng copy (chỉ hiện 1 lần).
   */
  private showDeviceKey(data: any, title: string): void {
    const apiKey = data?.apiKey;
    const headerName = data?.headerName || 'X-Device-Key';

    if (!apiKey) {
      this.showAlert(title);
      return;
    }

    Swal.fire({
      title,
      icon: 'success',
      html: `
        <p style="margin-bottom:8px">Device Key chỉ hiển thị <b>một lần</b>. Hãy lưu lại để cấu hình vào ESP32:</p>
        <code style="display:block;word-break:break-all;background:#f1f5f9;padding:10px;border-radius:8px;font-size:0.8rem">${apiKey}</code>
        <p style="margin-top:8px;font-size:0.78rem;color:#64748b">Gửi kèm header: <b>${headerName}</b></p>
      `,
      confirmButtonText: 'Đã lưu key',
      confirmButtonColor: '#4f46e5',
    });
  }

  private showAlert(message: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công' : 'Lỗi',
      text: message,
      icon: ok ? 'success' : 'error',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#4f46e5',
    });
  }
}
