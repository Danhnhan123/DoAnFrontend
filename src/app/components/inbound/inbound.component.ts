import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-inbound',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inbound.component.html',
  styleUrl: './inbound.component.css',
})
export class InboundComponent {
  receipts = [
    { code: 'PN-2025-001', supplier: 'Cong ty TNHH ABC', date: '2025-07-10', warehouse: 'Kho A', status: 'Hoan thanh', tone: 'done' },
    { code: 'PN-2025-002', supplier: 'CTCP Dien tu DEF', date: '2025-07-11', warehouse: 'Kho B', status: 'Cho xu ly', tone: 'pending' },
    { code: 'PN-2025-003', supplier: 'Cty TNHH GHI Foods', date: '2025-07-12', warehouse: 'Kho A', status: 'Dang xu ly', tone: 'processing' },
  ];

  lines = [
    { sku: 'SKU-0001', name: 'Bong den LED 9W', qty: 200, price: 25000 },
    { sku: 'SKU-0002', name: 'Cap sac Type-C 1m', qty: 150, price: 45000 },
    { sku: 'SKU-0005', name: 'Tai nghe bluetooth TWS', qty: 80, price: 320000 },
  ];

  total(): number {
    return this.lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  }
}
