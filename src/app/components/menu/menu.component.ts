import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  MenuAggregate,
  MenuDetailDto,
  CreateMenuDto,
  UpdateMenuDto,
  ActionDto,
  ApiResponse,
} from '../../models';
import { MenuService } from '../../services/menu.service';
import { ActionService } from '../../services/action.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
})
export class MenuComponent implements OnInit {
  private menuService = inject(MenuService);
  private actionService = inject(ActionService);

  nestedMenus = signal<MenuAggregate[]>([]);
  flatMenus = signal<MenuAggregate[]>([]);
  loading = signal(true);
  totalRecords = signal(0);
  allActions = signal<ActionDto[]>([]);

  showModal = signal(false);
  saving = signal(false);
  loadingDetail = signal(false);
  editItem = signal<MenuAggregate | null>(null);
  isEdit = computed(() => !!this.editItem());
  isReadOnly = signal(false);

  form = signal<{
    name: string;
    url: string;
    icon: string;
    className: string;
    sortOrder: number;
    parentId: number | null;
    menuType: string;
    isAdminOnly: boolean;
    actionIds: number[];
  }>({
    name: '',
    url: '',
    icon: '',
    className: '',
    sortOrder: 1,
    parentId: null,
    menuType: 'ADMIN',
    isAdminOnly: false,
    actionIds: [],
  });

  menuTypes = ['ADMIN', 'CLIENT', 'BOTH'];
  toast = signal<{ msg: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    this.loadMenus();
    this.loadActions();
  }

  loadMenus(): void {
    this.loading.set(true);
    this.menuService.getAll().subscribe({
      next: (res) => {
        this.loading.set(false);
        const rawData: MenuAggregate[] =
          res?.resources || (res as any)?.data || [];
        this.flatMenus.set(rawData);
        this.totalRecords.set(rawData.length);
        this.nestedMenus.set(this.menuService.buildMenuTree(rawData));
      },
      error: () => this.loading.set(false),
    });
  }

  loadActions(): void {
    this.actionService.getAll().subscribe({
      next: (res) =>
        this.allActions.set(res?.resources || (res as any)?.data || []),
    });
  }

  getRootMenus(): MenuAggregate[] {
    return (this.nestedMenus() || [])
      .filter((m) => !m.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  getChildren(m: MenuAggregate): MenuAggregate[] {
    return (m.child || []).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  hasChildren(m: MenuAggregate): boolean {
    return !!m.child?.length;
  }

  renderParentOptions(
    items: MenuAggregate[],
    depth = 0
  ): { id: number; label: string; disabled: boolean }[] {
    const result: any[] = [];
    const self = this.editItem();
    for (const m of items.sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (self && m.id === self.id) continue;
      result.push({
        id: m.id,
        label: '— '.repeat(depth) + m.name,
        disabled: false,
      });
      if (m.child?.length)
        result.push(...this.renderParentOptions(m.child, depth + 1));
    }
    return result;
  }

  openCreate(): void {
    this.editItem.set(null);
    this.isReadOnly.set(false);
    this.form.set({
      name: '',
      url: '',
      icon: '',
      className: '',
      sortOrder: 1,
      parentId: null,
      menuType: 'ADMIN',
      isAdminOnly: false,
      actionIds: [],
    });
    this.showModal.set(true);
  }

  openEdit(menu: MenuAggregate, readOnly = false): void {
    this.editItem.set(menu);
    this.isReadOnly.set(readOnly);
    this.loadingDetail.set(true);
    this.showModal.set(true);
    this.menuService.getById(menu.id).subscribe({
      next: (res) => {
        this.loadingDetail.set(false);
        const d: MenuDetailDto = res?.resources ?? (res as any)?.data;
        if (d)
          this.form.set({
            name: d.name,
            url: d.url || '',
            icon: d.icon || '',
            className: d.className || '',
            sortOrder: d.sortOrder,
            parentId: d.parentId ?? null,
            menuType: d.menuType,
            isAdminOnly: d.isAdminOnly,
            actionIds: d.actionIds || [],
          });
      },
      error: () => {
        this.loadingDetail.set(false);
        this.form.update((f) => ({
          ...f,
          name: menu.name,
          url: menu.url || '',
          icon: menu.icon || '',
          sortOrder: menu.sortOrder,
          parentId: menu.parentId ?? null,
          menuType: menu.menuType,
        }));
      },
    });
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
  }
  setField(f: string, v: any): void {
    this.form.update((x) => ({ ...x, [f]: v }));
  }
  toggleAction(id: number, checked: boolean): void {
    this.form.update((x) => ({
      ...x,
      actionIds: checked
        ? [...x.actionIds, id]
        : x.actionIds.filter((a) => a !== id),
    }));
  }
  isActionSelected(id: number): boolean {
    return this.form().actionIds.includes(id);
  }

  save(): void {
    const f = this.form();
    if (!f.name) {
      this.showAlert('Vui lòng nhập tên menu', false);
      return;
    }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';

    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} menu này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) {
        this.saving.set(true);
        if (this.isEdit()) {
          const payload: UpdateMenuDto = {
            id: this.editItem()!.id,
            name: f.name,
            url: f.url || '',
            icon: f.icon || '',
            className: f.className || null,
            sortOrder: Number(f.sortOrder) || 1,
            parentId: f.parentId || null,
            menuType: f.menuType,
            isAdminOnly: f.isAdminOnly,
            actionIds: f.actionIds,
          };
          this.menuService.update(payload).subscribe({
            next: (res) => {
              this.saving.set(false);
              if (res.isSucceeded) {
                this.closeModal();
                this.loadMenus();
                this.showAlert('Cập nhật menu thành công!');
              } else this.showAlert(res.message || 'Thất bại', false);
            },
            error: (err) => {
              this.saving.set(false);
              this.showAlert(err?.error?.message || 'Lỗi hệ thống', false);
            },
          });
        } else {
          const payload: CreateMenuDto = {
            name: f.name,
            url: f.url || '',
            icon: f.icon || '',
            className: f.className || null,
            sortOrder: Number(f.sortOrder) || 1,
            parentId: f.parentId || null,
            menuType: f.menuType,
            isAdminOnly: f.isAdminOnly,
            actionIds: f.actionIds,
          };
          this.menuService.create(payload).subscribe({
            next: (res) => {
              this.saving.set(false);
              if (res.isSucceeded) {
                this.closeModal();
                this.loadMenus();
                this.showAlert('Thêm menu thành công!');
              } else this.showAlert(res.message || 'Thất bại', false);
            },
            error: (err) => {
              this.saving.set(false);
              this.showAlert(err?.error?.message || 'Lỗi hệ thống', false);
            },
          });
        }
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Bạn có chắc chắn?',
      text: `Bạn chuẩn bị xóa menu "${name}". Thao tác này không thể hoàn tác!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Có, Xóa!',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) {
        this.menuService.delete(id).subscribe({
          next: (res) => {
            if (res.isSucceeded) {
              this.loadMenus();
              this.showAlert('Đã xóa menu thành công!');
            } else this.showAlert(res.message || 'Xóa thất bại', false);
          },
          error: (err) =>
            this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
        });
      }
    });
  }

  private showAlert(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công!' : 'Thất bại!',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Đóng',
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster',
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster',
      },
    });
  }
}
