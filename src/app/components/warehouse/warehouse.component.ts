import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './warehouse.component.html',
  styleUrl: './warehouse.component.css',
})
export class WarehouseComponent {
  warehouses = [
    { name: 'Kho A', code: 'KHO-A', address: '123 Nguyen Van Linh, Q.7, TP.HCM', manager: 'Tran Van Binh', zones: 12, racks: 48, used: 3820, capacity: 5000, status: 'Hoat dong' },
    { name: 'Kho B', code: 'KHO-B', address: '456 Le Van Viet, Q.9, TP.HCM', manager: 'Nguyen Thi Lan', zones: 8, racks: 32, used: 1540, capacity: 3000, status: 'Hoat dong' },
    { name: 'Kho C', code: 'KHO-C', address: '789 Quoc lo 1A, Binh Duong', manager: 'Pham Minh Tuan', zones: 20, racks: 80, used: 7200, capacity: 8000, status: 'Gan day' },
    { name: 'Kho D', code: 'KHO-D', address: '321 DT 743, Thuan An, Binh Duong', manager: 'Le Thi Hoa', zones: 10, racks: 40, used: 0, capacity: 4000, status: 'Tam ngung' },
  ];

  areas = [
    { code: 'A1', name: 'Khu dien tu', warehouse: 'Kho A', racks: 12, empty: '16 / 144', temp: '15-25°C', fill: 89 },
    { code: 'A2', name: 'Khu det may', warehouse: 'Kho A', racks: 8, empty: '24 / 96', temp: '18-28°C', fill: 75 },
    { code: 'B1', name: 'Khu thuc pham kho', warehouse: 'Kho B', racks: 10, empty: '65 / 120', temp: '20-25°C', fill: 46 },
    { code: 'C1', name: 'Khu my pham', warehouse: 'Kho C', racks: 16, empty: '7 / 192', temp: '10-20°C', fill: 96 },
    { code: 'C2', name: 'Khu FMCG', warehouse: 'Kho C', racks: 14, empty: '7 / 168', temp: '18-28°C', fill: 96 },
  ];

  percent(item: { used: number; capacity: number }): number {
    return Math.round((item.used / item.capacity) * 100);
  }
}
