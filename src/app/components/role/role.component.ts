import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  RoleListDto,
  RolePermissonDto,
  RoleMenuActionDto,
  CreateRoleDto,
  UpdateRoleDto,
  ActionDto,
  MenuAggregate,
  MenuPermissionDto,
  FlatMenu,
  ApiResponse,
} from '../../models';
import { RoleService, flattenMenus } from '../../services/role.service';

const ACTION_PROP_MAP: Record<string, string> = {
  Xem: 'hasRead',
  'Thêm mới': 'hasCreate',
  'Chỉnh sửa': 'hasUpdate',
  Xoá: 'hasDelete',
  Export: 'hasExport',
  Approve: 'hasApprove',
};

@Component({
  selector: 'app-role',
  standalone: true,
  imports: [CommonModule, FormsModule, NgTemplateOutlet],
  templateUrl: './role.component.html',
  styleUrl: './role.component.css',
})
export class RoleComponent implements OnInit {
  private roleService = inject(RoleService);

  roles = signal<RoleListDto[]>([]);
  loading = signal(true);
  totalRecords = signal(0);
  page = signal(1);
  pageSize = signal(9);
  search = signal('');

  showModal = signal(false);
  saving = signal(false);
  loadingForm = signal(false);
  editItem = signal<RoleListDto | null>(null);
  isEdit = computed(() => !!this.editItem());

  formName = signal('');
  formDesc = signal('');

  allMenus = signal<FlatMenu[]>([]);
  allActions = signal<ActionDto[]>([]);
  menuPermissions = signal<Map<number, any>>(new Map());
  selectedPerms = signal<Map<number, Set<number>>>(new Map());

