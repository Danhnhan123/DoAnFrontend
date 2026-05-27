import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-stocktake',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stocktake.component.html',
  styleUrl: './stocktake.component.css',
})
export class StocktakeComponent {
  checks = [
    { code: 'KK-2025-001', warehouse: 'Kho A', date: '2025-07-05', status: 'Hoan thanh', tone: 'done' },
    { code: 'KK-2025-002', warehouse: 'Kho B', date: '2025-07-12', status: 'Dang kiem', tone: 'processing' },
  ];

  lines = [
    { sku: 'SKU-0001', name: 'Bong den LED 9W', system: 20, actual: 8 },
    { sku: 'SKU-0002', name: 'Cap sac Type-C 1m', system: 245, actual: 248 },
    { sku: 'SKU-0003', name: 'Ao thun nam size L', system: 30, actual: 5 },
    { sku: 'SKU-0004', name: 'Sua tuoi Vinamilk 1L', system: 180, actual: 180 },
    { sku: 'SKU-0005', name: 'Tai nghe bluetooth TWS', system: 62, actual: 65 },
    { sku: 'SKU-0007', name: 'Banh quy hop 500g', system: 97, actual: 94 },
  ];

  diff(system: number, actual: number): number {
    return actual - system;
  }
}
