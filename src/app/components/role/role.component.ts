import { Component, signal, inject, computed, effect } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  injectQuery,
  injectMutation,
  injectQueryClient,
} from '@tanstack/angular-query-experimental';
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
export class RoleComponent {
  private roleService = inject(RoleService);
  private queryClient = injectQueryClient();

  page = signal(1);
  pageSize = signal(9);
  search = signal('');

  showModal = signal(false);
  editItem = signal<RoleListDto | null>(null);
  isEdit = computed(() => !!this.editItem());

  formCode = signal('');
  formName = signal('');
  formDesc = signal('');

  selectedPerms = signal<Map<number, Set<number>>>(new Map());

  // ── Queries ──────────────────────────────────────────────────────────────

  listQuery = injectQuery(() => ({
    queryKey: ['roles', this.page(), this.pageSize(), this.search()],
    queryFn: () =>
      lastValueFrom(
        this.roleService.getPagedRoles({
          pageIndex: this.page(),
          pageSize: this.pageSize(),
          keyword: this.search(),
        })
      ),
  }));

  menusQuery = injectQuery(() => ({
    queryKey: ['all-menus'],
    queryFn: () => lastValueFrom(this.roleService.getAllMenus()),
    staleTime: 5 * 60_000,
  }));

  actionsQuery = injectQuery(() => ({
    queryKey: ['all-actions'],
    queryFn: () => lastValueFrom(this.roleService.getAllActions()),
    staleTime: 5 * 60_000,
  }));

  menuPermissionsQuery = injectQuery(() => ({
    queryKey: ['menu-permissions'],
    queryFn: () => lastValueFrom(this.roleService.getMenuPermissions()),
    staleTime: 5 * 60_000,
  }));

  rolePermissionsQuery = injectQuery(() => ({
    queryKey: ['role-permissions', this.editItem()?.id],
    enabled: !!this.editItem()?.id && this.showModal(),
    queryFn: () =>
      lastValueFrom(this.roleService.getRolePermissions(this.editItem()!.id)),
  }));

  // ── Derived data ──────────────────────────────────────────────────────────

  roles = computed<RoleListDto[]>(() => {
    const d = (this.listQuery.data() as any)?.data;
    if (d?.items) return d.items;
    const res = this.listQuery.data() as any;
    if (Array.isArray(res?.resources)) return res.resources;
    return [];
  });
  totalRecords = computed<number>(() => {
    const d = (this.listQuery.data() as any)?.data;
    if (d?.totalCount != null) return d.totalCount;
    const res = this.listQuery.data() as any;
    if (Array.isArray(res?.resources)) return res.resources.length;
    return 0;
  });
  loading = computed(() => this.listQuery.isPending());
  loadingForm = computed(
    () =>
      this.menusQuery.isFetching() ||
      this.actionsQuery.isFetching() ||
      this.menuPermissionsQuery.isFetching() ||
      this.rolePermissionsQuery.isFetching()
  );

  allMenus = computed<FlatMenu[]>(() => {
    const r = this.menusQuery.data() as any;
    return flattenMenus(r?.resources || r?.data || []);
  });

  allActions = computed<ActionDto[]>(() => {
    const r = this.actionsQuery.data() as any;
    return r?.resources || r?.data || [];
  });

  menuPermissions = computed<Map<number, any>>(() => {
    const r = this.menuPermissionsQuery.data() as any;
    const list: any[] = r?.resources || r?.data || [];
    const map = new Map<number, any>();
    list.forEach((p: any) => map.set(p.id, p));
    return map;
  });

  rootMenus = computed(() =>
    this.allMenus()
      .filter((m) => !m.parentId)
      .sort((a, b) => a.order - b.order)
  );

