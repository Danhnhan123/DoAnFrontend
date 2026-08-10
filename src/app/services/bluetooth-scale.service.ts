import { Injectable } from '@angular/core';

/** Đọc một lần từ cân BLE. UUID được cấu hình theo model cân trong localStorage. */
@Injectable({ providedIn: 'root' })
export class BluetoothScaleService {
  async readWeightKg(): Promise<number> {
    const bluetooth = (navigator as any).bluetooth;
    if (!bluetooth) throw new Error('Trình duyệt này không hỗ trợ Web Bluetooth.');
    const serviceUuid = localStorage.getItem('scaleBleServiceUuid')?.trim();
    const characteristicUuid = localStorage.getItem('scaleBleWeightCharacteristicUuid')?.trim();
    if (!serviceUuid || !characteristicUuid)
      throw new Error('Chưa cấu hình UUID dịch vụ và characteristic của cân BLE.');
    const device = await bluetooth.requestDevice({ filters: [{ services: [serviceUuid] }], optionalServices: [serviceUuid] });
    const server = await device.gatt?.connect();
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristic = await service.getCharacteristic(characteristicUuid);
      const value: DataView = await characteristic.readValue();
      const text = new TextDecoder().decode(value.buffer).replace(',', '.');
      const textWeight = Number(text.match(/-?\d+(?:\.\d+)?/)?.[0]);
      const weight = Number.isFinite(textWeight) && textWeight > 0
        ? textWeight
        : value.byteLength >= 4 ? value.getUint32(0, true) / 1000 : value.getUint16(0, true) / 100;
      if (!Number.isFinite(weight) || weight <= 0) throw new Error('Cân BLE trả về khối lượng không hợp lệ.');
      return Math.round(weight * 1000) / 1000;
    } finally { server?.disconnect(); }
  }
}
