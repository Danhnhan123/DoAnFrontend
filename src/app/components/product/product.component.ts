import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ProductRow {
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrl: './product.component.css',
})
export class ProductComponent {
  search = signal('');
  page = signal(1);
  pageSize = signal(10);

  products = signal<ProductRow[]>([
    { sku: 'SKU-0001', name: 'Bong den LED 9W', category: 'Dien tu', unit: 'Cai', stock: 8 },
    { sku: 'SKU-0002', name: 'Cap sac Type-C 1m', category: 'Dien tu', unit: 'Cai', stock: 245 },
    { sku: 'SKU-0003', name: 'Ao thun nam size L', category: 'Det may', unit: 'Cai', stock: 5 },
    { sku: 'SKU-0004', name: 'Sua tuoi Vinamilk 1L', category: 'Thuc pham', unit: 'Hop', stock: 180 },
    { sku: 'SKU-0005', name: 'Tai nghe bluetooth TWS', category: 'Dien tu', unit: 'Chiec', stock: 62 },
    { sku: 'SKU-0006', name: 'Quan jean nam size 32', category: 'Det may', unit: 'Cai', stock: 33 },
    { sku: 'SKU-0007', name: 'Banh quy hop 500g', category: 'Thuc pham', unit: 'Hop', stock: 97 },
    { sku: 'SKU-0008', name: 'Man hinh LCD 24 inch', category: 'Dien tu', unit: 'Cai', stock: 14 },
    { sku: 'SKU-0009', name: 'Kem duong da mat 50ml', category: 'My pham', unit: 'Tuyp', stock: 210 },
    { sku: 'SKU-0010', name: 'Dau goi dau 400ml', category: 'FMCG', unit: 'Chai', stock: 340 },
  ]);

  filteredProducts = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    if (!keyword) return this.products();
    return this.products().filter((product) =>
      [product.sku, product.name, product.category, product.unit]
        .some((value) => value.toLowerCase().includes(keyword))
    );
  });

  totalRecords = computed(() => this.filteredProducts().length);
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  rows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredProducts().slice(start, start + this.pageSize());
  });

  visiblePages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }

  setPage(page: number): void {
    const next = Math.min(Math.max(page, 1), this.totalPages());
    this.page.set(next);
  }

  onSearch(): void {
    this.page.set(1);
  }

  statusFor(stock: number): 'low' | 'normal' {
    return stock <= 15 ? 'low' : 'normal';
  }
}