  /**
   * Đổ quyền hạn của vai trò (API GET /role/{id}/permissons) vào selectedPerms khi
   * mở modal sửa. Dùng effect để tự chạy lại mỗi khi query có dữ liệu mới.
   * (Trước đây dùng getter _rolePermsSynced nhưng không được template gọi nên
   *  selectedPerms không bao giờ được nạp -> popup không tích sẵn quyền theo menu.)
   */
  private syncRolePerms = effect(() => {
    const d = this.rolePermissionsQuery.data();
    if (!d || !this.showModal() || !this.isEdit()) return;

    const raw =
      (d as any)?.resources?.permissions ??
      (d as any)?.data?.permissions ??
      (d as any)?.resources ??
      (d as any)?.data ??
      [];
    const perms: RolePermissonDto[] = Array.isArray(raw) ? raw : [];

    const map = new Map<number, Set<number>>();
    for (const p of perms) {
      if (p == null || p.menuId == null || p.actionId == null) continue;
      if (!map.has(p.menuId)) map.set(p.menuId, new Set());
      map.get(p.menuId)!.add(p.actionId);
    }
    this.selectedPerms.set(map);
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  createMutation = injectMutation(() => ({
    mutationFn: (payload: CreateRoleDto) =>
      lastValueFrom(this.roleService.create(payload)),
    onSuccess: (r: any) => {
      if (r.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['roles'] });
        // Quyền thay đổi -> làm mới sidebar theo quyền của user đang đăng nhập.
        this.queryClient.invalidateQueries({ queryKey: ['sidebar-menus'] });
        this.showAlert('Thêm thành công!');
      } else this.showAlert(r.message || 'Thêm mới thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  updateMutation = injectMutation(() => ({
    mutationFn: (payload: UpdateRoleDto) =>
      lastValueFrom(this.roleService.update(payload)),
    onSuccess: (r: any) => {
      if (r.isSucceeded) {
        this.closeModal();
        this.queryClient.invalidateQueries({ queryKey: ['roles'] });
        // Quyền thay đổi -> làm mới sidebar theo quyền của user đang đăng nhập.
        this.queryClient.invalidateQueries({ queryKey: ['sidebar-menus'] });
        this.showAlert('Cập nhật thành công!');
      } else this.showAlert(r.message || 'Cập nhật thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  deleteMutation = injectMutation(() => ({
    mutationFn: (id: number) =>
      lastValueFrom(this.roleService.delete(id)),
    onSuccess: (r: any) => {
      if (r.isSucceeded) {
        this.queryClient.invalidateQueries({ queryKey: ['roles'] });
        // Quyền thay đổi -> làm mới sidebar theo quyền của user đang đăng nhập.
        this.queryClient.invalidateQueries({ queryKey: ['sidebar-menus'] });
        this.showAlert('Đã xóa thành công!');
      } else this.showAlert(r.message || 'Xóa thất bại', false);
    },
    onError: (err: any) => this.showAlert(err?.error?.message || 'Lỗi hệ thống', false),
  }));

  saving = computed(
    () => this.createMutation.isPending() || this.updateMutation.isPending()
  );

  // ── UI Helpers ────────────────────────────────────────────────────────────

  onSearch(): void { this.page.set(1); }
  totalPages(): number {
    return Math.ceil(this.totalRecords() / this.pageSize());
  }
  visiblePages(): number[] {
    const t = this.totalPages(), c = this.page(), d = 2, p: number[] = [];
    for (let i = Math.max(1, c - d); i <= Math.min(t, c + d); i++) p.push(i);
    return p;
  }
  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
  }

  openCreate(): void {
    this.editItem.set(null);
    this.formCode.set('');
    this.formName.set('');
    this.formDesc.set('');
    this.selectedPerms.set(new Map());
    this.showModal.set(true);
  }
  openEdit(role: RoleListDto): void {
    this.editItem.set(role);
    this.formCode.set(role.code || '');
    this.formName.set(role.name);
    this.formDesc.set(role.description || '');
    this.selectedPerms.set(new Map());
    this.showModal.set(true);
  }
  closeModal(): void {
    this.showModal.set(false);
    this.editItem.set(null);
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
      this.allActions().forEach((a) => { if (!this.isDisabled(menu, a)) set.add(a.id); });
      set.size > 0 ? map.set(menu.id, set) : map.delete(menu.id);
    } else {
      map.delete(menu.id);
    }
    this.selectedPerms.set(map);
  }
  isSelectAllChecked(): boolean {
    const menus = this.allMenus(), actions = this.allActions();
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
        this.allActions().forEach((a) => { if (!this.isDisabled(m, a)) set.add(a.id); });
        if (set.size > 0) map.set(m.id, set);
      });
      this.selectedPerms.set(map);
    } else {
      this.selectedPerms.set(new Map());
    }
  }

  save(): void {
    if (!this.formName()) { this.showAlert('Vui lòng nhập tên vai trò', false); return; }
    const actionText = this.isEdit() ? 'cập nhật' : 'thêm mới';
    Swal.fire({
      title: `Xác nhận ${actionText}`,
      text: `Bạn có chắc chắn muốn ${actionText} vai trò này?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      const permissions: RoleMenuActionDto[] = [];
      for (const [menuId, actionSet] of this.selectedPerms().entries())
        for (const actionId of actionSet)
          permissions.push({ menuId, actionId });

      if (this.isEdit()) {
        this.updateMutation.mutate({
          id: this.editItem()!.id,
          code: this.formCode(),
          name: this.formName(),
          description: this.formDesc(),
          isCheckAll: this.isSelectAllChecked(),
          permissions,
        } as UpdateRoleDto);
      } else {
        this.createMutation.mutate({
          code: this.formCode(),
          name: this.formName(),
          description: this.formDesc(),
          isCheckAll: this.isSelectAllChecked(),
          permissions,
        } as CreateRoleDto);
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
      if (result.isConfirmed) this.deleteMutation.mutate(id);
    });
  }

  private showAlert(msg: string, ok = true): void {
    Swal.fire({
      title: ok ? 'Thành công!' : 'Thất bại!',
      text: msg,
      icon: ok ? 'success' : 'error',
      confirmButtonColor: '#15803d',
      confirmButtonText: 'Đóng',
      showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' },
      hideClass: { popup: 'animate__animated animate__fadeOutUp animate__faster' },
    });
  }
}
