import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-outbound',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './outbound.component.html',
  styleUrl: './outbound.component.css',
})
export class OutboundComponent {
  slips = [
    { code: 'PX-2025-001', customer: 'Sieu thi BigC', date: '2025-07-10', warehouse: 'Kho A', status: 'Hoan thanh', tone: 'done' },
    { code: 'PX-2025-002', customer: 'Cua hang The Gioi Di Dong', date: '2025-07-11', warehouse: 'Kho B', status: 'Cho xu ly', tone: 'pending' },
    { code: 'PX-2025-003', customer: 'Cong ty TNHH XYZ Logistics', date: '2025-07-13', warehouse: 'Kho A', status: 'Dang xu ly', tone: 'processing' },
  ];

  lines = [
    { sku: 'SKU-0002', name: 'Cap sac Type-C 1m', qty: 50, price: 45000 },
    { sku: 'SKU-0004', name: 'Sua tuoi Vinamilk 1L', qty: 100, price: 28000 },
    { sku: 'SKU-0009', name: 'Kem duong da mat 50ml', qty: 30, price: 85000 },
  ];

  total(): number {
    return this.lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  }
}
