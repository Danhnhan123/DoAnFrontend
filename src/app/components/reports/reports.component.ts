import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent {
  bars = [410, 370, 505, 455, 545, 485, 620];
  categories = [
    { name: 'Dien tu', value: 38, color: '#2563eb' },
    { name: 'Thuc pham', value: 24, color: '#16a34a' },
    { name: 'Det may', value: 19, color: '#9333ea' },
    { name: 'My pham', value: 11, color: '#db2777' },
    { name: 'FMCG', value: 8, color: '#d97706' },
  ];
  topProducts = [
    ['Cap sac Type-C 1m', '+580', '-510'],
    ['Sua tuoi Vinamilk 1L', '+420', '-390'],
    ['Kem duong da 50ml', '+310', '-260'],
    ['Tai nghe bluetooth', '+280', '-240'],
    ['Dau goi dau 400ml', '+410', '-380'],
  ];
}