  rootMenus = computed(() =>
    this.allMenus()
      .filter((m) => !m.parentId)
      .sort((a, b) => a.order - b.order)
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.roleService
      .getPagedRoles({
        pageIndex: this.page(),
        pageSize: this.pageSize(),
        keyword: this.search(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          const d = (res as any)?.data;
          if (d?.items) {
            this.roles.set(d.items);
            this.totalRecords.set(d.totalCount || 0);
          } else if (Array.isArray(res?.resources)) {
            this.roles.set(res.resources as any);
            this.totalRecords.set((res.resources as any).length);
          } else {
            this.roles.set([]);
            this.totalRecords.set(0);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.page.set(1);
    this.loadData();
  }
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }
  visiblePages(): number[] {
    const t = this.totalPages(),
      c = this.page(),
      d = 2,
      p: number[] = [];
    for (let i = Math.max(1, c - d); i <= Math.min(t, c + d); i++) p.push(i);
    return p;
  }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadData();
  }

  openCreate(): void {
    this.editItem.set(null);
    this.formName.set('');
    this.formDesc.set('');
    this.selectedPerms.set(new Map());
    this.loadFormDeps(null);
    this.showModal.set(true);
  }

  openEdit(role: RoleListDto): void {
    this.editItem.set(role);
    this.formName.set(role.name);
    this.formDesc.set(role.description || '');
    this.selectedPerms.set(new Map());
    this.loadFormDeps(role.id);
    this.showModal.set(true);
  }

  private loadFormDeps(roleId: number | null): void {
    this.loadingForm.set(true);
    let done = 0;
    const total = roleId ? 4 : 3;
    const check = () => {
      if (++done >= total) this.loadingForm.set(false);
    };

    this.roleService.getAllMenus().subscribe({
      next: (r) => {
        this.allMenus.set(flattenMenus(r?.resources || (r as any)?.data || []));
        check();
      },
      error: check,
    });
    this.roleService.getAllActions().subscribe({
      next: (r) => {
        this.allActions.set(r?.resources || (r as any)?.data || []);
        check();
      },
      error: check,
    });
    this.roleService.getMenuPermissions().subscribe({
      next: (r) => {
        const list = r?.resources || (r as any)?.data || [];
        const map = new Map<number, any>();
        (list as any[]).forEach((p: any) => map.set(p.id, p));
        this.menuPermissions.set(map);
        check();
      },
      error: check,
    });

    if (roleId) {
      this.roleService.getRolePermissions(roleId).subscribe({
        next: (r) => {
          const perms: RolePermissonDto[] =
            r?.resources?.permissions ??
            r?.resources ??
            (r as any)?.data?.permissions ??
            (r as any)?.data ??
            [];
          const map = new Map<number, Set<number>>();
          for (const p of perms) {
            if (!map.has(p.menuId)) map.set(p.menuId, new Set());
            map.get(p.menuId)!.add(p.actionId);
          }
          this.selectedPerms.set(map);
          check();
        },
        error: check,
      });
    }
  }

  getChildren(parentId: number): FlatMenu[] {
    return this.allMenus()
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => a.order - b.order);
  }
  isActionAllowed(menuId: number, actionName: string): boolean {
    const perm = this.menuPermissions().get(menuId);
    if (!perm) return false;
    const prop = ACTION_PROP_MAP[actionName];
    return prop ? Boolean(perm[prop]) : false;
  }
  isDisabled(menu: FlatMenu, action: ActionDto): boolean {
    return !this.isActionAllowed(menu.id, action.name);
  }
  isChecked(menuId: number, actionId: number): boolean {
    return this.selectedPerms().get(menuId)?.has(actionId) ?? false;
  }
  togglePerm(menuId: number, actionId: number, disabled: boolean): void {
    if (disabled) return;
    const map = new Map(this.selectedPerms()),
      set = new Set(map.get(menuId) || []);
    set.has(actionId) ? set.delete(actionId) : set.add(actionId);
    set.size === 0 ? map.delete(menuId) : map.set(menuId, set);
    this.selectedPerms.set(map);
  }
  isRowChecked(menu: FlatMenu): boolean {
    const sel = this.selectedPerms().get(menu.id);
    if (!sel || sel.size === 0) return false;
    const enabled = this.allActions().filter((a) => !this.isDisabled(menu, a));
    return enabled.length > 0 && enabled.every((a) => sel.has(a.id));
  }
  toggleRow(menu: FlatMenu, checked: boolean): void {
    const map = new Map(this.selectedPerms());
    if (checked) {
      const set = new Set<number>();
      this.allActions().forEach((a) => {
        if (!this.isDisabled(menu, a)) set.add(a.id);
      });
      set.size > 0 ? map.set(menu.id, set) : map.delete(menu.id);
    } else {
      map.delete(menu.id);
    }
    this.selectedPerms.set(map);
  }
  isSelectAllChecked(): boolean {
    const menus = this.allMenus(),
      actions = this.allActions();
    if (!menus.length || !actions.length) return false;
    return menus.every((m) => {
      const enabled = actions.filter((a) => !this.isDisabled(m, a));
      const sel = this.selectedPerms().get(m.id);
      return enabled.every((a) => sel?.has(a.id));
    });
  }
  selectAll(checked: boolean): void {
    if (checked) {
      const map = new Map<number, Set<number>>();
      this.allMenus().forEach((m) => {
        const set = new Set<number>();
        this.allActions().forEach((a) => {
          if (!this.isDisabled(m, a)) set.add(a.id);
        });
        if (set.size > 0) map.set(m.id, set);
      });
      this.selectedPerms.set(map);
    } else {
      this.selectedPerms.set(new Map());
    }
  }

  save(): void {
    if (!this.formName()) {
      this.showAlert('Vui lòng nhập tên vai trò', false);
      return;
    }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} vai trò này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.saving.set(true);
      const permissions: RoleMenuActionDto[] = [];
      for (const [menuId, actionSet] of this.selectedPerms().entries())
        for (const actionId of actionSet)
          permissions.push({ menuId, actionId });

      if (this.isEdit()) {
        const p: UpdateRoleDto = {
          id: this.editItem()!.id,
          name: this.formName(),
          description: this.formDesc(),
          isCheckAll: this.isSelectAllChecked(),
          permissions,
        };
        this.roleService.update(p).subscribe({
          next: (r) => {
            this.saving.set(false);
            if (r.isSucceeded) {
              this.closeModal();
              this.loadData();
              this.showAlert('Cập nhật thành công!');
            } else this.showAlert(r.message || 'Cập nhật thất bại', false);
          },
          error: (err) => {
            this.saving.set(false);
            this.showAlert(err?.error?.message || 'Lỗi hệ thống', false);
          },
        });
      } else {
        const p: CreateRoleDto = {
          name: this.formName(),
          description: this.formDesc(),
          isCheckAll: this.isSelectAllChecked(),
          permissions,
        };
        this.roleService.create(p).subscribe({
          next: (r) => {
            this.saving.set(false);
            if (r.isSucceeded) {
              this.closeModal();
              this.loadData();
              this.showAlert('Thêm thành công!');
            } else this.showAlert(r.message || 'Thêm mới thất bại', false);
          },
          error: (err) => {
            this.saving.set(false);
            this.showAlert(err?.error?.message || 'Lỗi hệ thống', false);
          },
        });
      }
    });
  }

  delete(id: number, name: string): void {
    Swal.fire({
      title: 'Bạn có chắc chắn?',
      text: `Bạn chuẩn bị xóa vai trò "${name}". Thao tác này không thể hoàn tác!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Có, Xóa!',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (result.isConfirmed) {
        this.roleService.delete(id).subscribe({
          next: (r) => {
            if (r.isSucceeded) {
              this.loadData();
              this.showAlert('Đã xóa thành công!');
            } else this.showAlert(r.message || 'Xóa thất bại', false);
          },
          error: (err) => {
            this.showAlert(err?.error?.message || 'Lỗi hệ thống', false);
          },
        });
      }
    });
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
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
