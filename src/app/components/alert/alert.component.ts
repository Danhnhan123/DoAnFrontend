import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.css',
})
export class AlertComponent {
  summary = [
    { count: 2, label: 'Nghiem trong', tone: 'danger' },
    { count: 3, label: 'Canh bao', tone: 'warning' },
    { count: 2, label: 'Thong tin', tone: 'info' },
    { count: 1, label: 'Da xu ly', tone: 'success' },
  ];

  rules = [
    { name: 'Ton kho thap', desc: 'Khi ton kho < nguong canh bao san pham' },
    { name: 'Kho gan day', desc: 'Khi suc chua kho dat >= 85%' },
    { name: 'Hang sap het han', desc: 'Canh bao truoc 7 ngay het han su dung' },
  ];

  alerts = [
    { type: 'Ton kho', title: 'Het hang sap xay ra', desc: 'SKU-0001 - Bong den LED 9W - chi con 8 cai (nguong: 20)', tone: 'danger', time: '5 phut truoc' },
    { type: 'Ton kho', title: 'Het hang sap xay ra', desc: 'SKU-0003 - Ao thun nam size L - chi con 5 cai (nguong: 30)', tone: 'danger', time: '12 phut truoc' },
    { type: 'Ton kho', title: 'Ton kho thap', desc: 'SKU-0008 - Man hinh LCD 24 inch - con 14 cai (nguong: 25)', tone: 'warning', time: '30 phut truoc' },
    { type: 'Kho hang', title: 'Kho C gan day', desc: 'Kho C da su dung 90% suc chua (7.200/8.000 vi tri)', tone: 'warning', time: '2 gio truoc' },
    { type: 'Nhap kho', title: 'Phieu nhap cho duyet', desc: 'PN-2025-004 tu Cong ty TNHH ABC - 3 dong san pham, 80 trieu dong', tone: 'info', time: '3 gio truoc' },
    { type: 'Xuat kho', title: 'Phieu xuat cho duyet', desc: 'PX-2025-003 cho Cong ty XYZ Logistics - 30 san pham', tone: 'info', time: '5 gio truoc' },
  ];
}
